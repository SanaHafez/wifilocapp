import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { LocalizePageRoutingModule } from './localize-routing.module';

import { LocalizePage } from './localize.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    LocalizePageRoutingModule,
    LocalizePage
  ],
  declarations: []
})
export class LocalizePageModule {}
