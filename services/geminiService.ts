
import { GoogleGenAI, Type } from "@google/genai";
import { Vehicle, ServiceRecord, PartItem } from "../types";

/**
 * Robustní inicializace Gemini AI pro web i Electron.
 * Electron tip: Pokud PDF importy v EXE nefungují kvůli CORS, 
 * vypněte webSecurity v main.js: new BrowserWindow({ webPreferences: { webSecurity: false } })
 */
const getAi = () => {
  // Prioritní pořadí pro načtení klíče (localStorage -> Vite -> process.env -> fallback)
  const localStorageKey = typeof window !== 'undefined' ? localStorage.getItem('gemini_api_key') : null;
  
  const apiKey = 
    localStorageKey ||
    (import.meta as any).env?.VITE_GEMINI_API_KEY || 
    process.env.GEMINI_API_KEY || 
    process.env.API_KEY;

  if (!apiKey) {
    console.warn("Gemini API Key nebyl nalezen. AI funkce nebudou fungovat.");
  }
  
  return new GoogleGenAI({ apiKey: apiKey || '' });
};

export const getMaintenanceAdvice = async (vehicle: Vehicle, history: ServiceRecord[]) => {
  const ai = getAi();
  const prompt = `Jsi expertní automechanik. Navrhni plán údržby pro vozidlo:
  Model: ${vehicle.make} ${vehicle.model}
  Rok: ${vehicle.year}
  Najeto: ${vehicle.mileage} km
  Kód motoru: ${vehicle.engineCode}
  Barva: ${vehicle.color}
  Poslední úkony: ${JSON.stringify(history.map(h => h.description))}

  Odpověz v češtině, stručně v bodech. Zaměř se na blížící se servisní intervaly a specifika pro kód motoru ${vehicle.engineCode}.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Nepodařilo se načíst AI doporučení.";
  }
};

export const diagnoseProblem = async (problemDescription: string, vehicleInfo: string) => {
  const ai = getAi();
  const prompt = `Diagnostika závady pro vozidlo (${vehicleInfo}). 
  Symptomy popsané mechanikem: "${problemDescription}".
  
  Uveď 3 nejpravděpodobnější příčiny a doporučené kroky kontroly. Odpověz v češtině.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("Gemini Error:", error);
    return "AI diagnostika je momentálně nedostupná.";
  }
};

export const analyzeExcelParts = async (jsonData: any[], _isVatPayer: boolean): Promise<Partial<PartItem>[]> => {
  const ai = getAi();
  const priceType = "ceny VČETNĚ DPH (21 %)";
  
  const prompt = `Z následujících dat z Excelu extrahuj seznam náhradních dílů. 
  Hledej názvy dílů, množství, nákupní cenu a běžnou (koncovou) cenu pro zákazníka. 
  Pokud běžná cena v datech není, navrhni ji s přiměřenou marží (cca 25-30 %) k nákupní ceně.
  Data: ${JSON.stringify(jsonData.slice(0, 100))}
  Všechny částky musí být ${priceType}.
  Vrať čistý seznam objektů s vlastnostmi: description, quantity, costPrice (nákup), unitPrice (běžná cena).`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              description: { type: Type.STRING },
              quantity: { type: Type.NUMBER },
              costPrice: { type: Type.NUMBER, description: "Nákupní cena za jednotku" },
              unitPrice: { type: Type.NUMBER, description: "Běžná (koncová) cena za jednotku" }
            },
            required: ["description", "quantity", "costPrice", "unitPrice"]
          }
        }
      }
    });
    
    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error("Gemini Excel Error:", error);
    return [];
  }
};

export const analyzePdfParts = async (base64Data: string, _isVatPayer: boolean): Promise<Partial<PartItem>[]> => {
  const ai = getAi();
  const priceType = "ceny VČETNĚ DPH (21 %)";
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "application/pdf",
              data: base64Data,
            },
          },
          {
            text: `Z tohoto PDF dokumentu extrahuj seznam položek. 
            Hledej: název dílu, množství, nákupní cenu a běžnou (koncovou) cenu pro zákazníka.
            Pokud běžná cena v dokumentu chybí (typické pro dodací listy), vypočítej ji jako nákupní cenu + 30 % marži.
            Všechny částky uveď jako ${priceType}.
            Vrať výhradně JSON pole objektů s klíči: description, quantity, costPrice (nákup), unitPrice (běžná cena).`,
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              description: { type: Type.STRING },
              quantity: { type: Type.NUMBER },
              costPrice: { type: Type.NUMBER, description: "Nákupní cena za jednotku" },
              unitPrice: { type: Type.NUMBER, description: "Běžná (koncová) cena za jednotku" }
            },
            required: ["description", "quantity", "costPrice", "unitPrice"]
          }
        }
      }
    });
    
    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error("Gemini PDF Error:", error);
    return [];
  }
};

