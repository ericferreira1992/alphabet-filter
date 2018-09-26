import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

import { AlphabetFilterModule } from '../../alphabet-filter/src/public_api';
import { AppComponent } from './app.component';

@NgModule({
  imports: [
    BrowserModule,
    AlphabetFilterModule
  ],
  declarations: [
    AppComponent
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
