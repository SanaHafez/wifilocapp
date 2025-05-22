import { Component, OnInit } from '@angular/core';
import { CommonModule }   from '@angular/common';
import { FormsModule }    from '@angular/forms';
import { IonicModule }    from '@ionic/angular';
import { WifilocService } from '../services/wifiloc.service';

@Component({
  selector: 'app-localize',
  templateUrl: './localize.page.html',
  styleUrls: ['./localize.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class LocalizePage implements OnInit {

  position: any;

    constructor(private wifiService: WifilocService) {}


  ngOnInit() {
  }

async locate() {
  try {
    const res = await this.wifiService.scanAndLocalize();
    console.log('Room:', res.room, 'Coordinates:', res.x, res.y);
    this.position = res;
  } catch(err) {
    console.error(err);
  }
}
}


