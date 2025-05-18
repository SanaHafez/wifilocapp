import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
export interface SSIDLabels { [ssid: string]: 'temporary'|'institutional'; }
export interface ClassifyResponse { labels: SSIDLabels; }

export interface LocalizationResponse {
  room: number;
  x: number;
  y: number;
}

@Injectable({
  providedIn: 'root'
})
export class ApiService {
 private base = 'http://YOUR_SERVER_IP:8000';

  constructor(private http: HttpClient) {}

  classifySsids(ssids: string[]): Observable<ClassifyResponse> {
    return this.http.post<ClassifyResponse>(
      `${this.base}/classify_ssids`,
      { ssids }
    );
  }

  localize(rssi: Record<string, number>): Observable<LocalizationResponse> {
    return this.http.post<LocalizationResponse>(
      `${this.base}/localize`,
      { rssi }
    );
  }
}