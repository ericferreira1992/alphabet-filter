import { Pipe, EventEmitter, Component, Renderer2, ContentChild, TemplateRef, ViewChild, Input, Output, NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';

class FilterPipe {
    transform(list, obj, startsWith = false) {
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
FilterPipe.decorators = [
    { type: Pipe, args: [{
                name: 'filter'
            },] }
];

class AlphabetFilterComponent {
    constructor(filter, renderer, formBuilder) {
        this.filter = filter;
        this.renderer = renderer;
        this.formBuilder = formBuilder;
        this.height = '300px';
        this.propAlphaOrder = '';
        this.propsSearch = [];
        this.data = [];
        this.placeholder = 'digite sua busca';
        this.listClass = null;
        this.withTemplate = false;
        this.noSmoothScroll = false;
        this.onCancel = new EventEmitter();
        this.onClick = new EventEmitter();
        this.closed = false;
        this.inputFocused = false;
        this.heightContent = 0;
        this.alphabet = [];
        this.currentAlpha = '';
        this.currentLetterElement = null;
        this.hiddenTitle = false;
        this.lettersListHeight = 0;
        this.indicatorClicked = false;
        this.goingToLetter = false;
        for (let i = 0; i < 26; i++) {
            this.alphabet.push(String.fromCharCode(97 + i).toUpperCase());
        }
        this.form = this.formBuilder.group({
            search: [null]
        });
        this.form.get('search').valueChanges.subscribe(this.setFilter.bind(this));
    }
    ngOnInit() {
        setTimeout(() => {
            this.renderer.listen(this.searchListEl.nativeElement, 'scroll', this.onScrollList.bind(this));
            this.renderer.listen(this.contentEl.nativeElement, 'mouseup', this.onMouseUpContent.bind(this));
            this.renderer.listen(this.contentEl.nativeElement, 'mousemove', this.onMouseMoveContent.bind(this));
            this.renderer.listen(this.indicatorEl.nativeElement, 'mousedown', this.onMouseDownIndicator.bind(this));
            this.renderer.listen(this.indicatorEl.nativeElement, 'mouseup', this.onMouseUpIndicator.bind(this));
            this.heightContent = this.contentEl.nativeElement.clientHeight + (this.onCancel ? 20 : 37);
            this.lettersListHeight = this.letterList.nativeElement.children[0].clientHeight;
            this.focusInput();
        }, 100);
    }
    ngOnChanges(changes) {
        if ('data' in changes) {
            this.data = this.orderBy();
            if (this.data && this.propAlphaOrder) {
                this.data.forEach((item) => {
                    let letter = item[this.propAlphaOrder].substr(0, 1);
                    item['$letter'] = letter.toUpperCase();
                    item['$class'] = 'let-' + letter.toLowerCase();
                });
                setTimeout(() => this.defineCurrentLetterElement(), 100);
            }
        }
        if ('propsSearch' in changes && this.propsSearch) {
            if (typeof this.propsSearch === 'string')
                this.propsSearch = [this.propsSearch];
            this.objFilter = {};
            for (const prop of this.propsSearch) {
                this.objFilter[prop] = null;
            }
            this.setFilter();
        }
    }
    defineCurrentLetterElement() {
        if (!this.goingToLetter) {
            const ulPosition = this.searchListEl.nativeElement.getBoundingClientRect();
            const ulTop = ulPosition.top;
            const elementsLetters = [];
            let current = null;
            for (const liElement of this.searchListEl.nativeElement.children) {
                let letterClass = '';
                for (const className of liElement.classList) {
                    if (className.startsWith('let-')) {
                        letterClass = className;
                        break;
                    }
                }
                if (elementsLetters.filter(x => x.classList.contains(letterClass)).length === 0) {
                    elementsLetters.push(liElement);
                    const liPosition = liElement.getBoundingClientRect();
                    const liTop = liPosition.top - 20;
                    if (liTop < ulTop)
                        current = liElement;
                }
            }
            if (current && current !== this.currentLetterElement) {
                current.children[0]['position'] = current.children[0].innerHTML.charCodeAt(0) - 65;
                this.currentLetterElement = current;
                this.currentAlpha = current.children[0].innerHTML;
            }
            else if (!current) {
                this.currentLetterElement = null;
                this.currentAlpha = '';
            }
        }
    }
    goLetter(letter) {
        this.currentAlpha = letter;
        const lettersElList = this.searchListEl.nativeElement.children;
        const letterElement = [...lettersElList].find((el) => {
            var _a;
            const letterClass = ((_a = el.classList.value.split(' ').find(x => x.startsWith('let-'))) !== null && _a !== void 0 ? _a : '').replace('let-', '');
            return letterClass.toUpperCase() === letter.toUpperCase();
        });
        if (letterElement) {
            letterElement.children[0]['position'] = letterElement.children[0].innerHTML.charCodeAt(0) - 65;
            this.currentLetterElement = letterElement;
            const scrollHeight = this.searchListEl.nativeElement.scrollHeight - this.searchListEl.nativeElement.clientHeight;
            const scrollTop = Math.min(scrollHeight, letterElement.offsetTop);
            this.searchListEl.nativeElement.scrollTo({
                left: 0,
                top: scrollTop,
                behavior: 'smooth'
            });
            this.goingToLetter = true;
            const checkIfScrollToIsFinished = setInterval(() => {
                if (scrollTop === this.searchListEl.nativeElement.scrollTop) {
                    clearInterval(checkIfScrollToIsFinished);
                    this.goingToLetter = false;
                }
            }, 60);
        }
    }
    onMouseMoveContent(event) {
        if (!this.form.get('search').value && this.indicatorClicked) {
            for (const letter of this.letterList.nativeElement.children) {
                if (letter.classList.contains('contains')) {
                    const position = letter.getBoundingClientRect();
                    const bounds = { top: position.y, bottom: (position.y + letter.clientHeight) };
                    if (event.clientY >= bounds.top && event.clientY <= bounds.bottom) {
                        if (this.currentAlpha !== letter.children[0].innerHTML)
                            this.goLetter(letter.children[0].innerHTML);
                        break;
                    }
                }
            }
        }
    }
    onMouseDownIndicator(event) { if (event.button === 0)
        this.indicatorClicked = true; }
    onMouseUpIndicator() { this.indicatorClicked = false; }
    onMouseUpContent() { this.indicatorClicked = false; }
    onScrollList(e) {
        if (!this.goingToLetter) {
            if (!this.indicatorClicked)
                this.defineCurrentLetterElement();
        }
    }
    onMouseWheelContent(event) {
    }
    onKeyDownContent(event) {
        const e = event;
        const key = (e.key || e.keyIdentifier || e.keyCode);
        if (key === 27 || key === 'Escape')
            this.close();
    }
    click(data = null) {
        this.onClick.emit(data);
    }
    close() {
        if (this.onCancel.observers.length > 0)
            this.onCancel.emit();
    }
    focusInput() {
        this.inputSearchEl.nativeElement.focus();
    }
    startsWithLetter(_letter) {
        const letter = _letter.toUpperCase();
        return this.filter.transform(this.data, this.objFilter, true)
            .filter(x => x[this.propAlphaOrder].toUpperCase().startsWith(letter))
            .length > 0;
    }
    setFilter() {
        if (this.objFilter) {
            Object.keys(this.objFilter).forEach((prop) => {
                this.objFilter[prop] = this.form.get('search').value;
            });
            this.objFilter = Object.assign({}, this.objFilter);
            setTimeout(() => this.defineCurrentLetterElement(), 100);
        }
    }
    clearFilter() {
        this.form.get('search').setValue(null);
        this.setFilter();
    }
    orderBy() {
        return this.data.sort((a, b) => {
            if (a[this.propAlphaOrder].toUpperCase() < b[this.propAlphaOrder].toUpperCase())
                return -1;
            if (a[this.propAlphaOrder].toUpperCase() > b[this.propAlphaOrder].toUpperCase())
                return 1;
            return 0;
        });
    }
    ngOnDestroy() {
    }
}
AlphabetFilterComponent.decorators = [
    { type: Component, args: [{
                selector: 'alphabet-filter',
                template: "<div class=\"alpha-search\" [ngStyle]=\"{'height': height}\">\n  <div #content class=\"alpha-search-content\" [ngClass]=\"{'hidden-title': hiddenTitle}\">\n\n    <button class=\"close-button\" *ngIf=\"onCancel.observers.length > 0\" (click)=\"close()\" [ngClass]=\"{'fadeEnter': !closed, 'fadeExit': closed}\" title=\"Fechar\">\n      <svg version=\"1.1\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" x=\"0px\" y=\"0px\" viewBox=\"0 0 212.982 212.982\" xml:space=\"preserve\">\n        <g>\n          <path style=\"fill-rule:evenodd;clip-rule:evenodd;\" d=\"M131.804,106.491l75.936-75.936c6.99-6.99,6.99-18.323,0-25.312\n            c-6.99-6.99-18.322-6.99-25.312,0l-75.937,75.937L30.554,5.242c-6.99-6.99-18.322-6.99-25.312,0c-6.989,6.99-6.989,18.323,0,25.312\n            l75.937,75.936L5.242,182.427c-6.989,6.99-6.989,18.323,0,25.312c6.99,6.99,18.322,6.99,25.312,0l75.937-75.937l75.937,75.937\n            c6.989,6.99,18.322,6.99,25.312,0c6.99-6.99,6.99-18.322,0-25.312L131.804,106.491z\"/>\n        </g>\n      </svg> \n    </button>\n\n    <div #inputBody class=\"alpha-search-input\" (click)=\"focusInput()\" [ngClass]=\"{'fadeEnter': !closed, 'fadeExit': closed}\">\n      <div class=\"icon\">\n        <svg version=\"1.1\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 512 512\" xmlns:xlink=\"http://www.w3.org/1999/xlink\">\n          <g>\n            <path d=\"M495,466.2L377.2,348.4c29.2-35.6,46.8-81.2,46.8-130.9C424,103.5,331.5,11,217.5,11C103.4,11,11,103.5,11,217.5   S103.4,424,217.5,424c49.7,0,95.2-17.5,130.8-46.7L466.1,495c8,8,20.9,8,28.9,0C503,487.1,503,474.1,495,466.2z M217.5,382.9   C126.2,382.9,52,308.7,52,217.5S126.2,52,217.5,52C308.7,52,383,126.3,383,217.5S308.7,382.9,217.5,382.9z\"/>\n          </g>\n        </svg>        \n      </div>\n      <form [formGroup]=\"form\">\n\t\t<input #inputSearch type=\"text\" formControlName=\"search\" [placeholder]=\"placeholder\" autofocus/>\n\t  </form>\n      <div class=\"icon\" (click)=\"clearFilter()\" *ngIf=\"form.controls.search.value\">\n        <svg version=\"1.1\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" x=\"0px\" y=\"0px\" viewBox=\"0 0 212.982 212.982\" xml:space=\"preserve\">\n          <g>\n            <path style=\"fill-rule:evenodd;clip-rule:evenodd;\" d=\"M131.804,106.491l75.936-75.936c6.99-6.99,6.99-18.323,0-25.312\n              c-6.99-6.99-18.322-6.99-25.312,0l-75.937,75.937L30.554,5.242c-6.99-6.99-18.322-6.99-25.312,0c-6.989,6.99-6.989,18.323,0,25.312\n              l75.937,75.936L5.242,182.427c-6.989,6.99-6.989,18.323,0,25.312c6.99,6.99,18.322,6.99,25.312,0l75.937-75.937l75.937,75.937\n              c6.989,6.99,18.322,6.99,25.312,0c6.99-6.99,6.99-18.322,0-25.312L131.804,106.491z\"/>\n          </g>\n        </svg>      \n      </div>\n    </div>\n\n    <div class=\"alpha-search-area\" [ngClass]=\"{'fadeEnter': !closed, 'fadeExit': closed}\">\n      <ul #searchList class=\"search-list\" [ngClass]=\"listClass\" [ngStyle]=\"indicatorClicked ? {'overflow': 'hidden'} : {}\">\n        <li *ngFor=\"let item of data | filter:objFilter:true\" [ngClass]=\"item.$class\" class=\"fadeEnter\">\n          <span [innerHtml]=\"item.$letter\"></span>\n          <div class=\"search-item-data\" (click)=\"click(item)\">\n            <ng-container *ngIf=\"withTemplate\" [ngTemplateOutlet]=\"templateRef\" [ngTemplateOutletContext]=\"{ $implicit: item }\"></ng-container>\n            <span *ngIf=\"!withTemplate\">{{item.name}}</span>\n          </div>\n        </li>\n      </ul>\n    </div>\n\n    <div #indicator class=\"alpha-indicator no-select\" [ngClass]=\"{'fadeEnter': currentLetterElement, 'fadeExit': !currentLetterElement}\" [ngStyle]=\"{'top': ((currentLetterElement?.children[0].position * lettersListHeight) + 77) + 'px'}\">\n      <div>\n        <div>\n          <span>{{currentLetterElement?.children[0].innerHTML}}</span>\n        </div>\n      </div>\n      <div>\n        <span>{{currentLetterElement?.children[0].innerHTML}}</span>\n        <svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 55.69 122.242\">\n          <g id=\"guia\" transform=\"translate(-1288 -436.211)\">\n              <path id=\"Path_4084\" d=\"M-13643.358-21865.281l-55.629-.09a4.4 4.4 0 0 0 0 .711c.035.008-.083 10.844 17.217 22.045 19.523 12.643 38.459 38.025 38.459 38.025z\" data-name=\"Path 4084\" transform=\"translate(14986.999 22362.5)\"/>\n              <path id=\"Path_4085\" d=\"M-13643.354-21803.814l-55.632-.094c.035-.008-.083-12.236 17.218-23.437 19.524-12.643 38.461-38.023 38.461-38.023z\" data-name=\"Path 4085\" transform=\"translate(14986.998 22301.55)\"/>\n          </g>\n        </svg>\n      </div>\n    </div>\n\n    <section #letterList>\n      <div class=\"alpha-letters-list\" *ngFor=\"let letter of alphabet\" (click)=\"goLetter(letter)\" [ngClass]=\"{'contains': currentLetterElement?.children[0].innerHTML !== letter && startsWithLetter(letter), 'actived': currentLetterElement?.children[0].innerHTML === letter}\">\n        <span>{{letter}}</span>\n        <i></i>\n      </div>\n    </section>\n\n  </div>\n</div>\n",
                host: {
                    '(document:mousewheel)': 'onMouseWheelContent($event)',
                    '(document:keydown)': 'onKeyDownContent($event)'
                }
            },] }
];
AlphabetFilterComponent.ctorParameters = () => [
    { type: FilterPipe },
    { type: Renderer2 },
    { type: FormBuilder }
];
AlphabetFilterComponent.propDecorators = {
    templateRef: [{ type: ContentChild, args: [TemplateRef,] }],
    inputBodyEl: [{ type: ViewChild, args: ['inputBody',] }],
    inputSearchEl: [{ type: ViewChild, args: ['inputSearch',] }],
    searchListEl: [{ type: ViewChild, args: ['searchList',] }],
    letterList: [{ type: ViewChild, args: ['letterList',] }],
    indicatorEl: [{ type: ViewChild, args: ['indicator',] }],
    contentEl: [{ type: ViewChild, args: ['content',] }],
    height: [{ type: Input }],
    propAlphaOrder: [{ type: Input }],
    propsSearch: [{ type: Input }],
    data: [{ type: Input }],
    placeholder: [{ type: Input }],
    listClass: [{ type: Input }],
    withTemplate: [{ type: Input }],
    noSmoothScroll: [{ type: Input }],
    onCancel: [{ type: Output }],
    onClick: [{ type: Output }]
};

class AlphabetFilterModule {
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

/**
 * Generated bundle index. Do not edit.
 */

export { AlphabetFilterComponent, AlphabetFilterModule, FilterPipe as ɵa };
//# sourceMappingURL=alphabet-filter.js.map
