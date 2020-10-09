import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
	name: 'filter'
})
export class FilterPipe implements PipeTransform {

	transform(list: any[], obj: any, startsWith: boolean = false): any {
		if ((list && Array.isArray(list)) && (obj && typeof obj === 'object')) {
			let newList = list.filter((item) => {
				let ok = true;
				for (let key in obj) {
					if ((obj[key] != null) && (item[key] != null) && obj.hasOwnProperty(key)) {
						let valueObj = obj[key];
						let valueList = item[key];

						if (!Array.isArray(obj[key]) && Object.prototype.toString.call(obj[key]) !== '[object Object]') {
							valueList = valueList.toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
							valueObj = valueObj.toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

							if ((!startsWith && valueList.indexOf(valueObj) < 0) || (startsWith && !(valueList.startsWith(valueObj)))) {
								ok = false;
								return;
							}
						}
					}
				}

				return ok;
			});

			return newList;
		}

		return list;
	}

}
