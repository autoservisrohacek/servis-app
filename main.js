const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { google } = require('googleapis');
const http = require('http');
const WebSocket = require('ws');

// Služba příjmu přes lokální síť (původní bluetooth alias)
const initBluetoothSerial = (portName) => {
  console.log(`BT: Sériové Bluetooth rozhraní utlumeno. Veškerý příjem probíhá přes lokální síť na portu 3003.`);
};

ipcMain.on('bluetooth:update-port', (event, portName) => {
  console.log('BT: Ignoruji požadavek na COM port, lokální síť je vždy aktivní na portu 3003.');
});

// P2P Configuration & Mobile LAN Gateway
let wss = null;
let p2pHttpServer = null;
let wsClient = null;
let reconnectInterval = null;
let currentP2PConfig = { mode: 'off', serverIp: '' };

const stopP2P = () => {
  if (wss) {
    console.log('P2P: Zastavuji server...');
    wss.close();
    wss = null;
  }
  if (p2pHttpServer) {
    console.log('P2P: Zastavuji HTTP LAN Gateway...');
    p2pHttpServer.close();
    p2pHttpServer = null;
  }
  if (wsClient) {
    console.log('P2P: Odpojuji klienta...');
    wsClient.close();
    wsClient = null;
  }
  if (reconnectInterval) {
    clearInterval(reconnectInterval);
    reconnectInterval = null;
  }
};

const broadcastToWebSockets = (data, excludeWs = null) => {
  if (wss) {
    wss.clients.forEach((client) => {
      if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
      }
    });
  }
  if (wsClient && wsClient !== excludeWs && wsClient.readyState === WebSocket.OPEN) {
    wsClient.send(JSON.stringify(data));
  }
};