export const analyzeCostsFromDocument = async (
  fileData: string | any[], 
  isPdf: boolean
): Promise<{ code: string; description: string; costWithDph: number }[]> => {
  const ai = getAi();
  
  const instruction = isPdf 
    ? `Jsi expertní analytik faktur. Analyzuj tuto PDF fakturu od dodavatele autodílů.
       Pro každou jednotlivou položku najdi:
       1. "objednací kód" (může být "Kód", "Obj. kód", "Číslo dílu" nebo podobně)
       2. "popis" (název dílu)
       3. "vase cena s dph" (toto je nákupní cena pro servis, hledej sloupec který semantic odpovídá nákupní ceně včetně DPH).
       Vrať pole JSON s těmito klíči: "code", "description", "costWithDph".
       Důležité: Extrahuj pouze skutečné položky/díly.`
    : `Jsi expertní analytik dat. Analyzuj tento seznam z Excelu.
       Pro každou položku najdi:
       1. "id položky" (unikátní identifikátor/kód dílu)
       2. "popis" (název dílu)
       3. "Nákupní cena celkem vč. DPH" (pořizovací cena celkem za daný řádek včetně daně).
       Data k analýze: ${JSON.stringify(fileData).slice(0, 8000)}
       Vrať pole JSON s klíči: "code", "description", "costWithDph".`;

  try {
    const contents = isPdf 
      ? { parts: [{ inlineData: { mimeType: "application/pdf", data: fileData as string } }, { text: instruction }] }
      : instruction;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: contents,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              code: { type: Type.STRING, description: "Identifikátor kód" },
              description: { type: Type.STRING, description: "Popis položky" },
              costWithDph: { type: Type.NUMBER, description: "Cena včetně DPH" }
            },
            required: ["code", "description", "costWithDph"]
          }
        }
      }
    });

    const result = JSON.parse(response.text || "[]");
    return result;
  } catch (error) {
    console.error("Gemini Cost Analysis Error:", error);
    return [];
  }
};

/**
 * Checks if the Gemini API key is configured.
 */
export const checkGeminiKeyConfigured = (): boolean => {
  const localStorageKey = typeof window !== 'undefined' ? localStorage.getItem('gemini_api_key') : null;
  const apiKey = 
    localStorageKey ||
    (import.meta as any).env?.VITE_GEMINI_API_KEY || 
    process.env.GEMINI_API_KEY || 
    process.env.API_KEY;
  return !!apiKey;
};

// Helper functions for pruning database to minimize token counts and prevent 429 RESOURCE_EXHAUSTED errors
const pruneCustomers = (rawCustomers: any[]): any[] => {
  if (!Array.isArray(rawCustomers)) return [];
  return rawCustomers.map(c => {
    const name = c.companyName || `${c.firstName || ''} ${c.lastName || ''}`.trim();
    return {
      id: c.id,
      name: name || "Neznámý zákazník",
      phone: c.phone || "",
      email: c.email || ""
    };
  });
};

const pruneVehicles = (rawVehicles: any[]): any[] => {
  if (!Array.isArray(rawVehicles)) return [];
  return rawVehicles.map(v => ({
    id: v.id,
    make: v.make || "",
    model: v.model || "",
    licensePlate: v.licensePlate || "",
    vin: v.vin || "",
    year: v.year || ""
  }));
};

const pruneOrders = (rawOrders: any[]): any[] => {
  if (!Array.isArray(rawOrders)) return [];
  return rawOrders.map(o => ({
    id: o.id,
    vehicleId: o.vehicleId,
    date: o.date,
    description: o.description || "",
    status: o.status || "",
    mileageAtEntry: o.mileageAtEntry || 0,
    parts: Array.isArray(o.parts) ? o.parts.map((p: any) => p.description || p.name || "").filter(Boolean) : []
  }));
};

/**
 * Chat function for KANAS (KANcelářský ASistent).
 * Compiles a rich dynamic context from local lists (or localStorage fallbacks)
 * and sends it along with the developer system prompt.
 */
