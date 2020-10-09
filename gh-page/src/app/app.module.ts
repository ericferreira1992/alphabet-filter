import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

import { AlphabetFilterModule } from 'alphabet-filter/alphabet-filter.module';
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
