import { Injectable } from '@angular/core'; 
import { lastValueFrom } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { WifiWizard2 } from '@awesome-cordova-plugins/wifi-wizard-2/ngx';
import { Platform } from '@ionic/angular';

export interface LocalizationResult {
  room: string;
  x: number;
  y: number;
}

@Injectable({
  providedIn: 'root'
})
export class WifilocService {
  private serverUrl = 'https://me-west1-motapp-422721.cloudfunctions.net/localize';

  constructor(
    private wifiWizard2: WifiWizard2,
    private http: HttpClient,
    private platform: Platform,
  ) {}

  public async scanAndLocalize(): Promise<LocalizationResult> {
    if (!this.platform.is('android')) {
      throw new Error('Wi-Fi scanning only works on Android device');
    }

    try {
      // --- TOTAL TIMER ---
      console.time('localize:total');

      // --- SCAN TIMER ---
      console.time('localize:scan');
      const networks = await this.wifiWizard2.scan();
      console.timeEnd('localize:scan');

      // --- FILTER TIMER ---
      console.time('localize:filter');
      const payloadNetworks = networks
        .filter((n: { SSID: { trim: () => { (): any; new(): any; length: number; }; }; }) => n.SSID && n.SSID.trim().length > 0)
        .map((n: { SSID: any; BSSID: any; level: any; }) => ({
          ssid: n.SSID,
          bssid: n.BSSID,
          rssi: n.level
        }));
      console.timeEnd('localize:filter');

      const payload = { networks: payloadNetworks };

      // --- HTTP REQUEST TIMER ---
      console.time('localize:request');
      const result = await lastValueFrom(
        this.http.post<LocalizationResult>(this.serverUrl, payload)
      );
      console.timeEnd('localize:request');

      if (!result) {
        throw new Error('Localization failed: No response from server');
      }

      console.timeEnd('localize:total');

      return {
        room: result.room,
        x:    result.x,
        y:    result.y,
      };
    } catch (err) {
      console.error('❌ scanAndLocalize error', err);
      throw err;
    }
  }
}
