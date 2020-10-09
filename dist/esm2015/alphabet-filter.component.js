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
        for (const liElement of this.searchListEl.nativeElement.children) {
            let liLetter = '';
            for (const className of liElement.classList) {
                if (className.startsWith('let-')) {
                    liLetter = className.replace('let-', '').toUpperCase();
                    break;
                }
            }
            if (letter === liLetter) {
                liElement.children[0]['position'] = liElement.children[0].innerHTML.charCodeAt(0) - 65;
                this.currentLetterElement = liElement;
                const lettersElList = this.searchListEl.nativeElement.children;
                const letterElement = [...lettersElList].find((el) => {
                    const splitted = el.classList.value.split(' ');
                    if (splitted.length > 0 && splitted[splitted.length - 1].includes('-')) {
                        const letterClass = splitted[splitted.length - 1].split('-')[1].toUpperCase();
                        return letterClass === letter;
                    }
                    return false;
                });
                if (letterElement) {
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
                break;
            }
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
    onMouseUpIndicator(event) { this.indicatorClicked = false; }
    onMouseUpContent(event) { this.indicatorClicked = false; }
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWxwaGFiZXQtZmlsdGVyLmNvbXBvbmVudC5qcyIsInNvdXJjZVJvb3QiOiIvVXNlcnMvZXJpYy5mZXJyZWlyYS9Eb2N1bWVudHMvRXJpY19SZXBvc2l0b3JpZXMvYWxwaGFiZXQtZmlsdGVyL3NyYy8iLCJzb3VyY2VzIjpbImFscGhhYmV0LWZpbHRlci5jb21wb25lbnQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUFFLFNBQVMsRUFBRSxLQUFLLEVBQUUsTUFBTSxFQUFFLFlBQVksRUFBVSxTQUFTLEVBQXdDLFlBQVksRUFBRSxTQUFTLEVBQUUsV0FBVyxFQUFhLE1BQU0sZUFBZSxDQUFDO0FBQ2pMLE9BQU8sRUFBRSxXQUFXLEVBQWEsTUFBTSxnQkFBZ0IsQ0FBQztBQUN4RCxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sZUFBZSxDQUFDO0FBVTNDLE1BQU0sT0FBTyx1QkFBdUI7SUEwQ25DLFlBQ1MsTUFBa0IsRUFDbEIsUUFBbUIsRUFDbkIsV0FBd0I7UUFGeEIsV0FBTSxHQUFOLE1BQU0sQ0FBWTtRQUNsQixhQUFRLEdBQVIsUUFBUSxDQUFXO1FBQ25CLGdCQUFXLEdBQVgsV0FBVyxDQUFhO1FBbkN4QixXQUFNLEdBQUcsT0FBTyxDQUFDO1FBQ2pCLG1CQUFjLEdBQUcsRUFBRSxDQUFDO1FBQ3BCLGdCQUFXLEdBQVEsRUFBRSxDQUFDO1FBQ3RCLFNBQUksR0FBVSxFQUFFLENBQUM7UUFDakIsZ0JBQVcsR0FBRyxrQkFBa0IsQ0FBQztRQUNqQyxjQUFTLEdBQVcsSUFBSSxDQUFDO1FBQ3pCLGlCQUFZLEdBQUcsS0FBSyxDQUFDO1FBQ3JCLG1CQUFjLEdBQUcsS0FBSyxDQUFDO1FBRXRCLGFBQVEsR0FBRyxJQUFJLFlBQVksRUFBTyxDQUFDO1FBQ25DLFlBQU8sR0FBRyxJQUFJLFlBQVksRUFBTyxDQUFDO1FBSXJDLFdBQU0sR0FBRyxLQUFLLENBQUM7UUFHZixpQkFBWSxHQUFZLEtBQUssQ0FBQztRQUU5QixrQkFBYSxHQUFXLENB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RSxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsV0FBVyxFQUFFO2dCQUM5RSxPQUFPLENBQUMsQ0FBQztZQUVWLE9BQU8sQ0FBQyxDQUFDO1FBQ1YsQ0FBQyxDQUFDLENBQUM7SUFDSixDQUFDO0lBRUQsV0FBVztJQUNYLENBQUM7OztZQXRSRCxTQUFTLFNBQUM7Z0JBQ1YsUUFBUSxFQUFFLGlCQUFpQjtnQkFDM0IsOGdLQUErQztnQkFDL0MsSUFBSSxFQUFFO29CQUNMLHVCQUF1QixFQUFFLDZCQUE2QjtvQkFDdEQsb0JBQW9CLEVBQUUsMEJBQTBCO2lCQUNoRDthQUNEOzs7WUFUUSxVQUFVO1lBRnFHLFNBQVM7WUFDeEgsV0FBVzs7OzBCQVlsQixZQUFZLFNBQUMsV0FBVzswQkFFeEIsU0FBUyxTQUFDLFdBQVc7NEJBQ3JCLFNBQVMsU0FBQyxhQUFhOzJCQUN2QixTQUFTLFNBQUMsWUFBWTt5QkFDdEIsU0FBUyxTQUFDLFlBQVk7MEJBQ3RCLFNBQVMsU0FBQyxXQUFXO3dCQUNyQixTQUFTLFNBQUMsU0FBUztxQkFFbkIsS0FBSzs2QkFDTCxLQUFLOzBCQUNMLEtBQUs7bUJBQ0wsS0FBSzswQkFDTCxLQUFLO3dCQUNMLEtBQUs7MkJBQ0wsS0FBSzs2QkFDTCxLQUFLO3VCQUVMLE1BQU07c0JBQ04sTUFBTSIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IENvbXBvbmVudCwgSW5wdXQsIE91dHB1dCwgRXZlbnRFbWl0dGVyLCBPbkluaXQsIFZpZXdDaGlsZCwgRWxlbWVudFJlZiwgT25DaGFuZ2VzLCBTaW1wbGVDaGFuZ2VzLCBDb250ZW50Q2hpbGQsIFJlbmRlcmVyMiwgVGVtcGxhdGVSZWYsIE9uRGVzdHJveSB9IGZyb20gJ0Bhbmd1bGFyL2NvcmUnO1xuaW1wb3J0IHsgRm9ybUJ1aWxkZXIsIEZvcm1Hcm91cCB9IGZyb20gJ0Bhbmd1bGFyL2Zvcm1zJztcbmltcG9ydCB7IEZpbHRlclBpcGUgfSBmcm9tICcuL2ZpbHRlci5waXBlJztcblxuQENvbXBvbmVudCh7XG5cdHNlbGVjdG9yOiAnYWxwaGFiZXQtZmlsdGVyJyxcblx0dGVtcGxhdGVVcmw6ICcuL2FscGhhYmV0LWZpbHRlci5jb21wb25lbnQuaHRtbCcsXG5cdGhvc3Q6IHtcblx0XHQnKGRvY3VtZW50Om1vdXNld2hlZWwpJzogJ29uTW91c2VXaGVlbENvbnRlbnQoJGV2ZW50KScsXG5cdFx0Jyhkb2N1bWVudDprZXlkb3duKSc6ICdvbktleURvd25Db250ZW50KCRldmVudCknXG5cdH0sXG59KVxuZXhwb3J0IGNsYXNzIEFscGhhYmV0RmlsdGVyQ29tcG9uZW50IGltcGxlbWVudHMgT25Jbml0LCBPbkNoYW5nZXMsIE9uRGVzdHJveSB7XG5cdEBDb250ZW50Q2hpbGQoVGVtcGxhdGVSZWYpIHRlbXBsYXRlUmVmOiBUZW1wbGF0ZVJlZjxhbnk+O1xuXG5cdEBWaWV3Q2hpbGQoJ2lucHV0Qm9keScpIHB1YmxpYyBpbnB1dEJvZHlFbDogRWxlbWVudFJlZjxIVE1MRWxlbWVudD47XG5cdEBWaWV3Q2hpbGQoJ2lucHV0U2VhcmNoJykgcHVibGljIGlucHV0U2VhcmNoRWw6IEVsZW1lbnRSZWY8SFRNTEVsZW1lbnQ+O1xuXHRAVmlld0NoaWxkKCdzZWFyY2hMaXN0JykgcHVibGljIHNlYXJjaExpc3RFbDogRWxlbWVudFJlZjxIVE1MRWxlbWVudD47XG5cdEBWaWV3Q2hpbGQoJ2xldHRlckxpc3QnKSBwdWJsaWMgbGV0dGVyTGlzdDogRWxlbWVudFJlZjxIVE1MRWxlbWVudD47XG5cdEBWaWV3Q2hpbGQoJ2luZGljYXRvcicpIHB1YmxpYyBpbmRpY2F0b3JFbDogRWxlbWVudFJlZjxIVE1MRWxlbWVudD47XG5cdEBWaWV3Q2hpbGQoJ2NvbnRlbnQnKSBwdWJsaWMgY29udGVudEVsOiBFbGVtZW50UmVmPEhUTUxFbGVtZW50PjtcblxuXHRASW5wdXQoKSBoZWlnaHQgPSAnMzAwcHgnO1xuXHRASW5wdXQoKSBwcm9wQWxwaGFPcmRlciA9ICcnO1xuXHRASW5wdXQoKSBwcm9wc1NlYXJjaDogYW55ID0gW107XG5cdEBJbnB1dCgpIGRhdGE6IGFueVtdID0gW107XG5cdEBJbnB1dCgpIHBsYWNlaG9sZGVyID0gJ2RpZ2l0ZSBzdWEgYnVzY2EnO1xuXHRASW5wdXQoKSBsaXN0Q2xhc3M6IHN0cmluZyA9IG51bGw7XG5cdEBJbnB1dCgpIHdpdGhUZW1wbGF0ZSA9IGZhbHNlO1xuXHRASW5wdXQoKSBub1Ntb290aFNjcm9sbCA9IGZhbHNlO1xuXG5cdEBPdXRwdXQoKSBvbkNhbmNlbCA9IG5ldyBFdmVudEVtaXR0ZXI8YW55PigpO1xuXHRAT3V0cHV0KCkgb25DbGljayA9IG5ldyBFdmVudEVtaXR0ZXI8YW55PigpO1xuXG5cdHB1YmxpYyBmb3JtOiBGb3JtR3JvdXA7XG5cblx0cHVibGljIGNsb3NlZCA9IGZhbHNlO1xuXG5cdHB1YmxpYyBvYmpGaWx0ZXI6IGFueTtcblx0cHVibGljIGlucHV0Rm9jdXNlZDogYm9vbGVhbiA9IGZhbHNlO1xuXG5cdHB1YmxpYyBoZWlnaHRDb250ZW50OiBudW1iZXIgPSAwO1xuXG5cdHB1YmxpYyBhbHBoYWJldDogc3RyaW5nW10gPSBbXTtcblx0cHVibGljIGN1cnJlbnRBbHBoYTogc3RyaW5nID0gJyc7XG5cdHB1YmxpYyBjdXJyZW50TGV0dGVyRWxlbWVudDogYW55ID0gbnVsbDtcblxuXHRwdWJsaWMgaGlkZGVuVGl0bGU6IGJvb2xlYW4gPSBmYWxzZTtcblx0cHVibGljIGxldHRlcnNMaXN0SGVpZ2h0OiBudW1iZXIgPSAwO1xuXG5cdHB1YmxpYyBpbmRpY2F0b3JDbGlja2VkID0gZmFsc2U7XG5cblx0cHJpdmF0ZSBnb2luZ1RvTGV0dGVyOiBib29sZWFuID0gZmFsc2U7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSBmaWx0ZXI6IEZpbHRlclBpcGUsXG5cdFx0cHJpdmF0ZSByZW5kZXJlcjogUmVuZGVyZXIyLFxuXHRcdHByaXZhdGUgZm9ybUJ1aWxkZXI6IEZvcm1CdWlsZGVyLFxuXHQpIHtcblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IDI2OyBpKyspIHtcblx0XHRcdHRoaXMuYWxwaGFiZXQucHVzaChTdHJpbmcuZnJvbUNoYXJDb2RlKDk3ICsgaSkudG9VcHBlckNhc2UoKSk7XG5cdFx0fVxuXHRcdHRoaXMuZm9ybSA9IHRoaXMuZm9ybUJ1aWxkZXIuZ3JvdXAoe1xuXHRcdFx0c2VhcmNoOiBbbnVsbF1cblx0XHR9KTtcblx0XHR0aGlzLmZvcm0uZ2V0KCdzZWFyY2gnKS52YWx1ZUNoYW5nZXMuc3Vic2NyaWJlKHRoaXMuc2V0RmlsdGVyLmJpbmQodGhpcykpO1xuXHR9XG5cblx0bmdPbkluaXQoKSB7XG5cdFx0c2V0VGltZW91dCgoKSA9PiB7XG5cdFx0XHR0aGlzLnJlbmRlcmVyLmxpc3Rlbih0aGlzLnNlYXJjaExpc3RFbC5uYXRpdmVFbGVtZW50LCAnc2Nyb2xsJywgdGhpcy5vblNjcm9sbExpc3QuYmluZCh0aGlzKSk7XG5cblx0XHRcdHRoaXMucmVuZGVyZXIubGlzdGVuKHRoaXMuY29udGVudEVsLm5hdGl2ZUVsZW1lbnQsICdtb3VzZXVwJywgdGhpcy5vbk1vdXNlVXBDb250ZW50LmJpbmQodGhpcykpO1xuXHRcdFx0dGhpcy5yZW5kZXJlci5saXN0ZW4odGhpcy5jb250ZW50RWwubmF0aXZlRWxlbWVudCwgJ21vdXNlbW92ZScsIHRoaXMub25Nb3VzZU1vdmVDb250ZW50LmJpbmQodGhpcykpO1xuXG5cdFx0XHR0aGlzLnJlbmRlcmVyLmxpc3Rlbih0aGlzLmluZGljYXRvckVsLm5hdGl2ZUVsZW1lbnQsICdtb3VzZWRvd24nLCB0aGlzLm9uTW91c2VEb3duSW5kaWNhdG9yLmJpbmQodGhpcykpO1xuXHRcdFx0dGhpcy5yZW5kZXJlci5saXN0ZW4odGhpcy5pbmRpY2F0b3JFbC5uYXRpdmVFbGVtZW50LCAnbW91c2V1cCcsIHRoaXMub25Nb3VzZVVwSW5kaWNhdG9yLmJpbmQodGhpcykpO1xuXG5cdFx0XHR0aGlzLmhlaWdodENvbnRlbnQgPSB0aGlzLmNvbnRlbnRFbC5uYXRpdmVFbGVtZW50LmNsaWVudEhlaWdodCArICh0aGlzLm9uQ2FuY2VsID8gMjAgOiAzNyk7XG5cblx0XHRcdHRoaXMubGV0dGVyc0xpc3RIZWlnaHQgPSB0aGlzLmxldHRlckxpc3QubmF0aXZlRWxlbWVudC5jaGlsZHJlblswXS5jbGllbnRIZWlnaHQ7XG5cblx0XHRcdHRoaXMuZm9jdXNJbnB1dCgpO1xuXHRcdH0sIDEwMCk7XG5cdH1cblxuXHRuZ09uQ2hhbmdlcyhjaGFuZ2VzOiBTaW1wbGVDaGFuZ2VzKSB7XG5cdFx0aWYgKCdkYXRhJyBpbiBjaGFuZ2VzKSB7XG5cdFx0XHR0aGlzLmRhdGEgPSB0aGlzLm9yZGVyQnkoKTtcblx0XHRcdGlmICh0aGlzLmRhdGEgJiYgdGhpcy5wcm9wQWxwaGFPcmRlcikge1xuXHRcdFx0XHR0aGlzLmRhdGEuZm9yRWFjaCgoaXRlbSkgPT4ge1xuXHRcdFx0XHRcdGxldCBsZXR0ZXIgPSBpdGVtW3RoaXMucHJvcEFscGhhT3JkZXJdLnN1YnN0cigwLCAxKTtcblx0XHRcdFx0XHRpdGVtWyckbGV0dGVyJ10gPSBsZXR0ZXIudG9VcHBlckNhc2UoKTtcblx0XHRcdFx0XHRpdGVtWyckY2xhc3MnXSA9ICdsZXQtJyArIGxldHRlci50b0xvd2VyQ2FzZSgpO1xuXHRcdFx0XHR9KTtcblxuXHRcdFx0XHRzZXRUaW1lb3V0KCgpID0+IHRoaXMuZGVmaW5lQ3VycmVudExldHRlckVsZW1lbnQoKSwgMTAwKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0aWYgKCdwcm9wc1NlYXJjaCcgaW4gY2hhbmdlcyAmJiB0aGlzLnByb3BzU2VhcmNoKSB7XG5cdFx0XHRpZiAodHlwZW9mIHRoaXMucHJvcHNTZWFyY2ggPT09ICdzdHJpbmcnKVxuXHRcdFx0XHR0aGlzLnByb3BzU2VhcmNoID0gW3RoaXMucHJvcHNTZWFyY2hdO1xuXG5cdFx0XHR0aGlzLm9iakZpbHRlciA9IHt9O1xuXHRcdFx0Zm9yIChjb25zdCBwcm9wIG9mIHRoaXMucHJvcHNTZWFyY2gpIHsgdGhpcy5vYmpGaWx0ZXJbcHJvcF0gPSBudWxsOyB9XG5cdFx0XHR0aGlzLnNldEZpbHRlcigpO1xuXHRcdH1cblx0fVxuXG5cdGRlZmluZUN1cnJlbnRMZXR0ZXJFbGVtZW50KCkge1xuXHRcdGlmICghdGhpcy5nb2luZ1RvTGV0dGVyKSB7XG5cdFx0XHRjb25zdCB1bFBvc2l0aW9uID0gdGhpcy5zZWFyY2hMaXN0RWwubmF0aXZlRWxlbWVudC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcblx0XHRcdGNvbnN0IHVsVG9wID0gdWxQb3NpdGlvbi50b3A7XG5cblx0XHRcdGNvbnN0IGVsZW1lbnRzTGV0dGVycyA9IFtdO1xuXHRcdFx0bGV0IGN1cnJlbnQgPSBudWxsO1xuXHRcdFx0Zm9yIChjb25zdCBsaUVsZW1lbnQgb2YgKHRoaXMuc2VhcmNoTGlzdEVsLm5hdGl2ZUVsZW1lbnQuY2hpbGRyZW4gYXMgYW55KSkge1xuXHRcdFx0XHRsZXQgbGV0dGVyQ2xhc3MgPSAnJztcblxuXHRcdFx0XHRmb3IgKGNvbnN0IGNsYXNzTmFtZSBvZiBsaUVsZW1lbnQuY2xhc3NMaXN0KSB7XG5cdFx0XHRcdFx0aWYgKGNsYXNzTmFtZS5zdGFydHNXaXRoKCdsZXQtJykpIHtcblx0XHRcdFx0XHRcdGxldHRlckNsYXNzID0gY2xhc3NOYW1lO1xuXHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKGVsZW1lbnRzTGV0dGVycy5maWx0ZXIoeCA9PiB4LmNsYXNzTGlzdC5jb250YWlucyhsZXR0ZXJDbGFzcykpLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0XHRcdGVsZW1lbnRzTGV0dGVycy5wdXNoKGxpRWxlbWVudCk7XG5cblx0XHRcdFx0XHRjb25zdCBsaVBvc2l0aW9uID0gbGlFbGVtZW50LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuXHRcdFx0XHRcdGNvbnN0IGxpVG9wID0gbGlQb3NpdGlvbi50b3AgLSAyMDtcblxuXHRcdFx0XHRcdGlmIChsaVRvcCA8IHVsVG9wKSBjdXJyZW50ID0gbGlFbGVtZW50O1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGlmIChjdXJyZW50ICYmIGN1cnJlbnQgIT09IHRoaXMuY3VycmVudExldHRlckVsZW1lbnQpIHtcblx0XHRcdFx0Y3VycmVudC5jaGlsZHJlblswXVsncG9zaXRpb24nXSA9IGN1cnJlbnQuY2hpbGRyZW5bMF0uaW5uZXJIVE1MLmNoYXJDb2RlQXQoMCkgLSA2NTtcblx0XHRcdFx0dGhpcy5jdXJyZW50TGV0dGVyRWxlbWVudCA9IGN1cnJlbnQ7XG5cdFx0XHRcdHRoaXMuY3VycmVudEFscGhhID0gY3VycmVudC5jaGlsZHJlblswXS5pbm5lckhUTUw7XG5cdFx0XHR9XG5cdFx0XHRlbHNlIGlmICghY3VycmVudCkge1xuXHRcdFx0XHR0aGlzLmN1cnJlbnRMZXR0ZXJFbGVtZW50ID0gbnVsbDtcblx0XHRcdFx0dGhpcy5jdXJyZW50QWxwaGEgPSAnJztcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgZ29MZXR0ZXIobGV0dGVyOiBzdHJpbmcpIHtcblx0XHR0aGlzLmN1cnJlbnRBbHBoYSA9IGxldHRlcjtcblx0XHRmb3IgKGNvbnN0IGxpRWxlbWVudCBvZiAodGhpcy5zZWFyY2hMaXN0RWwubmF0aXZlRWxlbWVudC5jaGlsZHJlbiBhcyBhbnkpKSB7XG5cdFx0XHRsZXQgbGlMZXR0ZXIgPSAnJztcblxuXHRcdFx0Zm9yIChjb25zdCBjbGFzc05hbWUgb2YgbGlFbGVtZW50LmNsYXNzTGlzdCkge1xuXHRcdFx0XHRpZiAoY2xhc3NOYW1lLnN0YXJ0c1dpdGgoJ2xldC0nKSkge1xuXHRcdFx0XHRcdGxpTGV0dGVyID0gY2xhc3NOYW1lLnJlcGxhY2UoJ2xldC0nLCAnJykudG9VcHBlckNhc2UoKTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRpZiAobGV0dGVyID09PSBsaUxldHRlcikge1xuXHRcdFx0XHRsaUVsZW1lbnQuY2hpbGRyZW5bMF1bJ3Bvc2l0aW9uJ10gPSBsaUVsZW1lbnQuY2hpbGRyZW5bMF0uaW5uZXJIVE1MLmNoYXJDb2RlQXQoMCkgLSA2NTtcblx0XHRcdFx0dGhpcy5jdXJyZW50TGV0dGVyRWxlbWVudCA9IGxpRWxlbWVudDtcblxuXHRcdFx0XHRjb25zdCBsZXR0ZXJzRWxMaXN0ID0gdGhpcy5zZWFyY2hMaXN0RWwubmF0aXZlRWxlbWVudC5jaGlsZHJlbiBhcyBhbnk7XG5cdFx0XHRcdGNvbnN0IGxldHRlckVsZW1lbnQgPSBbLi4ubGV0dGVyc0VsTGlzdF0uZmluZCgoZWw6IEhUTUxFbGVtZW50KSA9PiB7XG5cdFx0XHRcdFx0Y29uc3Qgc3BsaXR0ZWQgPSBlbC5jbGFzc0xpc3QudmFsdWUuc3BsaXQoJyAnKTtcblx0XHRcdFx0XHRpZiAoc3BsaXR0ZWQubGVuZ3RoID4gMCAmJiBzcGxpdHRlZFtzcGxpdHRlZC5sZW5ndGggLSAxXS5pbmNsdWRlcygnLScpKSB7XG5cdFx0XHRcdFx0XHRjb25zdCBsZXR0ZXJDbGFzcyA9IHNwbGl0dGVkW3NwbGl0dGVkLmxlbmd0aCAtIDFdLnNwbGl0KCctJylbMV0udG9VcHBlckNhc2UoKTtcblx0XHRcdFx0XHRcdHJldHVybiBsZXR0ZXJDbGFzcyA9PT0gbGV0dGVyO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRpZiAobGV0dGVyRWxlbWVudCkge1xuXHRcdFx0XHRcdGNvbnN0IHNjcm9sbEhlaWdodCA9IHRoaXMuc2VhcmNoTGlzdEVsLm5hdGl2ZUVsZW1lbnQuc2Nyb2xsSGVpZ2h0IC0gdGhpcy5zZWFyY2hMaXN0RWwubmF0aXZlRWxlbWVudC5jbGllbnRIZWlnaHQ7XG5cdFx0XHRcdFx0Y29uc3Qgc2Nyb2xsVG9wID0gTWF0aC5taW4oc2Nyb2xsSGVpZ2h0LCBsZXR0ZXJFbGVtZW50Lm9mZnNldFRvcCk7XG5cblx0XHRcdFx0XHR0aGlzLnNlYXJjaExpc3RFbC5uYXRpdmVFbGVtZW50LnNjcm9sbFRvKHtcblx0XHRcdFx0XHRcdGxlZnQ6IDAsXG5cdFx0XHRcdFx0XHR0b3A6IHNjcm9sbFRvcCxcblx0XHRcdFx0XHRcdGJlaGF2aW9yOiAnc21vb3RoJ1xuXHRcdFx0XHRcdH0pO1xuXG5cdFx0XHRcdFx0dGhpcy5nb2luZ1RvTGV0dGVyID0gdHJ1ZTtcblx0XHRcdFx0XHRjb25zdCBjaGVja0lmU2Nyb2xsVG9Jc0ZpbmlzaGVkID0gc2V0SW50ZXJ2YWwoKCkgPT4ge1xuXHRcdFx0XHRcdFx0aWYgKHNjcm9sbFRvcCA9PT0gdGhpcy5zZWFyY2hMaXN0RWwubmF0aXZlRWxlbWVudC5zY3JvbGxUb3ApIHtcblx0XHRcdFx0XHRcdFx0Y2xlYXJJbnRlcnZhbChjaGVja0lmU2Nyb2xsVG9Jc0ZpbmlzaGVkKTtcblx0XHRcdFx0XHRcdFx0dGhpcy5nb2luZ1RvTGV0dGVyID0gZmFsc2U7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSwgNjApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXHRvbk1vdXNlTW92ZUNvbnRlbnQoZXZlbnQpIHtcblx0XHRpZiAoIXRoaXMuZm9ybS5nZXQoJ3NlYXJjaCcpLnZhbHVlICYmIHRoaXMuaW5kaWNhdG9yQ2xpY2tlZCkge1xuXHRcdFx0Zm9yIChjb25zdCBsZXR0ZXIgb2YgKHRoaXMubGV0dGVyTGlzdC5uYXRpdmVFbGVtZW50LmNoaWxkcmVuIGFzIGFueSkpIHtcblx0XHRcdFx0aWYgKGxldHRlci5jbGFzc0xpc3QuY29udGFpbnMoJ2NvbnRhaW5zJykpIHtcblx0XHRcdFx0XHRjb25zdCBwb3NpdGlvbiA9IGxldHRlci5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcblx0XHRcdFx0XHRjb25zdCBib3VuZHMgPSB7IHRvcDogcG9zaXRpb24ueSwgYm90dG9tOiAocG9zaXRpb24ueSArIGxldHRlci5jbGllbnRIZWlnaHQpIH07XG5cblx0XHRcdFx0XHRpZiAoZXZlbnQuY2xpZW50WSA+PSBib3VuZHMudG9wICYmIGV2ZW50LmNsaWVudFkgPD0gYm91bmRzLmJvdHRvbSkge1xuXG5cdFx0XHRcdFx0XHRpZiAodGhpcy5jdXJyZW50QWxwaGEgIT09IGxldHRlci5jaGlsZHJlblswXS5pbm5lckhUTUwpXG5cdFx0XHRcdFx0XHRcdHRoaXMuZ29MZXR0ZXIobGV0dGVyLmNoaWxkcmVuWzBdLmlubmVySFRNTCk7XG5cdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRvbk1vdXNlRG93bkluZGljYXRvcihldmVudCkgeyBpZiAoZXZlbnQuYnV0dG9uID09PSAwKSB0aGlzLmluZGljYXRvckNsaWNrZWQgPSB0cnVlOyB9XG5cblx0b25Nb3VzZVVwSW5kaWNhdG9yKGV2ZW50KSB7IHRoaXMuaW5kaWNhdG9yQ2xpY2tlZCA9IGZhbHNlOyB9XG5cblx0b25Nb3VzZVVwQ29udGVudChldmVudCkgeyB0aGlzLmluZGljYXRvckNsaWNrZWQgPSBmYWxzZTsgfVxuXG5cdG9uU2Nyb2xsTGlzdChlKSB7XG5cdFx0aWYgKCF0aGlzLmdvaW5nVG9MZXR0ZXIpIHtcblx0XHRcdGlmICghdGhpcy5pbmRpY2F0b3JDbGlja2VkKSB0aGlzLmRlZmluZUN1cnJlbnRMZXR0ZXJFbGVtZW50KCk7XG5cdFx0fVxuXHR9XG5cblx0b25Nb3VzZVdoZWVsQ29udGVudChldmVudDogYW55KSB7XG5cdH1cblxuXHRvbktleURvd25Db250ZW50KGV2ZW50OiBLZXlib2FyZEV2ZW50KSB7XG5cdFx0Y29uc3QgZSA9IGV2ZW50IGFzIGFueTtcblx0XHRjb25zdCBrZXkgPSAoZS5rZXkgfHwgZS5rZXlJZGVudGlmaWVyIHx8IGUua2V5Q29kZSkgYXMgYW55O1xuXHRcdGlmIChrZXkgPT09IDI3IHx8IGtleSA9PT0gJ0VzY2FwZScpXG5cdFx0XHR0aGlzLmNsb3NlKCk7XG5cdH1cblxuXHRjbGljayhkYXRhID0gbnVsbCkge1xuXHRcdHRoaXMub25DbGljay5lbWl0KGRhdGEpO1xuXHR9XG5cblx0Y2xvc2UoKSB7XG5cdFx0aWYgKHRoaXMub25DYW5jZWwub2JzZXJ2ZXJzLmxlbmd0aCA+IDApXG5cdFx0XHR0aGlzLm9uQ2FuY2VsLmVtaXQoKTtcblx0fVxuXG5cdGZvY3VzSW5wdXQoKSB7XG5cdFx0dGhpcy5pbnB1dFNlYXJjaEVsLm5hdGl2ZUVsZW1lbnQuZm9jdXMoKTtcblx0fVxuXG5cdHN0YXJ0c1dpdGhMZXR0ZXIoX2xldHRlcjogc3RyaW5nKSB7XG5cdFx0Y29uc3QgbGV0dGVyID0gX2xldHRlci50b1VwcGVyQ2FzZSgpO1xuXHRcdHJldHVybiB0aGlzLmZpbHRlci50cmFuc2Zvcm0odGhpcy5kYXRhLCB0aGlzLm9iakZpbHRlciwgdHJ1ZSlcblx0XHRcdC5maWx0ZXIoeCA9PiB4W3RoaXMucHJvcEFscGhhT3JkZXJdLnRvVXBwZXJDYXNlKCkuc3RhcnRzV2l0aChsZXR0ZXIpKVxuXHRcdFx0Lmxlbmd0aCA+IDA7XG5cdH1cblxuXHRzZXRGaWx0ZXIoKSB7XG5cdFx0aWYgKHRoaXMub2JqRmlsdGVyKSB7XG5cdFx0XHRPYmplY3Qua2V5cyh0aGlzLm9iakZpbHRlcikuZm9yRWFjaCgocHJvcCkgPT4ge1xuXHRcdFx0XHR0aGlzLm9iakZpbHRlcltwcm9wXSA9IHRoaXMuZm9ybS5nZXQoJ3NlYXJjaCcpLnZhbHVlXG5cdFx0XHR9KTtcblx0XHRcdHRoaXMub2JqRmlsdGVyID0gT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5vYmpGaWx0ZXIpO1xuXHRcdFx0c2V0VGltZW91dCgoKSA9PiB0aGlzLmRlZmluZUN1cnJlbnRMZXR0ZXJFbGVtZW50KCksIDEwMCk7XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIGNsZWFyRmlsdGVyKCkge1xuXHRcdHRoaXMuZm9ybS5nZXQoJ3NlYXJjaCcpLnNldFZhbHVlKG51bGwpO1xuXHRcdHRoaXMuc2V0RmlsdGVyKCk7XG5cdH1cblxuXHRwcml2YXRlIG9yZGVyQnkoKSB7XG5cdFx0cmV0dXJuIHRoaXMuZGF0YS5zb3J0KChhOiB7W2tleTogc3RyaW5nXTogc3RyaW5nfSwgYjogYW55KSA9PiB7XG5cdFx0XHRpZiAoYVt0aGlzLnByb3BBbHBoYU9yZGVyXS50b1VwcGVyQ2FzZSgpIDwgYlt0aGlzLnByb3BBbHBoYU9yZGVyXS50b1VwcGVyQ2FzZSgpKVxuXHRcdFx0XHRyZXR1cm4gLTE7XG5cdFx0XHRpZiAoYVt0aGlzLnByb3BBbHBoYU9yZGVyXS50b1VwcGVyQ2FzZSgpID4gYlt0aGlzLnByb3BBbHBoYU9yZGVyXS50b1VwcGVyQ2FzZSgpKVxuXHRcdFx0XHRyZXR1cm4gMTtcblxuXHRcdFx0cmV0dXJuIDA7XG5cdFx0fSk7XG5cdH1cblxuXHRuZ09uRGVzdHJveSgpOiB2b2lkIHtcblx0fVxufVxuIl19