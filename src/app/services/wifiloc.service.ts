import { Injectable } from '@angular/core';
import { lastValueFrom } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { Http } from '@capacitor-community/http';
import { WifiWizard2 } from '@awesome-cordova-plugins/wifi-wizard-2/ngx';
// declare var WifiWizard2: any;
@Injectable({
  providedIn: 'root'
})
export class WifilocService {
  // ionic serve --ssl false


  private serverUrl = 'http://192.168.8.175:5000/api/localize';  // your PC’s LAN IP
  // private serverUrl = '/api/localize'; 

  constructor(
    private wifiWizard2: WifiWizard2,
    private http: HttpClient
  ) { }

  async scanAndLocalize(): Promise<{ room: string, x: number, y: number }> {
    const networks = await this.wifiWizard2.scan();
    const payload = networks.map((n: { SSID: any; BSSID: any; level: any; }) => ({
      ssid: n.SSID,
      bssid: n.BSSID,
      level: n.level
    }));
    const result = await lastValueFrom(
      this.http.post<{ room: string, x: number, y: number }>(this.serverUrl, { networks: payload })
    );
    if (!result) {
      throw new Error('Localization failed: No response from server');
    }
    return result;
  }
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