const startP2PServer = () => {
  stopP2P();

  // Vytvoříme hybridní HTTP server na portu 3003
  p2pHttpServer = http.createServer((req, res) => {
    // Povolíme CORS pro mobilní fetch dotazy z jakékoliv IP adresy
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // Mobilní příjem přes standardní HTTP POST
    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });
      req.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          console.log('LAN Gateway: Přijat síťový check-in z mobilu přes POST:', parsed);

          // Přepošleme do našeho rendereru do App.tsx přes stejný IPC kanál
          const win = BrowserWindow.getAllWindows()[0];
          if (win) {
            win.webContents.send('bluetooth:mobile-checkin', parsed);
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'success', message: 'Vozidlo úspěšně přijato na PC.' }));
        } catch (err) {
          console.error('LAN Gateway parse error:', err.message);
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'error', message: 'Chyba parsování JSON dat: ' + err.message }));
        }
      });
    } else if (req.method === 'GET' && req.url === '/api/sync-data') {
      // HLAVNÍ SÍŤOVÁ OPRAVA: Mobil žádá o stažení databáze přes GET
      try {
        const win = BrowserWindow.getAllWindows()[0];
        if (win) {
          // Vyvoláme v PC frontendu žádost o plný stav
          win.webContents.send('p2p:request-full-state');
          
          // Počkáme na odpověď z PC frontendu a hned ji pošleme do mobilu
          ipcMain.once('p2p:send-full-state', (event, state) => {
            res.writeHead(200, { 
              'Content-Type': 'application/json; charset=utf-8',
              'Access-Control-Allow-Origin': '*', // Povolí mobilu čtení dat přes Wi-Fi
              'Access-Control-Allow-Methods': 'GET, OPTIONS'
            });
            
            // Zabalíme reálná data do čistého JSON balíčku
            const syncPayload = {
              customers: state.customers || [],
              vehicles: state.vehicles || []
            };
            
            res.end(JSON.stringify(syncPayload));
          });
        } else {
          res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('Chyba: Hlavní okno PC aplikace není aktivní.');
        }
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Chyba serveru: ' + err.message);
      }
    } else {
      // Fallback pro prohlížeč (zobrazí se pouze, pokud do prohlížeče zadáš IP:3003)
      res.writeHead(200, { 
        'Content-Type': 'text/plain; charset=utf-8',
        'Access-Control-Allow-Origin': '*'
      });
      res.end('Autoservis Příjem - PC LAN Gateway běží na portu 3003 na pozadí.');
    }
  });

  // Napojíme WebSocket Server na tentýž HTTP server (zpětná kompatibilita pro P2P synchronizaci a WS mobil)
  wss = new WebSocket.Server({ server: p2pHttpServer });
  console.log('LAN Gateway: Hybridní síťový server naslouchá na portu 3003');

  p2pHttpServer.listen(3003, '0.0.0.0', () => {
    console.log('LAN Gateway: HTTP/WS Server úspěšně spuštěn na 0.0.0.0:3003');
  });

  wss.on('connection', (ws) => {
    console.log('P2P / Mobil WS: Připojen nový klient přes WebSocket');
    
    // Handshake: Pošleme novému klientovi žádost o synchronizaci
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'P2P_REQUEST_SYNC' }));
    }
    
    // Ke každému novému klientovi pošleme také INIT_DUMP (zpětná kompatibilita)
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      win.webContents.send('p2p:request-full-state');
      
      ipcMain.once('p2p:send-full-state', (event, state) => {
        if (ws.readyState === WebSocket.OPEN) {
          const filteredState = {
            customers: state.customers || [],
            vehicles: state.vehicles || []
          };
          ws.send(JSON.stringify({ type: 'INIT_DUMP', payload: filteredState }));
        }
      });
    }

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        console.log('LAN Gateway WS: Přijata zpráva:', data.type);
        
        // Podpora mobilního odeslání přes WebSocket typ MOBILE_CHECK_IN
        if (data.type === 'MOBILE_CHECK_IN') {
          console.log('LAN Gateway WS: Zachycen MOBILE_CHECK_IN z mobilu:', data.payload);
          const win = BrowserWindow.getAllWindows()[0];
          if (win) {
            win.webContents.send('bluetooth:mobile-checkin', data.payload);
          }
          return;
        }

        // Přepošleme do našeho rendereru
        const win = BrowserWindow.getAllWindows()[0];
        if (win) {
          if (data.type === 'UPDATE') {
            win.webContents.send('p2p:update-received', data.payload);
          } else if (data.type === 'INIT_DUMP') {
            win.webContents.send('p2p:init-dump-received', data.payload);
          } else if (data.type === 'P2P_REQUEST_SYNC') {
            win.webContents.send('p2p:request-sync-from-network');
          } else if (data.type === 'P2P_FULL_SYNC') {
            win.webContents.send('p2p:full-sync-received', data.payload);
          }
        }

        // Přepošleme ostatním klientům
        broadcastToWebSockets(data, ws);
      } catch (e) {
        console.error('P2P Server WS error parsing message:', e);
      }
    });
  });
};

