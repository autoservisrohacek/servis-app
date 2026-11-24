
/**
 * RSV Service - Propojení s Registrem silničních vozidel (api.dataovozidlech.cz)
 */

export interface RsvVehicleData {
  TovarniZnacka: string;
  ObchodniOznaceni: string;
  MotorTyp: string;
  MotorMaxVykon?: string;
  VozidloKaroserieDruh?: string;
  Palivo?: string;
  VozidloKaroserieBarva: string;
  PravidelnaTechnickaProhlidkaDo: string; // ISO date string
  RokVyroby?: number;
}

export const fetchVehicleFromRsv = async (vin: string, apiKey: string, proxyUrl?: string): Promise<RsvVehicleData | null> => {
  if (!apiKey) throw new Error("Chybí RSV API klíč v nastavení systému.");
  
  const targetUrl = `https://api.dataovozidlech.cz/api/vehicletechnicaldata/v2?vin=${vin.trim().toUpperCase()}`;
  
  let url = targetUrl;
  if (proxyUrl && proxyUrl.trim().length > 0) {
    const cleanProxy = proxyUrl.trim();
    if (cleanProxy.endsWith('?')) {
      url = `${cleanProxy}${targetUrl}`;
    } else {
      url = `${cleanProxy.replace(/\/$/, '')}/${targetUrl}`;
    }
  }
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'API_KEY': apiKey,
        'x-api-key': apiKey, // Některé proxy vyžadují tento název hlavičky
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      if (response.status === 401) throw new Error("Neplatný RSV API klíč.");
      if (response.status === 429) throw new Error("Překročen limit dotazů na API RSV (Rate Limit).");
      if (response.status === 404) return null;
      throw new Error(`Chyba API RSV: ${response.status} ${response.statusText}`);
    }

    const json = await response.json();
    
    // API v2 vrací data v objektu json.Data
    const vehicleData = json.Data || json;
    
    if (vehicleData && (vehicleData.TovarniZnacka || vehicleData.ObchodniOznaceni)) {
      return vehicleData as RsvVehicleData;
    }
    
    // Pokud je Status 1, ale Data chybí, zkusíme prohledat celý objekt
    if (json.Status === 1 && !json.Data) {
       return null;
    }
    
    return null;
  } catch (error: any) {
    console.error("RSV Fetch Error Detail:", error);
    
    const isNetworkError = error instanceof TypeError || (error.message && (error.message.includes("fetch") || error.message.includes("NetworkError")));
    
    if (isNetworkError) {
      throw new Error(
        "Chyba spojení (CORS/Network). Prohlížeč blokuje přímý přístup k API. " +
        "Zkuste v Nastavení nastavit 'CORS Proxy URL' na: https://corsproxy.io/?"
      );
    }
    
    throw error;
  }
};