export const askKanas = async (
  userMessage: string,
  customers: any[],
  vehicles: any[],
  orders: any[]
): Promise<string> => {
  const ai = getAi();

  const rawCustomersList = customers && customers.length > 0 ? customers : JSON.parse(localStorage.getItem('autoservis_customers') || localStorage.getItem('customers') || '[]');
  const rawVehiclesList = vehicles && vehicles.length > 0 ? vehicles : JSON.parse(localStorage.getItem('autoservis_vehicles') || localStorage.getItem('vehicles') || '[]');
  const rawOrdersList = orders && orders.length > 0 ? orders : JSON.parse(localStorage.getItem('autoservis_orders') || localStorage.getItem('services') || '[]');

  // Prune data to minimize token count
  const optimizedCustomers = pruneCustomers(rawCustomersList);
  const optimizedVehicles = pruneVehicles(rawVehiclesList);
  const optimizedOrders = pruneOrders(rawOrdersList);

  // Compress to ultra-tight minified JSON strings
  const customersJSON = JSON.stringify(optimizedCustomers);
  const vehiclesJSON = JSON.stringify(optimizedVehicles);
  const ordersJSON = JSON.stringify(optimizedOrders);

  const dynamicCurrentTime = new Date().toISOString();
  const formatCzechDate = new Date().toLocaleString('cs-CZ');

  const systemInstructions = `Jsi KANAS (KANcelářský ASistent) integrovaný v ERP systému Autoservisu Roháček. Tvým úkolem je pomáhat mechanikovi s bleskovou analýzou dat, vyhledáváním v historii, filtrováním a spouštěním akcí. Mluvíš striktně věcně, stručně, technicky a používáš spisovnou češtinu. Tykáš uživateli. Odpovídáš výhradně na základě reálných dat servisu, která ti posílám níže. Pokud data odpověď neobsahují, jasně to uveď.
Zde jsou aktuální data z LocalStorage:
ZÁKAZNÍCI: ${customersJSON}
VOZIDLA: ${vehiclesJSON}
ZAKÁZKY: ${ordersJSON}

Aktuální čas a datum (pro časové relace): ${formatCzechDate} (v ISO: ${dynamicCurrentTime}).

Můžeš také iniciovat akce v systému pomocí skrytých tagů na úplném začátku své odpovědi. 
Pokud z kontextu jednoznačně identifikuješ jedno konkrétní vozidlo a uživatel tě výslovně požádá o založení zakázky nebo přidání schůzky/události do kalendáře, vlož na úplný začátek své odpovědi příslušný tag.

Podporované tagy příkazů:
1. Založení zakázky (CREATE_ORDER):
[[CMD:CREATE_ORDER|vehicleId:ID_VOZIDLA|date:YYYY-MM-DDTHH:MM|text:Stručný popis práce]]
2. Zápis do kalendáře (CALENDAR_EVENT):
[[CMD:CALENDAR_EVENT|title:Název události (např. Výměna brzd - RZ)|date:YYYY-MM-DDTHH:MM|description:Popis schůzky|vehicleId:ID_VOZIDLA_POKUD_EXISTUJE]]

Rozhodovací scénáře při požadavku na akci (zakázka/kalendář):
- Scénář A (Právě jedno nalezené auto): Pokud uživatel napíše např. "Založ zakázku na zítra na 10:00 pro pana Nováka na výměnu oleje" a v systému najdeš právě jednoho Nováka s právě jedním vozem (např. id "veh-111"), vygeneruješ skrytý tag na úplném začátku své odpovědi (např. [[CMD:CREATE_ORDER|vehicleId:veh-111|date:2026-05-26T10:00|text:Výměna oleje]] a k tomu přidáš věcné textové potvrzení).
- Scénář B (Více aut nebo nejasnost): Pokud zákazník s daným jménem vlastní vícero vozů, nebo existuje více zákazníků se stejným jménem, příkaz NESPOUŠTĚJ. Místo toho vypiš všechny dotčené vozy a zeptej se, na které vozidlo chce uživatel akci provést. Příklad: „Našel jsem 3 vozidla registrovaná na jméno Novák (Škoda RZ 3AI 5595, VW RZ 1US 9802). Na které z těchto vozidel mám zakázku založit?“
- Scénář C (Neznámý zákazník/auto): Pokud zákazníka nebo vůz v datech vůbec nenajdeš, příkaz NESPOUŠTĚJ. Odpověz: „Tento zákazník/vozidlo nebylo v databázi nalezeno. Chceš nejdříve založit novou kartu vozidla?“

Ujisti se, že tagy jsou zapsány přesně v uvedeném formátu bez překlepů a na samém začátku tvé zprávy. Jako datum použij správně vypočítaný čas vůči aktuálnímu času, který ti uvádím výše.

Analyzuj tato data, srozumitelně odpověz na dotaz uživatele a případně přidej příslušný tag.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: userMessage,
      config: {
        systemInstruction: systemInstructions,
      },
    });

    return response.text || "Omlouvám se, nepodařilo se mi získat odpověď.";
  } catch (error: any) {
    console.error("KANAS Error:", error);
    const errMsg = (error?.message || String(error)).toLowerCase();
    if (
      errMsg.includes("429") || 
      errMsg.includes("resource_exhausted") || 
      errMsg.includes("quota") || 
      errMsg.includes("limit")
    ) {
      return "Databáze je pro bezplatný tarif příliš velká. KANAS doporučuje zopakovat dotaz za 10 vteřin nebo přejít na placený klíč Gemini Pay-as-you-go.";
    }
    return `Chyba při komunikaci s asistentem KANAS: ${error.message || error}`;
  }
};

