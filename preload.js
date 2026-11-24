const { contextBridge, ipcRenderer } = require('electron');

// Zde můžeš definovat API pro komunikaci mezi Reactem a Electronem
contextBridge.exposeInMainWorld('electronAPI', {
  // Příklad: uložení dat lokálně
  saveData: (data) => ipcRenderer.send('save-data', data),
  openExternal: (url) => ipcRenderer.send('open-external', url),
  calendar: {
    authenticate: (credentials) => ipcRenderer.invoke('calendar:authenticate', credentials),
    setTokens: (tokens) => ipcRenderer.invoke('calendar:setTokens', tokens),
    getEvents: () => ipcRenderer.invoke('calendar:getEvents'),
    createEvent: (gEvent) => ipcRenderer.invoke('calendar:createEvent', gEvent),
    updateEvent: (eventId, gEvent) => ipcRenderer.invoke('calendar:updateEvent', { eventId, gEvent }),
    deleteEvent: (eventId) => ipcRenderer.invoke('calendar:deleteEvent', eventId),
  },
  google: {
    reset: () => ipcRenderer.invoke('google:reset'),
  },
  gmail: {
    listMessages: (options) => ipcRenderer.invoke('gmail:listMessages', options),
    getMessageDetail: (messageId) => ipcRenderer.invoke('gmail:getMessageDetail', messageId),
    getAttachment: (data) => ipcRenderer.invoke('gmail:getAttachment', data),
  },
  attachment: {
    upload: (data) => ipcRenderer.invoke('attachment:upload', data),
    open: (path) => ipcRenderer.invoke('attachment:open', path),
    delete: (path) => ipcRenderer.invoke('attachment:delete', path),
  },
  p2p: {
    updateSettings: (config) => ipcRenderer.send('p2p:update-settings', config),
    broadcastUpdate: (data) => ipcRenderer.send('p2p:broadcast-update', data),
    sendFullState: (state) => ipcRenderer.send('p2p:send-full-state', state),
    onUpdateReceived: (callback) => ipcRenderer.on('p2p:update-received', (event, data) => callback(data)),
    onInitDumpReceived: (callback) => ipcRenderer.on('p2p:init-dump-received', (event, data) => callback(data)),
    onFullSyncReceived: (callback) => ipcRenderer.on('p2p:full-sync-received', (event, data) => callback(data)),
    onRequestFullState: (callback) => ipcRenderer.on('p2p:request-full-state', () => callback()),
    onRequestSyncFromNetwork: (callback) => ipcRenderer.on('p2p:request-sync-from-network', () => callback()),
    sendFullSync: (payload) => ipcRenderer.send('p2p:send-full-sync', payload),
    onRequestSettings: (callback) => ipcRenderer.on('p2p:request-settings', () => callback()),
    getIpAddress: () => ipcRenderer.invoke('p2p:get-ip-address'),
  },
  bluetooth: {
    updatePort: (portName) => ipcRenderer.send('bluetooth:update-port', portName),
    onMobileCheckInReceived: (callback) => {
      const listener = (event, data) => callback(data);
      ipcRenderer.on('bluetooth:mobile-checkin', listener);
      return () => ipcRenderer.removeListener('bluetooth:mobile-checkin', listener);
    }
  }
});