const startP2PClient = (serverIp) => {
  stopP2P();
  
  const connect = () => {
    if (currentP2PConfig.mode !== 'client') return;
    
    console.log(`P2P: Pokus o připojení k serveru ${serverIp}:3003...`);
    wsClient = new WebSocket(`ws://${serverIp}:3003`);

    wsClient.on('open', () => {
      console.log('P2P: Připojeno k serveru');
      
      // Handshake: Pošleme serveru žádost o synchronizaci
      if (wsClient.readyState === WebSocket.OPEN) {
        wsClient.send(JSON.stringify({ type: 'P2P_REQUEST_SYNC' }));
      }

      if (reconnectInterval) {
        clearInterval(reconnectInterval);
        reconnectInterval = null;
      }
    });

    wsClient.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        console.log('P2P Client: Přijata zpráva:', data.type);
        
        const win = BrowserWindow.getAllWindows()[0];
        if (win) {
          if (data.type === 'UPDATE') {
            win.webContents.send('p2p:update-received', data.payload);
          } else if (data.type === 'INIT_DUMP') {
            win.webContents.send('p2p:init-dump-received', data.payload);
          } else if (data.type === 'P2P_REQUEST_SYNC') {
            win.webContents.send('p2p:request-sync-from-network');
          } else if (data.type === 'P2P_FULL_SYNC') {
            win.webContents.send('p2p:full-sync-received', data.payload);
          }
        }
      } catch (e) {
        console.error('P2P Client error parsing message:', e);
      }
    });

    wsClient.on('error', (err) => {
      console.error('P2P: Chyba připojení:', err.message);
      // In case we don't get a 'close' event for some reason
      if (!reconnectInterval && currentP2PConfig.mode === 'client') {
        reconnectInterval = setInterval(connect, 5000);
      }
    });

    wsClient.on('close', () => {
      console.log('P2P: Spojení uzavřeno');
      if (!reconnectInterval && currentP2PConfig.mode === 'client') {
        reconnectInterval = setInterval(connect, 5000);
      }
    });
  };

  connect();
};

ipcMain.on('p2p:update-settings', (event, config) => {
  console.log('P2P: Přijata konfigurace:', config);
  currentP2PConfig = config;

  if (config.mode === 'off') {
    stopP2P();
  } else if (config.mode === 'server') {
    startP2PServer();
  } else if (config.mode === 'client') {
    startP2PClient(config.serverIp);
  }
});

ipcMain.on('p2p:broadcast-update', (event, payload) => {
  // P2P: Síťový broadcast se smí spustit POUZE tehdy, pokud jde o Zákazníka nebo Vozidlo
  if (payload && ['CUSTOMERS', 'VEHICLES'].includes(payload.type)) {
    broadcastToWebSockets({ type: 'UPDATE', payload });
  }
});

ipcMain.on('p2p:send-full-state', (event, state) => {
  // Tento handler se volá když server renderer odpovídá na request o data pro nového klienta
  // V startP2PServer používáme ipcMain.once pro ten konkrétní WS socket
});

ipcMain.on('p2p:send-full-sync', (event, payload) => {
  console.log('P2P: Vysílám P2P_FULL_SYNC do sítě');
  broadcastToWebSockets({ type: 'P2P_FULL_SYNC', payload });
});

// Google Configuration
const REDIRECT_PORT = 3002;
const REDIRECT_URI = `http://127.0.0.1:${REDIRECT_PORT}`;
const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/gmail.readonly'
];

let oauth2Client = null;

// Helper to get Gmail instance
const getGmail = () => {
  if (!oauth2Client) throw new Error('Google klient není inicializován.');
  return google.gmail({ version: 'v1', auth: oauth2Client });
};

// IPC Handlers
ipcMain.handle('p2p:get-ip-address', () => {
  const os = require('os');
  const networkInterfaces = os.networkInterfaces();
  let foundIp = '127.0.0.1';
  
  for (const interfaceName of Object.keys(networkInterfaces)) {
    const interfaces = networkInterfaces[interfaceName];
    for (const iface of interfaces) {
      if (iface.family === 'IPv4' && !iface.internal) {
        if (iface.address.startsWith('192.168.') || iface.address.startsWith('10.') || iface.address.startsWith('172.')) {
          return iface.address;
        }
        foundIp = iface.address;
      }
    }
  }
  return foundIp;
});

ipcMain.handle('google:reset', () => {
  console.log('IPC: Přijat požadavek na [google:reset]');
  oauth2Client = null;
  return true;
});

