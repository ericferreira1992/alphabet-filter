import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';

import { AlphabetFilterComponent } from './alphabet-filter.component';
import { FilterPipe } from './filter.pipe';

@NgModule({
    imports: [
		CommonModule,
        ReactiveFormsModule,
    ],
    exports: [
        AlphabetFilterComponent
    ],
    declarations: [
        AlphabetFilterComponent,
        FilterPipe,
    ],
    providers: [
        FilterPipe
    ]
})
export class AlphabetFilterModule { }
