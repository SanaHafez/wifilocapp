import { Injectable } from '@angular/core';
import { lastValueFrom } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { Http } from '@capacitor-community/http';
import { WifiWizard2 } from '@awesome-cordova-plugins/wifi-wizard-2/ngx';
import { Platform } from '@ionic/angular';
// declare var WifiWizard2: any;

export interface LocalizationResult {
  room: string;
  x: number;
  y: number;
}
@Injectable({
  providedIn: 'root'
})
export class WifilocService {
  // ionic serve --ssl false


  // private serverUrl = 'http://192.168.8.175:5000/api/localize';  // your PC’s LAN IP
  // private serverUrl = '/api/localize'; 

 
  private serverUrl =  'https://us-central1-motapp-422721.cloudfunctions.net/localize'

  constructor(
    private wifiWizard2: WifiWizard2,
    private http: HttpClient,
    private platform: Platform,
  ) { }


public async scanAndLocalize(): Promise<LocalizationResult> {
    if (!this.platform.is('android')) {
    throw new Error('Wi-Fi scanning only works on Android device');
  }
  try {
    const networks = await this.wifiWizard2.scan();
    const payloadNetworks = networks
    .filter((n: { SSID: { trim: () => { (): any; new(): any; length: number; }; }; }) => n.SSID && n.SSID.trim().length > 0)
    .map((n: { SSID: any; BSSID: any; level: any; }) => ({
      ssid: n.SSID,
      bssid: n.BSSID,
      rssi: n.level
    }));

    const payload = { networks: payloadNetworks };

    const result = await lastValueFrom(
      this.http.post<LocalizationResult>(this.serverUrl, payload )
    );

    if (!result) {
      throw new Error('Localization failed: No response from server');
    }
        // 6) Return the parsed localization
    return {
      room: result.room,
      x: result.x,
      y: result.y,
    };
  } catch (scanErr) {
    console.error('❌ Failed to scan Wi‐Fi networks:', scanErr);
    throw new Error('Wi-Fi scan failed');
  }
}
  //   const payload = networks.map((n: { SSID: any; BSSID: any; level: any; }) => ({
  //     ssid: n.SSID,
  //     bssid: n.BSSID,
  //     level: n.level
  //   }));
  //   const result = await lastValueFrom(
  //     this.http.post<{ room: string, x: number, y: number }>(this.serverUrl, { networks: payload })
  //   );
  //   if (!result) {
  //     throw new Error('Localization failed: No response from server');
  //   }
  //   return result;
  // }
  // async scanAndLocalize() {
  //   const networks = await WifiWizard2.scan();
  //   const data = { networks: networks.map(n => ({ ssid: n.SSID, bssid: n.BSSID, level: n.level })) };

  //   const resp = await Http.request({
  //     method: 'POST',
  //     url: 'http://192.168.8.175:5000/api/localize',
  //     headers: { 'Content-Type': 'application/json' },
  //     data
  //   });

  //   // resp.data is already parsed JSON
  //   return resp.data as { room: string; x: number; y: number };
  // }
// old
//    private base = 'http://YOUR_SERVER_IP:8000';

//   constructor(private http: HttpClient) {}

//   classifySsids(ssids: string[]): Observable<ClassifyResponse> {
//     return this.http.post<ClassifyResponse>(
//       `${this.base}/classify_ssids`,
//       { ssids }
//     );
//   }

//   localize(rssi: Record<string, number>): Observable<LocalizationResponse> {
//     return this.http.post<LocalizationResponse>(
//       `${this.base}/localize`,
//       { rssi }
//     );
//   }
// }
}