ipcMain.handle('calendar:authenticate', async (event, { clientId, clientSecret }) => {
  console.log('IPC: Přijat požadavek na [calendar:authenticate]');
  console.log('--- Zahájení Google autorizace ---');
  
  oauth2Client = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);
  
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent'
  });

  console.log('Otevírám externí prohlížeč s URL:', authUrl);
  shell.openExternal(authUrl);

  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      console.log('Loopback server (3002) přijal požadavek:', req.url);
      
      try {
        const url = new URL(req.url, REDIRECT_URI);
        const code = url.searchParams.get('code');

        if (code) {
          console.log('Autorizační kód nalezen v URL');
          
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end('<h1>Autorizace byla úspěšná!</h1><p>Tuto stránku můžete nyní zavřít a vrátit se do aplikace.</p>');
          
          // Zavřeme server po krátké prodlevě, aby se stihla odeslat odpověď
          setTimeout(() => server.close(), 1000);

          console.log('Vyměňuji kód za tokeny...');
          const { tokens } = await oauth2Client.getToken(code);
          oauth2Client.setCredentials(tokens);
          console.log('Tokeny úspěšně získány. Vracím do Reactu.');
          resolve(tokens);
        } else {
          console.log('Požadavek neobsahuje autorizační kód. URL:', req.url);
          res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end('<h1>404 Not Found</h1><p>Tato adresa slouží pouze pro autorizaci Google Kalendáře.</p>');
        }
      } catch (e) {
        console.error('Chyba při zpracování požadavku na loopback serveru:', e);
        res.writeHead(500);
        res.end('Internal Server Error');
        // Do not reject here yet, let the timeout handle it or wait for next request
      }
    });

    server.on('error', (err) => {
      console.error('Chyba loopback serveru:', err);
      if (err.code === 'EADDRINUSE') {
        reject(new Error(`Port ${REDIRECT_PORT} je již obsazen. Google Sync nemůže naslouchat.`));
      } else {
        reject(err);
      }
    });

    server.listen(REDIRECT_PORT, '127.0.0.1', () => {
      console.log(`Loopback server aktivně naslouchá na http://127.0.0.1:${REDIRECT_PORT}`);
    });

    const timeout = setTimeout(() => {
      console.error('Časový limit pro autorizaci vypršel (10 min)');
      server.close();
      reject(new Error('Časový limit pro autorizaci vypršel.'));
    }, 600000);

    server.on('close', () => {
      clearTimeout(timeout);
    });
  });
});

ipcMain.handle('calendar:setTokens', (event, data) => {
  console.log('IPC: Přijat požadavek na [calendar:setTokens]');
  if (!data) {
    oauth2Client = null;
    return;
  }

  const { tokens, clientId, clientSecret } = data;
  
  if (!oauth2Client && clientId && clientSecret) {
    oauth2Client = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);
  }
  
  if (oauth2Client) {
    oauth2Client.setCredentials(tokens);
  }
});

ipcMain.handle('calendar:getEvents', async () => {
  console.log('IPC: Přijat požadavek na [calendar:getEvents]');
  if (!oauth2Client) throw new Error('Google klient není inicializován.');
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
  const response = await calendar.events.list({
    calendarId: 'primary',
    timeMin: (new Date()).toISOString(),
    maxResults: 250,
    singleEvents: true,
    orderBy: 'startTime',
  });
  return response.data.items;
});

ipcMain.handle('calendar:createEvent', async (event, gEvent) => {
  console.log('IPC: Přijat požadavek na [calendar:createEvent]');
  if (!oauth2Client) throw new Error('Google klient není inicializován.');
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
  try {
    const response = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: gEvent,
    });
    return response.data;
  } catch (error) {
    if (error.response && error.response.data) {
      console.error('DETAIL CHYBY Google API (Create):', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('CHYBA Google API (Create):', error.message || error);
    }
    throw error;
  }
});

