import { Component, Input, Output, EventEmitter, ViewChild, ContentChild, Renderer2, TemplateRef } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { FilterPipe } from './filter.pipe';
export class AlphabetFilterComponent {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWxwaGFiZXQtZmlsdGVyLmNvbXBvbmVudC5qcyIsInNvdXJjZVJvb3QiOiIvVXNlcnMvZXJpYy5mZXJyZWlyYS9Eb2N1bWVudHMvRXJpY19SZXBvc2l0b3JpZXMvYWxwaGFiZXQtZmlsdGVyL3NyYy8iLCJzb3VyY2VzIjpbImFscGhhYmV0LWZpbHRlci5jb21wb25lbnQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUFFLFNBQVMsRUFBRSxLQUFLLEVBQUUsTUFBTSxFQUFFLFlBQVksRUFBVSxTQUFTLEVBQXdDLFlBQVksRUFBRSxTQUFTLEVBQUUsV0FBVyxFQUFhLE1BQU0sZUFBZSxDQUFDO0FBQ2pMLE9BQU8sRUFBRSxXQUFXLEVBQWEsTUFBTSxnQkFBZ0IsQ0FBQztBQUN4RCxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sZUFBZSxDQUFDO0FBVTNDLE1BQU0sT0FBTyx1QkFBdUI7SUEwQ25DLFlBQ1MsTUFBa0IsRUFDbEIsUUFBbUIsRUFDbkIsV0FBd0I7UUFGeEIsV0FBTSxHQUFOLE1BQU0sQ0FBWTtRQUNsQixhQUFRLEdBQVIsUUFBUSxDQUFXO1FBQ25CLGdCQUFXLEdBQVgsV0FBVyxDQUFhO1FBbkN4QixXQUFNLEdBQUcsT0FBTyxDQUFDO1FBQ2pCLG1CQUFjLEdBQUcsRUFBRSxDQUFDO1FBQ3BCLGdCQUFXLEdBQVEsRUFBRSxDQUFDO1FBQ3RCLFNBQUksR0FBVSxFQUFFLENBQUM7UUFDakIsZ0JBQVcsR0FBRyxrQkFBa0IsQ0FBQztRQUNqQyxjQUFTLEdBQVcsSUFBSSxDQUFDO1FBQ3pCLGlCQUFZLEdBQUcsS0FBSyxDQUFDO1FBQ3JCLG1CQUFjLEdBQUcsS0FBSyxDQUFDO1FBRXRCLGFBQVEsR0FBRyxJQUFJLFlBQVksRUFBTyxDQUFDO1FBQ25DLFlBQU8sR0FBRyxJQUFJLFlBQVksRUFBTyxDQUFDO1FBSXJDLFdBQU0sR0FBRyxLQUFLLENBQUM7UUFHZixpQkFBWSxHQUFZLEtBQUssQ0FBQztRQUU5QixrQkFBYSxHQUFXLENB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NkJBQ0wsS0FBSzswQkFDTCxLQUFLO21CQUNMLEtBQUs7MEJBQ0wsS0FBSzt3QkFDTCxLQUFLOzJCQUNMLEtBQUs7NkJBQ0wsS0FBSzt1QkFFTCxNQUFNO3NCQUNOLE1BQU0iLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBDb21wb25lbnQsIElucHV0LCBPdXRwdXQsIEV2ZW50RW1pdHRlciwgT25Jbml0LCBWaWV3Q2hpbGQsIEVsZW1lbnRSZWYsIE9uQ2hhbmdlcywgU2ltcGxlQ2hhbmdlcywgQ29udGVudENoaWxkLCBSZW5kZXJlcjIsIFRlbXBsYXRlUmVmLCBPbkRlc3Ryb3kgfSBmcm9tICdAYW5ndWxhci9jb3JlJztcbmltcG9ydCB7IEZvcm1CdWlsZGVyLCBGb3JtR3JvdXAgfSBmcm9tICdAYW5ndWxhci9mb3Jtcyc7XG5pbXBvcnQgeyBGaWx0ZXJQaXBlIH0gZnJvbSAnLi9maWx0ZXIucGlwZSc7XG5cbkBDb21wb25lbnQoe1xuXHRzZWxlY3RvcjogJ2FscGhhYmV0LWZpbHRlcicsXG5cdHRlbXBsYXRlVXJsOiAnLi9hbHBoYWJldC1maWx0ZXIuY29tcG9uZW50Lmh0bWwnLFxuXHRob3N0OiB7XG5cdFx0Jyhkb2N1bWVudDptb3VzZXdoZWVsKSc6ICdvbk1vdXNlV2hlZWxDb250ZW50KCRldmVudCknLFxuXHRcdCcoZG9jdW1lbnQ6a2V5ZG93biknOiAnb25LZXlEb3duQ29udGVudCgkZXZlbnQpJ1xuXHR9LFxufSlcbmV4cG9ydCBjbGFzcyBBbHBoYWJldEZpbHRlckNvbXBvbmVudCBpbXBsZW1lbnRzIE9uSW5pdCwgT25DaGFuZ2VzLCBPbkRlc3Ryb3kge1xuXHRAQ29udGVudENoaWxkKFRlbXBsYXRlUmVmKSB0ZW1wbGF0ZVJlZjogVGVtcGxhdGVSZWY8YW55PjtcblxuXHRAVmlld0NoaWxkKCdpbnB1dEJvZHknKSBwdWJsaWMgaW5wdXRCb2R5RWw6IEVsZW1lbnRSZWY8SFRNTEVsZW1lbnQ+O1xuXHRAVmlld0NoaWxkKCdpbnB1dFNlYXJjaCcpIHB1YmxpYyBpbnB1dFNlYXJjaEVsOiBFbGVtZW50UmVmPEhUTUxFbGVtZW50Pjtcblx0QFZpZXdDaGlsZCgnc2VhcmNoTGlzdCcpIHB1YmxpYyBzZWFyY2hMaXN0RWw6IEVsZW1lbnRSZWY8SFRNTEVsZW1lbnQ+O1xuXHRAVmlld0NoaWxkKCdsZXR0ZXJMaXN0JykgcHVibGljIGxldHRlckxpc3Q6IEVsZW1lbnRSZWY8SFRNTEVsZW1lbnQ+O1xuXHRAVmlld0NoaWxkKCdpbmRpY2F0b3InKSBwdWJsaWMgaW5kaWNhdG9yRWw6IEVsZW1lbnRSZWY8SFRNTEVsZW1lbnQ+O1xuXHRAVmlld0NoaWxkKCdjb250ZW50JykgcHVibGljIGNvbnRlbnRFbDogRWxlbWVudFJlZjxIVE1MRWxlbWVudD47XG5cblx0QElucHV0KCkgaGVpZ2h0ID0gJzMwMHB4Jztcblx0QElucHV0KCkgcHJvcEFscGhhT3JkZXIgPSAnJztcblx0QElucHV0KCkgcHJvcHNTZWFyY2g6IGFueSA9IFtdO1xuXHRASW5wdXQoKSBkYXRhOiBhbnlbXSA9IFtdO1xuXHRASW5wdXQoKSBwbGFjZWhvbGRlciA9ICdkaWdpdGUgc3VhIGJ1c2NhJztcblx0QElucHV0KCkgbGlzdENsYXNzOiBzdHJpbmcgPSBudWxsO1xuXHRASW5wdXQoKSB3aXRoVGVtcGxhdGUgPSBmYWxzZTtcblx0QElucHV0KCkgbm9TbW9vdGhTY3JvbGwgPSBmYWxzZTtcblxuXHRAT3V0cHV0KCkgb25DYW5jZWwgPSBuZXcgRXZlbnRFbWl0dGVyPGFueT4oKTtcblx0QE91dHB1dCgpIG9uQ2xpY2sgPSBuZXcgRXZlbnRFbWl0dGVyPGFueT4oKTtcblxuXHRwdWJsaWMgZm9ybTogRm9ybUdyb3VwO1xuXG5cdHB1YmxpYyBjbG9zZWQgPSBmYWxzZTtcblxuXHRwdWJsaWMgb2JqRmlsdGVyOiBhbnk7XG5cdHB1YmxpYyBpbnB1dEZvY3VzZWQ6IGJvb2xlYW4gPSBmYWxzZTtcblxuXHRwdWJsaWMgaGVpZ2h0Q29udGVudDogbnVtYmVyID0gMDtcblxuXHRwdWJsaWMgYWxwaGFiZXQ6IHN0cmluZ1tdID0gW107XG5cdHB1YmxpYyBjdXJyZW50QWxwaGE6IHN0cmluZyA9ICcnO1xuXHRwdWJsaWMgY3VycmVudExldHRlckVsZW1lbnQ6IGFueSA9IG51bGw7XG5cblx0cHVibGljIGhpZGRlblRpdGxlOiBib29sZWFuID0gZmFsc2U7XG5cdHB1YmxpYyBsZXR0ZXJzTGlzdEhlaWdodDogbnVtYmVyID0gMDtcblxuXHRwdWJsaWMgaW5kaWNhdG9yQ2xpY2tlZCA9IGZhbHNlO1xuXG5cdHByaXZhdGUgZ29pbmdUb0xldHRlcjogYm9vbGVhbiA9IGZhbHNlO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgZmlsdGVyOiBGaWx0ZXJQaXBlLFxuXHRcdHByaXZhdGUgcmVuZGVyZXI6IFJlbmRlcmVyMixcblx0XHRwcml2YXRlIGZvcm1CdWlsZGVyOiBGb3JtQnVpbGRlcixcblx0KSB7XG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCAyNjsgaSsrKSB7XG5cdFx0XHR0aGlzLmFscGhhYmV0LnB1c2goU3RyaW5nLmZyb21DaGFyQ29kZSg5NyArIGkpLnRvVXBwZXJDYXNlKCkpO1xuXHRcdH1cblx0XHR0aGlzLmZvcm0gPSB0aGlzLmZvcm1CdWlsZGVyLmdyb3VwKHtcblx0XHRcdHNlYXJjaDogW251bGxdXG5cdFx0fSk7XG5cdFx0dGhpcy5mb3JtLmdldCgnc2VhcmNoJykudmFsdWVDaGFuZ2VzLnN1YnNjcmliZSh0aGlzLnNldEZpbHRlci5iaW5kKHRoaXMpKTtcblx0fVxuXG5cdG5nT25Jbml0KCkge1xuXHRcdHNldFRpbWVvdXQoKCkgPT4ge1xuXHRcdFx0dGhpcy5yZW5kZXJlci5saXN0ZW4odGhpcy5zZWFyY2hMaXN0RWwubmF0aXZlRWxlbWVudCwgJ3Njcm9sbCcsIHRoaXMub25TY3JvbGxMaXN0LmJpbmQodGhpcykpO1xuXG5cdFx0XHR0aGlzLnJlbmRlcmVyLmxpc3Rlbih0aGlzLmNvbnRlbnRFbC5uYXRpdmVFbGVtZW50LCAnbW91c2V1cCcsIHRoaXMub25Nb3VzZVVwQ29udGVudC5iaW5kKHRoaXMpKTtcblx0XHRcdHRoaXMucmVuZGVyZXIubGlzdGVuKHRoaXMuY29udGVudEVsLm5hdGl2ZUVsZW1lbnQsICdtb3VzZW1vdmUnLCB0aGlzLm9uTW91c2VNb3ZlQ29udGVudC5iaW5kKHRoaXMpKTtcblxuXHRcdFx0dGhpcy5yZW5kZXJlci5saXN0ZW4odGhpcy5pbmRpY2F0b3JFbC5uYXRpdmVFbGVtZW50LCAnbW91c2Vkb3duJywgdGhpcy5vbk1vdXNlRG93bkluZGljYXRvci5iaW5kKHRoaXMpKTtcblx0XHRcdHRoaXMucmVuZGVyZXIubGlzdGVuKHRoaXMuaW5kaWNhdG9yRWwubmF0aXZlRWxlbWVudCwgJ21vdXNldXAnLCB0aGlzLm9uTW91c2VVcEluZGljYXRvci5iaW5kKHRoaXMpKTtcblxuXHRcdFx0dGhpcy5oZWlnaHRDb250ZW50ID0gdGhpcy5jb250ZW50RWwubmF0aXZlRWxlbWVudC5jbGllbnRIZWlnaHQgKyAodGhpcy5vbkNhbmNlbCA/IDIwIDogMzcpO1xuXG5cdFx0XHR0aGlzLmxldHRlcnNMaXN0SGVpZ2h0ID0gdGhpcy5sZXR0ZXJMaXN0Lm5hdGl2ZUVsZW1lbnQuY2hpbGRyZW5bMF0uY2xpZW50SGVpZ2h0O1xuXG5cdFx0XHR0aGlzLmZvY3VzSW5wdXQoKTtcblx0XHR9LCAxMDApO1xuXHR9XG5cblx0bmdPbkNoYW5nZXMoY2hhbmdlczogU2ltcGxlQ2hhbmdlcykge1xuXHRcdGlmICgnZGF0YScgaW4gY2hhbmdlcykge1xuXHRcdFx0dGhpcy5kYXRhID0gdGhpcy5vcmRlckJ5KCk7XG5cdFx0XHRpZiAodGhpcy5kYXRhICYmIHRoaXMucHJvcEFscGhhT3JkZXIpIHtcblx0XHRcdFx0dGhpcy5kYXRhLmZvckVhY2goKGl0ZW0pID0+IHtcblx0XHRcdFx0XHRsZXQgbGV0dGVyID0gaXRlbVt0aGlzLnByb3BBbHBoYU9yZGVyXS5zdWJzdHIoMCwgMSk7XG5cdFx0XHRcdFx0aXRlbVsnJGxldHRlciddID0gbGV0dGVyLnRvVXBwZXJDYXNlKCk7XG5cdFx0XHRcdFx0aXRlbVsnJGNsYXNzJ10gPSAnbGV0LScgKyBsZXR0ZXIudG9Mb3dlckNhc2UoKTtcblx0XHRcdFx0fSk7XG5cblx0XHRcdFx0c2V0VGltZW91dCgoKSA9PiB0aGlzLmRlZmluZUN1cnJlbnRMZXR0ZXJFbGVtZW50KCksIDEwMCk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGlmICgncHJvcHNTZWFyY2gnIGluIGNoYW5nZXMgJiYgdGhpcy5wcm9wc1NlYXJjaCkge1xuXHRcdFx0aWYgKHR5cGVvZiB0aGlzLnByb3BzU2VhcmNoID09PSAnc3RyaW5nJylcblx0XHRcdFx0dGhpcy5wcm9wc1NlYXJjaCA9IFt0aGlzLnByb3BzU2VhcmNoXTtcblxuXHRcdFx0dGhpcy5vYmpGaWx0ZXIgPSB7fTtcblx0XHRcdGZvciAoY29uc3QgcHJvcCBvZiB0aGlzLnByb3BzU2VhcmNoKSB7IHRoaXMub2JqRmlsdGVyW3Byb3BdID0gbnVsbDsgfVxuXHRcdFx0dGhpcy5zZXRGaWx0ZXIoKTtcblx0XHR9XG5cdH1cblxuXHRkZWZpbmVDdXJyZW50TGV0dGVyRWxlbWVudCgpIHtcblx0XHRpZiAoIXRoaXMuZ29pbmdUb0xldHRlcikge1xuXHRcdFx0Y29uc3QgdWxQb3NpdGlvbiA9IHRoaXMuc2VhcmNoTGlzdEVsLm5hdGl2ZUVsZW1lbnQuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG5cdFx0XHRjb25zdCB1bFRvcCA9IHVsUG9zaXRpb24udG9wO1xuXG5cdFx0XHRjb25zdCBlbGVtZW50c0xldHRlcnMgPSBbXTtcblx0XHRcdGxldCBjdXJyZW50ID0gbnVsbDtcblx0XHRcdGZvciAoY29uc3QgbGlFbGVtZW50IG9mICh0aGlzLnNlYXJjaExpc3RFbC5uYXRpdmVFbGVtZW50LmNoaWxkcmVuIGFzIGFueSkpIHtcblx0XHRcdFx0bGV0IGxldHRlckNsYXNzID0gJyc7XG5cblx0XHRcdFx0Zm9yIChjb25zdCBjbGFzc05hbWUgb2YgbGlFbGVtZW50LmNsYXNzTGlzdCkge1xuXHRcdFx0XHRcdGlmIChjbGFzc05hbWUuc3RhcnRzV2l0aCgnbGV0LScpKSB7XG5cdFx0XHRcdFx0XHRsZXR0ZXJDbGFzcyA9IGNsYXNzTmFtZTtcblx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmIChlbGVtZW50c0xldHRlcnMuZmlsdGVyKHggPT4geC5jbGFzc0xpc3QuY29udGFpbnMobGV0dGVyQ2xhc3MpKS5sZW5ndGggPT09IDApIHtcblx0XHRcdFx0XHRlbGVtZW50c0xldHRlcnMucHVzaChsaUVsZW1lbnQpO1xuXG5cdFx0XHRcdFx0Y29uc3QgbGlQb3NpdGlvbiA9IGxpRWxlbWVudC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcblx0XHRcdFx0XHRjb25zdCBsaVRvcCA9IGxpUG9zaXRpb24udG9wIC0gMjA7XG5cblx0XHRcdFx0XHRpZiAobGlUb3AgPCB1bFRvcCkgY3VycmVudCA9IGxpRWxlbWVudDtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRpZiAoY3VycmVudCAmJiBjdXJyZW50ICE9PSB0aGlzLmN1cnJlbnRMZXR0ZXJFbGVtZW50KSB7XG5cdFx0XHRcdGN1cnJlbnQuY2hpbGRyZW5bMF1bJ3Bvc2l0aW9uJ10gPSBjdXJyZW50LmNoaWxkcmVuWzBdLmlubmVySFRNTC5jaGFyQ29kZUF0KDApIC0gNjU7XG5cdFx0XHRcdHRoaXMuY3VycmVudExldHRlckVsZW1lbnQgPSBjdXJyZW50O1xuXHRcdFx0XHR0aGlzLmN1cnJlbnRBbHBoYSA9IGN1cnJlbnQuY2hpbGRyZW5bMF0uaW5uZXJIVE1MO1xuXHRcdFx0fVxuXHRcdFx0ZWxzZSBpZiAoIWN1cnJlbnQpIHtcblx0XHRcdFx0dGhpcy5jdXJyZW50TGV0dGVyRWxlbWVudCA9IG51bGw7XG5cdFx0XHRcdHRoaXMuY3VycmVudEFscGhhID0gJyc7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIGdvTGV0dGVyKGxldHRlcjogc3RyaW5nKSB7XG5cdFx0dGhpcy5jdXJyZW50QWxwaGEgPSBsZXR0ZXI7XG5cblx0XHRjb25zdCBsZXR0ZXJzRWxMaXN0ID0gdGhpcy5zZWFyY2hMaXN0RWwubmF0aXZlRWxlbWVudC5jaGlsZHJlbiBhcyBhbnk7XG5cdFx0Y29uc3QgbGV0dGVyRWxlbWVudCA9IFsuLi5sZXR0ZXJzRWxMaXN0XS5maW5kKChlbDogSFRNTEVsZW1lbnQpID0+IHtcblx0XHRcdGNvbnN0IGxldHRlckNsYXNzID0gKChlbC5jbGFzc0xpc3QudmFsdWUuc3BsaXQoJyAnKS5maW5kKHggPT4geC5zdGFydHNXaXRoKCdsZXQtJykpID8/ICcnKSBhcyBzdHJpbmcpLnJlcGxhY2UoJ2xldC0nLCAnJyk7XG5cdFx0XHRyZXR1cm4gbGV0dGVyQ2xhc3MudG9VcHBlckNhc2UoKSA9PT0gbGV0dGVyLnRvVXBwZXJDYXNlKCk7XG5cdFx0fSk7XG5cdFx0aWYgKGxldHRlckVsZW1lbnQpIHtcblx0XHRcdGxldHRlckVsZW1lbnQuY2hpbGRyZW5bMF1bJ3Bvc2l0aW9uJ10gPSBsZXR0ZXJFbGVtZW50LmNoaWxkcmVuWzBdLmlubmVySFRNTC5jaGFyQ29kZUF0KDApIC0gNjU7XG5cdFx0XHR0aGlzLmN1cnJlbnRMZXR0ZXJFbGVtZW50ID0gbGV0dGVyRWxlbWVudDtcblx0XHRcdGNvbnN0IHNjcm9sbEhlaWdodCA9IHRoaXMuc2VhcmNoTGlzdEVsLm5hdGl2ZUVsZW1lbnQuc2Nyb2xsSGVpZ2h0IC0gdGhpcy5zZWFyY2hMaXN0RWwubmF0aXZlRWxlbWVudC5jbGllbnRIZWlnaHQ7XG5cdFx0XHRjb25zdCBzY3JvbGxUb3AgPSBNYXRoLm1pbihzY3JvbGxIZWlnaHQsIGxldHRlckVsZW1lbnQub2Zmc2V0VG9wKTtcblxuXHRcdFx0dGhpcy5zZWFyY2hMaXN0RWwubmF0aXZlRWxlbWVudC5zY3JvbGxUbyh7XG5cdFx0XHRcdGxlZnQ6IDAsXG5cdFx0XHRcdHRvcDogc2Nyb2xsVG9wLFxuXHRcdFx0XHRiZWhhdmlvcjogJ3Ntb290aCdcblx0XHRcdH0pO1xuXG5cdFx0XHR0aGlzLmdvaW5nVG9MZXR0ZXIgPSB0cnVlO1xuXHRcdFx0Y29uc3QgY2hlY2tJZlNjcm9sbFRvSXNGaW5pc2hlZCA9IHNldEludGVydmFsKCgpID0+IHtcblx0XHRcdFx0aWYgKHNjcm9sbFRvcCA9PT0gdGhpcy5zZWFyY2hMaXN0RWwubmF0aXZlRWxlbWVudC5zY3JvbGxUb3ApIHtcblx0XHRcdFx0XHRjbGVhckludGVydmFsKGNoZWNrSWZTY3JvbGxUb0lzRmluaXNoZWQpO1xuXHRcdFx0XHRcdHRoaXMuZ29pbmdUb0xldHRlciA9IGZhbHNlO1xuXHRcdFx0XHR9XG5cdFx0XHR9LCA2MCk7XG5cdFx0fVxuXHR9XG5cdG9uTW91c2VNb3ZlQ29udGVudChldmVudCkge1xuXHRcdGlmICghdGhpcy5mb3JtLmdldCgnc2VhcmNoJykudmFsdWUgJiYgdGhpcy5pbmRpY2F0b3JDbGlja2VkKSB7XG5cdFx0XHRmb3IgKGNvbnN0IGxldHRlciBvZiAodGhpcy5sZXR0ZXJMaXN0Lm5hdGl2ZUVsZW1lbnQuY2hpbGRyZW4gYXMgYW55KSkge1xuXHRcdFx0XHRpZiAobGV0dGVyLmNsYXNzTGlzdC5jb250YWlucygnY29udGFpbnMnKSkge1xuXHRcdFx0XHRcdGNvbnN0IHBvc2l0aW9uID0gbGV0dGVyLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuXHRcdFx0XHRcdGNvbnN0IGJvdW5kcyA9IHsgdG9wOiBwb3NpdGlvbi55LCBib3R0b206IChwb3NpdGlvbi55ICsgbGV0dGVyLmNsaWVudEhlaWdodCkgfTtcblxuXHRcdFx0XHRcdGlmIChldmVudC5jbGllbnRZID49IGJvdW5kcy50b3AgJiYgZXZlbnQuY2xpZW50WSA8PSBib3VuZHMuYm90dG9tKSB7XG5cblx0XHRcdFx0XHRcdGlmICh0aGlzLmN1cnJlbnRBbHBoYSAhPT0gbGV0dGVyLmNoaWxkcmVuWzBdLmlubmVySFRNTClcblx0XHRcdFx0XHRcdFx0dGhpcy5nb0xldHRlcihsZXR0ZXIuY2hpbGRyZW5bMF0uaW5uZXJIVE1MKTtcblx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdG9uTW91c2VEb3duSW5kaWNhdG9yKGV2ZW50KSB7IGlmIChldmVudC5idXR0b24gPT09IDApIHRoaXMuaW5kaWNhdG9yQ2xpY2tlZCA9IHRydWU7IH1cblxuXHRvbk1vdXNlVXBJbmRpY2F0b3IoKSB7IHRoaXMuaW5kaWNhdG9yQ2xpY2tlZCA9IGZhbHNlOyB9XG5cblx0b25Nb3VzZVVwQ29udGVudCgpIHsgdGhpcy5pbmRpY2F0b3JDbGlja2VkID0gZmFsc2U7IH1cblxuXHRvblNjcm9sbExpc3QoZSkge1xuXHRcdGlmICghdGhpcy5nb2luZ1RvTGV0dGVyKSB7XG5cdFx0XHRpZiAoIXRoaXMuaW5kaWNhdG9yQ2xpY2tlZCkgdGhpcy5kZWZpbmVDdXJyZW50TGV0dGVyRWxlbWVudCgpO1xuXHRcdH1cblx0fVxuXG5cdG9uTW91c2VXaGVlbENvbnRlbnQoZXZlbnQ6IGFueSkge1xuXHR9XG5cblx0b25LZXlEb3duQ29udGVudChldmVudDogS2V5Ym9hcmRFdmVudCkge1xuXHRcdGNvbnN0IGUgPSBldmVudCBhcyBhbnk7XG5cdFx0Y29uc3Qga2V5ID0gKGUua2V5IHx8IGUua2V5SWRlbnRpZmllciB8fCBlLmtleUNvZGUpIGFzIGFueTtcblx0XHRpZiAoa2V5ID09PSAyNyB8fCBrZXkgPT09ICdFc2NhcGUnKVxuXHRcdFx0dGhpcy5jbG9zZSgpO1xuXHR9XG5cblx0Y2xpY2soZGF0YSA9IG51bGwpIHtcblx0XHR0aGlzLm9uQ2xpY2suZW1pdChkYXRhKTtcblx0fVxuXG5cdGNsb3NlKCkge1xuXHRcdGlmICh0aGlzLm9uQ2FuY2VsLm9ic2VydmVycy5sZW5ndGggPiAwKVxuXHRcdFx0dGhpcy5vbkNhbmNlbC5lbWl0KCk7XG5cdH1cblxuXHRmb2N1c0lucHV0KCkge1xuXHRcdHRoaXMuaW5wdXRTZWFyY2hFbC5uYXRpdmVFbGVtZW50LmZvY3VzKCk7XG5cdH1cblxuXHRzdGFydHNXaXRoTGV0dGVyKF9sZXR0ZXI6IHN0cmluZykge1xuXHRcdGNvbnN0IGxldHRlciA9IF9sZXR0ZXIudG9VcHBlckNhc2UoKTtcblx0XHRyZXR1cm4gdGhpcy5maWx0ZXIudHJhbnNmb3JtKHRoaXMuZGF0YSwgdGhpcy5vYmpGaWx0ZXIsIHRydWUpXG5cdFx0XHQuZmlsdGVyKHggPT4geFt0aGlzLnByb3BBbHBoYU9yZGVyXS50b1VwcGVyQ2FzZSgpLnN0YXJ0c1dpdGgobGV0dGVyKSlcblx0XHRcdC5sZW5ndGggPiAwO1xuXHR9XG5cblx0c2V0RmlsdGVyKCkge1xuXHRcdGlmICh0aGlzLm9iakZpbHRlcikge1xuXHRcdFx0T2JqZWN0LmtleXModGhpcy5vYmpGaWx0ZXIpLmZvckVhY2goKHByb3ApID0+IHtcblx0XHRcdFx0dGhpcy5vYmpGaWx0ZXJbcHJvcF0gPSB0aGlzLmZvcm0uZ2V0KCdzZWFyY2gnKS52YWx1ZVxuXHRcdFx0fSk7XG5cdFx0XHR0aGlzLm9iakZpbHRlciA9IE9iamVjdC5hc3NpZ24oe30sIHRoaXMub2JqRmlsdGVyKTtcblx0XHRcdHNldFRpbWVvdXQoKCkgPT4gdGhpcy5kZWZpbmVDdXJyZW50TGV0dGVyRWxlbWVudCgpLCAxMDApO1xuXHRcdH1cblx0fVxuXG5cdHB1YmxpYyBjbGVhckZpbHRlcigpIHtcblx0XHR0aGlzLmZvcm0uZ2V0KCdzZWFyY2gnKS5zZXRWYWx1ZShudWxsKTtcblx0XHR0aGlzLnNldEZpbHRlcigpO1xuXHR9XG5cblx0cHJpdmF0ZSBvcmRlckJ5KCkge1xuXHRcdHJldHVybiB0aGlzLmRhdGEuc29ydCgoYToge1trZXk6IHN0cmluZ106IHN0cmluZ30sIGI6IGFueSkgPT4ge1xuXHRcdFx0aWYgKGFbdGhpcy5wcm9wQWxwaGFPcmRlcl0udG9VcHBlckNhc2UoKSA8IGJbdGhpcy5wcm9wQWxwaGFPcmRlcl0udG9VcHBlckNhc2UoKSlcblx0XHRcdFx0cmV0dXJuIC0xO1xuXHRcdFx0aWYgKGFbdGhpcy5wcm9wQWxwaGFPcmRlcl0udG9VcHBlckNhc2UoKSA+IGJbdGhpcy5wcm9wQWxwaGFPcmRlcl0udG9VcHBlckNhc2UoKSlcblx0XHRcdFx0cmV0dXJuIDE7XG5cblx0XHRcdHJldHVybiAwO1xuXHRcdH0pO1xuXHR9XG5cblx0bmdPbkRlc3Ryb3koKTogdm9pZCB7XG5cdH1cbn1cbiJdfQ==