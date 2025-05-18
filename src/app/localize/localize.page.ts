import { Component, OnInit } from '@angular/core';
import { CommonModule }   from '@angular/common';
import { FormsModule }    from '@angular/forms';
import { IonicModule }    from '@ionic/angular';
import { ApiService } from '../services/api.service';

@Component({
  selector: 'app-localize',
  templateUrl: './localize.page.html',
  styleUrls: ['./localize.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class LocalizePage implements OnInit {

    constructor(private api: ApiService) {}


  ngOnInit() {
  }

   async runDemo() {
    const ssids = ['eduroam','HomeWiFi123','Guest'];
    this.api.classifySsids(ssids).subscribe(res => {
      console.log('Labels:', res.labels);
    });

    const sampleRssi = { 'eduroam': -60, 'HomeWiFi123': -80 };
    this.api.localize(sampleRssi).subscribe(loc => {
      console.log(`You are on floor ${loc.room} at (${loc.x},${loc.y})`);
    });
  }
}