ipcMain.handle('calendar:updateEvent', async (event, { eventId, gEvent }) => {
  console.log('IPC: Přijat požadavek na [calendar:updateEvent]');
  if (!oauth2Client) throw new Error('Google klient není inicializován.');
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
  try {
    const response = await calendar.events.update({
      calendarId: 'primary',
      eventId: eventId,
      requestBody: gEvent,
    });
    return response.data;
  } catch (error) {
    if (error.response && error.response.data) {
      console.error('DETAIL CHYBY Google API (Update):', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('CHYBA Google API (Update):', error.message || error);
    }
    throw error;
  }
});

ipcMain.handle('calendar:deleteEvent', async (event, eventId) => {
  console.log('IPC: Přijat požadavek na [calendar:deleteEvent]');
  if (!oauth2Client) throw new Error('Google klient není inicializován.');
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
  await calendar.events.delete({
    calendarId: 'primary',
    eventId,
  });
});

ipcMain.handle('gmail:listMessages', async (event, { labelId = 'INBOX', maxResults = 50 } = {}) => {
  console.log(`IPC: Přijat požadavek na [gmail:listMessages] pro složku: ${labelId}`);
  const gmail = getGmail();
  try {
    const response = await gmail.users.messages.list({
      userId: 'me',
      maxResults: maxResults,
      q: `label:${labelId}`
    });

    if (!response.data.messages) return [];

    const messages = await Promise.all(response.data.messages.map(async (msg) => {
      const detail = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id,
        format: 'metadata',
        metadataHeaders: ['From', 'Subject', 'Date']
      });

      const headers = detail.data.payload.headers;
      const findHeader = (name) => headers.find(h => h.name === name)?.value || '';

      return {
        id: detail.data.id,
        threadId: detail.data.threadId,
        from: findHeader('From'),
        subject: findHeader('Subject'),
        date: findHeader('Date'),
        timestamp: parseInt(detail.data.internalDate),
        snippet: detail.data.snippet
      };
    }));

    return messages;
  } catch (error) {
    console.error('CHYBA Google Gmail API (List):', error.message || error);
    if (error.code === 403 || (error.message && error.message.includes('Insufficient Permission'))) {
      throw new Error('GMAIL_INSUFFICIENT_SCOPE');
    }
    throw error;
  }
});

ipcMain.handle('gmail:getMessageDetail', async (event, messageId) => {
  console.log('IPC: Přijat požadavek na [gmail:getMessageDetail]');
  const gmail = getGmail();
  try {
    const detail = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full'
    });

    const headers = detail.data.payload.headers;
    const findHeader = (name) => headers.find(h => h.name === name)?.value || '';

    let body = '';
    const extractBody = (payload) => {
      if (payload.body && payload.body.data) {
        return Buffer.from(payload.body.data, 'base64').toString('utf-8');
      }
      if (payload.parts) {
        // Prefer text/plain if available, otherwise take the first part
        const plainTextPart = payload.parts.find(p => p.mimeType === 'text/plain');
        if (plainTextPart) return extractBody(plainTextPart);
        
        const htmlPart = payload.parts.find(p => p.mimeType === 'text/html');
        if (htmlPart) return extractBody(htmlPart);

        return extractBody(payload.parts[0]);
      }
      return '';
    };

    body = extractBody(detail.data.payload);

    const attachments = [];
    const scanAttachments = (parts) => {
      if (!parts) return;
      parts.forEach(part => {
        if (part.filename && part.body && part.body.attachmentId) {
          attachments.push({
            id: part.body.attachmentId,
            filename: part.filename,
            mimeType: part.mimeType,
            size: part.body.size
          });
        }
        if (part.parts) scanAttachments(part.parts);
      });
    };

    scanAttachments(detail.data.payload.parts);

    return {
      id: detail.data.id,
      threadId: detail.data.threadId,
      from: findHeader('From'),
      subject: findHeader('Subject'),
      date: findHeader('Date'),
      timestamp: parseInt(detail.data.internalDate),
      snippet: detail.data.snippet,
      body: body,
      attachments: attachments
    };
  } catch (error) {
    console.error('CHYBA Google Gmail API (Detail):', error.message || error);
    throw error;
  }
});

