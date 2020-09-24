import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';

import { AlphabetFilterComponent } from './alphabet-filter.component';
import { FilterPipe } from './filter.pipe';
import { SmoothScrollDirective } from './smooth-scroll.directive';

@NgModule({
    imports: [
		CommonModule,
        ReactiveFormsModule,
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
    ]
})
export class AlphabetFilterModule { }
