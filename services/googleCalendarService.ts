
import { CalendarEvent, Vehicle, Customer } from '../types';

class GoogleCalendarService {
  private isElectron = typeof window !== 'undefined' && (window as any).electronAPI !== undefined;

  constructor() {
    // Load saved tokens and set them in main process
    if (this.isElectron) {
      const savedTokens = localStorage.getItem('google_calendar_tokens');
      const clientId = localStorage.getItem('google_client_id');
      const clientSecret = localStorage.getItem('google_client_secret');
      
      if (savedTokens && clientId && clientSecret) {
        (window as any).electronAPI.calendar.setTokens({ 
          tokens: JSON.parse(savedTokens),
          clientId,
          clientSecret
        });
      }
    }
  }

  isAuthenticated(): boolean {
    const tokens = localStorage.getItem('google_calendar_tokens');
    return !!tokens;
  }

  async authenticate(): Promise<void> {
    if (!this.isElectron) {
      throw new Error('Google Calendar synchronizace vyžaduje aplikaci Electron.');
    }

    const clientId = localStorage.getItem('google_client_id');
    const clientSecret = localStorage.getItem('google_client_secret');

    if (!clientId || !clientSecret) {
      throw new Error('Chybí konfigurace Google API v nastavení.');
    }

    try {
      const tokens = await (window as any).electronAPI.calendar.authenticate({ clientId, clientSecret });
      if (tokens) {
        localStorage.setItem('google_calendar_tokens', JSON.stringify(tokens));
      }
    } catch (error) {
      console.error('Auth error:', error);
      throw error;
    }
  }

  async getEvents(): Promise<CalendarEvent[]> {
    if (!this.isAuthenticated() || !this.isElectron) return [];

    try {
      const gEvents = await (window as any).electronAPI.calendar.getEvents();
      return gEvents.map((gEvent: any) => this.mapGoogleToLocal(gEvent));
    } catch (error) {
      console.error('Error fetching Google events:', error);
      return [];
    }
  }

