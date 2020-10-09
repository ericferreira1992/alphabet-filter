import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { AlphabetFilterComponent } from './alphabet-filter.component';
import { FilterPipe } from './filter.pipe';
export class AlphabetFilterModule {
}
AlphabetFilterModule.decorators = [
    { type: NgModule, args: [{
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
            },] }
];
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWxwaGFiZXQtZmlsdGVyLm1vZHVsZS5qcyIsInNvdXJjZVJvb3QiOiIvVXNlcnMvZXJpYy5mZXJyZWlyYS9Eb2N1bWVudHMvRXJpY19SZXBvc2l0b3JpZXMvYWxwaGFiZXQtZmlsdGVyL3NyYy8iLCJzb3VyY2VzIjpbImFscGhhYmV0LWZpbHRlci5tb2R1bGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLGVBQWUsQ0FBQztBQUN6QyxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFDL0MsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0sZ0JBQWdCLENBQUM7QUFFckQsT0FBTyxFQUFFLHVCQUF1QixFQUFFLE1BQU0sNkJBQTZCLENBQUM7QUFDdEUsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLGVBQWUsQ0FBQztBQWtCM0MsTUFBTSxPQUFPLG9CQUFvQjs7O1lBaEJoQyxRQUFRLFNBQUM7Z0JBQ04sT0FBTyxFQUFFO29CQUNYLFlBQVk7b0JBQ04sbUJBQW1CO2lCQUN0QjtnQkFDRCxPQUFPLEVBQUU7b0JBQ0wsdUJBQXVCO2lCQUMxQjtnQkFDRCxZQUFZLEVBQUU7b0JBQ1YsdUJBQXVCO29CQUN2QixVQUFVO2lCQUNiO2dCQUNELFNBQVMsRUFBRTtvQkFDUCxVQUFVO2lCQUNiO2FBQ0oiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBOZ01vZHVsZSB9IGZyb20gJ0Bhbmd1bGFyL2NvcmUnO1xuaW1wb3J0IHsgQ29tbW9uTW9kdWxlIH0gZnJvbSAnQGFuZ3VsYXIvY29tbW9uJztcbmltcG9ydCB7IFJlYWN0aXZlRm9ybXNNb2R1bGUgfSBmcm9tICdAYW5ndWxhci9mb3Jtcyc7XG5cbmltcG9ydCB7IEFscGhhYmV0RmlsdGVyQ29tcG9uZW50IH0gZnJvbSAnLi9hbHBoYWJldC1maWx0ZXIuY29tcG9uZW50JztcbmltcG9ydCB7IEZpbHRlclBpcGUgfSBmcm9tICcuL2ZpbHRlci5waXBlJztcblxuQE5nTW9kdWxlKHtcbiAgICBpbXBvcnRzOiBbXG5cdFx0Q29tbW9uTW9kdWxlLFxuICAgICAgICBSZWFjdGl2ZUZvcm1zTW9kdWxlLFxuICAgIF0sXG4gICAgZXhwb3J0czogW1xuICAgICAgICBBbHBoYWJldEZpbHRlckNvbXBvbmVudFxuICAgIF0sXG4gICAgZGVjbGFyYXRpb25zOiBbXG4gICAgICAgIEFscGhhYmV0RmlsdGVyQ29tcG9uZW50LFxuICAgICAgICBGaWx0ZXJQaXBlLFxuICAgIF0sXG4gICAgcHJvdmlkZXJzOiBbXG4gICAgICAgIEZpbHRlclBpcGVcbiAgICBdXG59KVxuZXhwb3J0IGNsYXNzIEFscGhhYmV0RmlsdGVyTW9kdWxlIHsgfVxuIl19