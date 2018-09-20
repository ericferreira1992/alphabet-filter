import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AlphabetFilterModule } from './../../alphabet-filter/src/public-api';
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
