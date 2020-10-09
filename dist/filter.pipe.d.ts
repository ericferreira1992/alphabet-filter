import { PipeTransform } from '@angular/core';
export declare class FilterPipe implements PipeTransform {
    transform(list: any[], obj: any, startsWith?: boolean): any;
}