  async createEvent(event: CalendarEvent, vehicle?: Vehicle, customer?: Customer): Promise<string | undefined> {
    if (!this.isAuthenticated() || !this.isElectron) return;

    const summary = this.formatSummary(event, vehicle, customer);
    const description = this.formatDescription(event, vehicle, customer);

    const gEvent = {
      summary,
      description,
      start: {
        dateTime: new Date(event.startDate).toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      end: {
        dateTime: new Date(event.endDate).toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      colorId: this.mapLocalColorToGoogle(event.color),
    };

    try {
      console.log('Odesílám novou událost na Google:', gEvent);
      const result = await (window as any).electronAPI.calendar.createEvent(gEvent);
      return result?.id ? `gcal-${result.id}` : undefined;
    } catch (error) {
      console.error('Error creating Google event:', error);
      return undefined;
    }
  }

  async updateEvent(event: CalendarEvent, vehicle?: Vehicle, customer?: Customer): Promise<void> {
    if (!this.isAuthenticated() || !this.isElectron || !event.id.startsWith('gcal-')) return;

    const gEventId = event.id.replace('gcal-', '');
    const summary = this.formatSummary(event, vehicle, customer);
    const description = this.formatDescription(event, vehicle, customer);

    const gEvent = {
      summary,
      description,
      start: {
        dateTime: new Date(event.startDate).toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      end: {
        dateTime: new Date(event.endDate).toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      colorId: this.mapLocalColorToGoogle(event.color),
    };

    try {
      console.log('Aktualizuji událost na Google:', gEventId, gEvent);
      await (window as any).electronAPI.calendar.updateEvent(gEventId, gEvent);
    } catch (error) {
      console.error('Error updating Google event:', error);
    }
  }

  private formatSummary(event: CalendarEvent, vehicle?: Vehicle, customer?: Customer): string {
    // Strip any existing decorations to start with a clean title
    const baseTitle = event.title.split('|')[0].trim();
    let summary = baseTitle;
    
    const customerPart = customer ? (customer.lastName || customer.firstName) : '';
    const vehiclePart = vehicle ? `${vehicle.make} ${vehicle.model}` : '';

    if (customerPart || vehiclePart) {
      summary += ' |';
      if (customerPart) summary += ` ${customerPart}`;
      if (vehiclePart) summary += ` | ${vehiclePart}`;
    }

    return summary;
  }

  private formatDescription(event: CalendarEvent, vehicle?: Vehicle, customer?: Customer): string {
    // Strip out auto-generated fields from the existing description to avoid duplicates
    let cleanNote = '';
    if (event.description) {
      if (event.description.includes('Poznámka:')) {
        const parts = event.description.split('Poznámka:');
        cleanNote = parts[1].split('vehicleId:')[0].trim();
      } else {
        const lines = event.description.split('\n');
        const prefixes = ['Jméno zákazníka:', 'Telefon:', 'Vozidlo:', 'SPZ:', 'vehicleId:'];
        cleanNote = lines
          .filter(line => !prefixes.some(p => line.trim().startsWith(p)))
          .join('\n')
          .trim();
      }
    }

    let desc = '';
    
    if (customer) {
      desc += `Jméno zákazníka: ${customer.firstName} ${customer.lastName}\n`;
      if (customer.phone) desc += `Telefon: ${customer.phone}\n`;
    }

    if (vehicle) {
      desc += `Vozidlo: ${vehicle.make} ${vehicle.model}\n`;
      if (vehicle.licensePlate) desc += `SPZ: ${vehicle.licensePlate}\n`;
    }

    if (cleanNote) {
      desc += `\nPoznámka:\n${cleanNote}\n`;
    }

    desc += `\nvehicleId: ${event.vehicleId || 'none'}`;
    
    return desc;
  }

  async deleteEvent(eventId: string): Promise<void> {
    if (!this.isAuthenticated() || !this.isElectron || !eventId.startsWith('gcal-')) return;

    const gEventId = eventId.replace('gcal-', '');

    try {
      await (window as any).electronAPI.calendar.deleteEvent(gEventId);
    } catch (error) {
      console.error('Error deleting Google event:', error);
    }
  }

  async logout() {
    localStorage.removeItem('google_calendar_tokens');
    if (this.isElectron) {
      await (window as any).electronAPI.calendar.setTokens(null);
    }
  }

  private mapGoogleToLocal(gEvent: any): CalendarEvent {
    // Parse vehicleId from description
    const fullDesc = gEvent.description || '';
    const vehicleIdMatch = fullDesc.match(/vehicleId:\s*([^\s\n]+)/);
    const vehicleId = vehicleIdMatch ? vehicleIdMatch[1] : undefined;

    // Extract base description (Note part)
    let cleanDesc = fullDesc;
    if (fullDesc.includes('Poznámka:')) {
      const parts = fullDesc.split('Poznámka:');
      cleanDesc = parts[1].split('vehicleId:')[0].trim();
    } else {
      // Filter out auto-generated lines
      const lines = fullDesc.split('\n');
      const prefixes = ['Jméno zákazníka:', 'Telefon:', 'Vozidlo:', 'SPZ:', 'vehicleId:'];
      cleanDesc = lines
        .filter((line: string) => !prefixes.some(p => line.trim().startsWith(p)))
        .join('\n')
        .trim();
    }

    // Extract base title (Summary part)
    const summary = gEvent.summary || 'Bez názvu';
    const baseTitle = summary.split('|')[0].trim();

    return {
      id: `gcal-${gEvent.id}`,
      title: baseTitle,
      description: cleanDesc,
      startDate: gEvent.start.dateTime || gEvent.start.date,
      endDate: gEvent.end.dateTime || gEvent.end.date,
      vehicleId: vehicleId === 'none' ? undefined : vehicleId,
      color: this.mapGoogleColorToLocal(gEvent.colorId),
    };
  }

  private mapLocalColorToGoogle(hex?: string): string | undefined {
    if (!hex) return undefined;
    const map: Record<string, string> = {
      '#2563eb': '9', 
      '#059669': '10', 
      '#dc2626': '11', 
      '#7c3aed': '3', 
      '#ea580c': '6', 
      '#db2777': '4', 
    };
    return map[hex.toLowerCase()] || undefined;
  }

  private mapGoogleColorToLocal(id: string): string {
    const map: Record<string, string> = {
      '1': '#2563eb',
      '10': '#059669',
      '11': '#dc2626',
      '3': '#7c3aed',
      '6': '#ea580c',
      '4': '#db2777',
    };
    return map[id] || '#2563eb';
  }
}

export const googleCalendarService = new GoogleCalendarService();
