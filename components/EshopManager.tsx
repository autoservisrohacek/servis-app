import React, { useState, useRef, useEffect } from 'react';
import { ShoppingCart, ArrowLeft, ArrowRight, RotateCw, ExternalLink, Loader2, Home, Globe } from 'lucide-react';
import { UserShop } from '../types';

interface EshopManagerProps {
  isVisible: boolean;
  vinToSearch?: string | null;
  onSearchHandled?: () => void;
  userShops: UserShop[];
}

const EshopManager: React.FC<EshopManagerProps> = ({ isVisible, vinToSearch, onSearchHandled, userShops }) => {
  const [activeShopId, setActiveShopId] = useState<string>('');
  const [isLoading, setIsLoading] = useState<{ [key: string]: boolean }>({});
  const webviewRefs = useRef<{ [key: string]: any }>({});
  const [isElectron, setIsElectron] = useState(false);

  useEffect(() => {
    // Check if we are in Electron
    const userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.indexOf(' electron/') > -1) {
      setIsElectron(true);
    }

    if (userShops.length > 0 && !activeShopId) {
      setActiveShopId(userShops[0].id);
    }
  }, []);

  // Sync shops when visibility changes (to catch changes from Settings)
  useEffect(() => {
    if (isVisible) {
      // If active shop was deleted, switch to the first available
      if (activeShopId && !userShops.some(s => s.id === activeShopId)) {
        if (userShops.length > 0) {
          setActiveShopId(userShops[0].id);
        } else {
          setActiveShopId('');
        }
      } else if (!activeShopId && userShops.length > 0) {
        setActiveShopId(userShops[0].id);
      }
    }
  }, [isVisible, userShops]);

  // Sync shops if they change in localStorage (e.g. from Settings while visible)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'user_shops' || !e.key) {
        // App.tsx handles this now via props
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const handleGoBack = () => {
    const webview = webviewRefs.current[activeShopId];
    if (isElectron && webview) {
      webview.canGoBack() && webview.goBack();
    }
  };

  const handleGoForward = () => {
    const webview = webviewRefs.current[activeShopId];
    if (isElectron && webview) {
      webview.canGoForward() && webview.goForward();
    }
  };

  const handleRefresh = () => {
    const webview = webviewRefs.current[activeShopId];
    if (isElectron && webview) {
      webview.reload();
    }
  };

  useEffect(() => {
    if (isVisible && vinToSearch && activeShopId === 'lkq' && isElectron) {
      const webview = webviewRefs.current['lkq'];
      if (webview) {
        console.log('🤖 EshopManager: Triggering VIN search for:', vinToSearch);
        executeVinSearch(webview, vinToSearch);
        onSearchHandled?.();
      }
    }
  }, [isVisible, vinToSearch, activeShopId, isElectron]);

  const executeVinSearch = (webview: any, vin: string) => {
    const script = `
      (function() {
        console.log('🤖 Robot: Hledám pole pro vyhledávání VIN...');
        let attempts = 0;
        const maxAttempts = 10;
        const interval = setInterval(() => {
          attempts++;
          const searchInput = document.querySelector('#searchSource');
          if (searchInput) {
            clearInterval(interval);
            console.log('🤖 Robot: Pole nalezeno, vkládám VIN: ${vin}');
            searchInput.focus();
            searchInput.value = '${vin}';
            
            // Trigger events
            const events = ['input', 'change', 'blur'];
            events.forEach(eventName => {
              const event = new Event(eventName, { bubbles: true });
              searchInput.dispatchEvent(event);
            });

            // Simulate Enter
            setTimeout(() => {
              searchInput.dispatchEvent(new KeyboardEvent('keydown', { 
                key: 'Enter', 
                keyCode: 13, 
                code: 'Enter',
                which: 13,
                bubbles: true 
              }));
              
              // Fallback: Click search button
              setTimeout(() => {
                const searchBtn = document.querySelector('.js-main-search-submit');
                if (searchBtn) {
                   console.log('🤖 Robot: Klikám na lupu (fallback)...');
                   searchBtn.click();
                }
              }, 500);
            }, 200);
          } else if (attempts >= maxAttempts) {
            clearInterval(interval);
            console.warn('🤖 Robot: Pole pro vyhledávání VIN nebylo nalezeno ani po 5s.');
          }
        }, 500);
      })();
    `;
    webview.executeJavaScript(script);
  };

  const handleGoHome = () => {
    const activeShop = userShops.find(s => s.id === activeShopId);
    const webview = webviewRefs.current[activeShopId];
    if (isElectron && webview && activeShop) {
      webview.loadURL(activeShop.url);
    }
  };

  const handleOpenExternal = () => {
    const webview = webviewRefs.current[activeShopId];
    const activeShop = userShops.find(s => s.id === activeShopId);
    const currentUrl = isElectron && webview ? webview.getURL() : (activeShop?.url || '');
    if (currentUrl) window.open(currentUrl, '_blank');
  };

  const handleLoadStart = (id: string) => {
    setIsLoading(prev => ({ ...prev, [id]: true }));
  };

  const handleLoadStop = (id: string) => {
    setIsLoading(prev => ({ ...prev, [id]: false }));
  };

  return (
    <div className={`flex flex-col h-full bg-white border border-slate-200 shadow-sm overflow-hidden w-full ${isVisible ? 'flex' : 'hidden'}`}>
      {/* Header / Navigation */}
      <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col gap-4 w-full">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 shrink-0">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200">
              <ShoppingCart className="w-6 h-6" />
            </div>
            <div className="hidden sm:block">
              <h2 className="text-sm font-black text-slate-900 uppercase italic tracking-tight">E-shopy dodavatelů</h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Prohlížeč s historií přihlášení</p>
            </div>
          </div>

          {/* Shop Switcher */}
          <div className="flex-1 flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
            {userShops.map(shop => (
              <button
                key={shop.id}
                onClick={() => setActiveShopId(shop.id)}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border-2 ${
                  activeShopId === shop.id 
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-100' 
                    : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300'
                }`}
              >
                {shop.name}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <button 
                onClick={handleGoBack}
                title="Zpět"
                className="p-2.5 text-slate-500 hover:bg-slate-50 hover:text-indigo-600 transition-colors border-r border-slate-100"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <button 
                onClick={handleGoForward}
                title="Vpřed"
                className="p-2.5 text-slate-500 hover:bg-slate-50 hover:text-indigo-600 transition-colors border-r border-slate-100"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
              <button 
                onClick={handleGoHome}
                title="Domů"
                className="p-2.5 text-slate-500 hover:bg-slate-50 hover:text-indigo-600 transition-colors border-r border-slate-100"
              >
                <Home className="w-4 h-4" />
              </button>
              <button 
                onClick={handleRefresh}
                title="Obnovit"
                className="p-2.5 text-slate-500 hover:bg-slate-50 hover:text-indigo-600 transition-colors"
              >
                <RotateCw className={`w-4 h-4 ${isLoading[activeShopId] ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <button 
              onClick={handleOpenExternal}
              className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-600 hover:border-indigo-600 hover:text-indigo-600 transition-all shadow-sm"
              title="Otevřít v prohlížeči"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Content Area - Multiple webviews rendered to persist state */}
      <div className="flex-1 relative bg-slate-100/50 w-full" style={{ height: 'calc(100vh - 180px)' }}>
        {userShops.map(shop => (
          <div 
            key={shop.id} 
            className={`w-full h-full absolute inset-0 ${activeShopId === shop.id ? 'block' : 'hidden'}`}
          >
            {isLoading[shop.id] && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm transition-opacity duration-300">
                <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
                <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Načítám {shop.name}...</p>
              </div>
            )}

            {isElectron ? (
              <webview 
                ref={el => webviewRefs.current[shop.id] = el}
                src={shop.url} 
                className="w-full h-full"
                allowpopups="true"
                partition="persist:shops"
                style={{ width: '100%', height: '100%' }}
                onDidStartLoading={() => handleLoadStart(shop.id)}
                onDidStopLoading={() => handleLoadStop(shop.id)}
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center p-12 text-center bg-white">
                <Globe className="w-16 h-16 text-slate-200 mb-6" />
                <h3 className="text-xl font-black text-slate-900 uppercase italic mb-2 tracking-tight">Prohlížeč e-shopů je aktivní pouze v aplikaci (Electron)</h3>
                <p className="text-slate-400 font-bold max-w-md mx-auto">V běžném prohlížeči není možné z bezpečnostních důvodů e-shopy integrovat. Stáhněte si naši stolní aplikaci.</p>
                <a 
                  href={shop.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="mt-8 px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 inline-flex items-center gap-2"
                >
                  <ExternalLink className="w-4 h-4" /> Otevřít {shop.name} v novém okně
                </a>
              </div>
            )}
          </div>
        ))}
        
        {userShops.length === 0 && (
          <div className="w-full h-full flex flex-col items-center justify-center p-12 text-center bg-white">
            <ShoppingCart className="w-16 h-16 text-slate-200 mb-6" />
            <h3 className="text-xl font-black text-slate-900 uppercase italic mb-2 tracking-tight">Žádné e-shopy nastaveny</h3>
            <p className="text-slate-400 font-bold max-w-md mx-auto">Přidejte si své oblíbené dodavatele v nastavení aplikace.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default EshopManager;
