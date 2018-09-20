import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { AlphabetFilterComponent } from './alphabet-filter.component';
import { FilterPipe } from './filter.pipe';
import { SmoothScrollDirective } from './smooth-scroll.directive';

@NgModule({
  imports: [
    FormsModule,
    CommonModule,
  ],
  exports: [
    AlphabetFilterComponent,
    SmoothScrollDirective
  ],
  declarations: [
    AlphabetFilterComponent,
    FilterPipe,
    SmoothScrollDirective
  ],
  providers: [
    FilterPipe
  ],
  entryComponents: [
    AlphabetFilterComponent,
  ]
})
export class AlphabetFilterModule { }