ipcMain.handle('gmail:getAttachment', async (event, { messageId, attachmentId }) => {
  console.log(`IPC: Přijat požadavek na [gmail:getAttachment] pro zprávu: ${messageId}`);
  const gmail = getGmail();
  try {
    const response = await gmail.users.messages.attachments.get({
      userId: 'me',
      messageId: messageId,
      id: attachmentId
    });
    return response.data.data; // Base64 encoded
  } catch (error) {
    console.error('CHYBA Google Gmail API (Attachment):', error.message || error);
    throw error;
  }
});

// Portable Attachments Handlers
ipcMain.handle('attachment:upload', async (event, { type, identifier, fileName, fileData }) => {
  try {
    // Definujeme kořen aplikace (pro portable verzi v rámci složky s EXE)
    const appRootDir = app.isPackaged ? path.dirname(app.getPath('exe')) : app.getAppPath();
    const baseDir = path.join(appRootDir, 'Priloha');
    
    // Určíme podsložku
    let typeDir = '';
    let itemDirName = '';

    if (type === 'vehicle') {
      typeDir = 'Vozidla';
      itemDirName = identifier;
    } else if (type === 'customer') {
      typeDir = 'Zakaznici';
      itemDirName = identifier;
    } else if (type === 'invoice') {
      typeDir = 'Faktury';
      itemDirName = ''; // Faktury jdou do jednoho kořene
    } else if (type === 'order') {
      typeDir = 'Zakázky';
      itemDirName = ''; // Zakázky jdou do jednoho kořene
    }
    
    const targetDir = path.join(baseDir, typeDir, itemDirName);
    
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const filePath = path.join(targetDir, fileName);
    fs.writeFileSync(filePath, Buffer.from(fileData));

    const stats = fs.statSync(filePath);
    
    // Spočítáme relativní cestu vůči kořenu aplikace
    const relativePath = path.relative(appRootDir, filePath);
    
    return {
      id: Math.random().toString(36).substr(2, 9),
      name: fileName,
      size: (stats.size / 1024 / 1024).toFixed(2) + ' MB',
      uploadDate: new Date().toISOString(),
      relativePath: relativePath
    };
  } catch (error) {
    console.error('CHYBA při nahrávání přílohy:', error);
    throw error;
  }
});

ipcMain.handle('attachment:open', async (event, relativePath) => {
  const appRootDir = app.isPackaged ? path.dirname(app.getPath('exe')) : app.getAppPath();
  const absolutePath = path.join(appRootDir, relativePath);
  return await shell.openPath(absolutePath);
});

ipcMain.handle('attachment:delete', async (event, relativePath) => {
  try {
    const appRootDir = app.isPackaged ? path.dirname(app.getPath('exe')) : app.getAppPath();
    const absolutePath = path.join(appRootDir, relativePath);
    if (fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
      return true;
    }
    return false;
  } catch (error) {
    console.error('CHYBA při mazání přílohy:', error);
    throw error;
  }
});

// Handle external links
ipcMain.on('open-external', (event, url) => {
  shell.openExternal(url);
});

// Přesměrování na localhost v dev režimu (Vite port 3000)
// V produkci načítá z build složky
function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 2560,
    height: 1440,
    minWidth: 1920,
    minHeight: 1080,
    title: "Autoservis Roháček",
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // PŘIDEJ: Důležité pro Google OAuth
      webviewTag: true,    // MÁŠ: Pro E-shop
    },
  });

  // OPRAVA PRO EXE: Aby to nehledalo VITE_DEV_SERVER, který v EXE neexistuje
 const indexPath = path.join(__dirname, 'dist', 'index.html');
  mainWindow.loadFile(indexPath).catch(err => {
    console.error("Chyba při načítání:", err);
  });

  // TADY TO VLOŽ:
  mainWindow.webContents.openDevTools();

  if (process.env.NODE_ENV !== 'development') {
    mainWindow.removeMenu();
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
