import { Component, Input, Output, EventEmitter, OnInit, ViewChild, ElementRef, OnChanges, SimpleChanges, ContentChild, TemplateRef, Renderer, OnDestroy } from '@angular/core';
import { ClassField } from '@angular/compiler';
import { FilterPipe } from './filter.pipe';

@Component({
    selector: 'alphabet-filter',
    templateUrl: './alphabet-filter.component.html',
    host: {
      '(document:mousewheel)': 'onMouseWheelContent($event)',
      '(document:keydown)': 'onKeyDownContent($event)'
    },
  })
export class AlphabetFilterComponent implements OnInit, OnChanges, OnDestroy {
  @ContentChild(TemplateRef) templateRef: TemplateRef<any>;

  @ViewChild('inputBody') public inputBodyEl: ElementRef;
  @ViewChild('inputSearch') public inputSearchEl: ElementRef;
  @ViewChild('searchList') public searchListEl: ElementRef;
  @ViewChild('letterList') public letterList: ElementRef;
  @ViewChild('indicator') public indicatorEl: ElementRef;
  @ViewChild('content') public contentEl: ElementRef;

  @Input() height: string = '300px';
  @Input() propAlphaOrder: string = '';
  @Input() propsSearch: any = [];
  @Input() data: any[] = [];
  @Input() placeholder: string = 'digite sua busca';
  @Input() listClass: string = null;
  @Input() withTemplate: boolean = false;

  @Output() onCancel = new EventEmitter<any>();
  @Output() onClick = new EventEmitter<any>();

  public closed: boolean = false;

  public inputModel: string = null;
  public objFilter: any;
  public inputFocused: boolean = false;

  public heightContent: number = 0;

  public alphabet: string[] = [];
  public currentAlpha: string  = '';
  public currentLetterElement: any  = null;

  public hiddenTitle: boolean = false;
  public lettersListHeight: number = 0;

  public indicatorClicked = false;

  private timer: any = null;

  constructor(private filter: FilterPipe,
              private renderer: Renderer) {

    for(var i = 0; i < 26; i++)
      this.alphabet.push(String.fromCharCode(97 + i).toUpperCase());
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

  smoothScrollTop(scroll, duration?) {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    let element = this.searchListEl.nativeElement;
    let start = element.scrollTop;

    if(scroll < 0) scroll = 0;

    let distance = (scroll - start) - 77;

    let startTime = new Date().getTime();

    if (!duration) duration = 400;

    let easeInOutQuart = (time, from, distance, duration) => {
      if ((time /= duration / 2) < 1) return distance / 2 * time * time * time * time + from;
      return -distance / 2 * ((time -= 2) * time * time * time - 2) + from;
    };

    this.timer = setInterval(() => {
      const time = new Date().getTime() - startTime,
      newTop = easeInOutQuart(time, start, distance, duration);

      if (time >= duration) {
        clearInterval(this.timer);
        this.timer = null;
      }

      if (element.scrollTo) element.scrollTo(element.scrollLeft, newTop);
      else element.scrollTop = newTop;
    }, 1000 / 60);
  };

  ngOnChanges(changes: SimpleChanges) {
    if ('data' in changes) {
      this.data = this.orderBy();
      if (this.data && this.propAlphaOrder){
        this.data.forEach((item) => {
          let letter = item[this.propAlphaOrder].substr(0,1);
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
      for(let prop of this.propsSearch) { this.objFilter[prop] = null; }
      this.setFilter();
    }
  }

  defineCurrentLetterElement() {
    if (!this.timer) {

      let ulPosition = this.searchListEl.nativeElement.getBoundingClientRect();
      let ulTop = ulPosition.top;

      let elementsLetters = [];
      let current = null;

      for (let liElement of this.searchListEl.nativeElement.children) {
        let letterClass = '';

        for (let className of liElement.classList) {
          if (className.startsWith('let-')) {
            letterClass = className;
            break;
          }
        }

        if (elementsLetters.filter(x => x.classList.contains(letterClass)).length === 0) {
          elementsLetters.push(liElement);

          let liPosition = liElement.getBoundingClientRect();
          let liTop = liPosition.top - 20;

          if (liTop < ulTop) current = liElement;
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

  goLetter(letter: string) {
    this.currentAlpha = letter;
    for (let liElement of this.searchListEl.nativeElement.children) {
      let liLetter = '';

      for (let className of liElement.classList) {
        if (className.startsWith('let-')) {
          liLetter = className.replace('let-','').toUpperCase();
          break;
        }
      }

      if (letter === liLetter) {
        liElement.children[0]['position'] = liElement.children[0].innerHTML.charCodeAt(0) - 65;
        this.currentLetterElement = liElement;

        this.smoothScrollTop(liElement.offsetTop - 10);

        break;
      }
    }
  }
  onMouseMoveContent(event){
    if (!this.inputModel && this.indicatorClicked) {
      for (let letter of this.letterList.nativeElement.children) {
        if (letter.classList.contains('contains')) {
          let position = letter.getBoundingClientRect();
          let bounds = { top: position.y, bottom: (position.y + letter.clientHeight) };

          if (event.clientY >= bounds.top && event.clientY <= bounds.bottom) {

            if (this.currentAlpha !== letter.children[0].innerHTML)
              this.goLetter(letter.children[0].innerHTML);
            break;
          }
        }
      }
    }
  }

  onMouseDownIndicator(event) { if (event.button === 0) this.indicatorClicked = true; }

  onMouseUpIndicator(event) { this.indicatorClicked = false; }

  onMouseUpContent(event) { this.indicatorClicked = false; }

  onScrollList(e) {
    if (!this.indicatorClicked) this.defineCurrentLetterElement();
  }
  
  onMouseWheelContent(event: any) {
  }

  onKeyDownContent(event: KeyboardEvent) {
    if (event.keyCode === 27)
      this.close();
  }

  click(data = null) {
    this.onClick.emit(data)
  }

  close() {
    if (this.onCancel.observers.length > 0)
      this.onCancel.emit();
  }

  focusInput() {
    this.inputSearchEl.nativeElement.focus();
  }

  startsWithLetter(letter: string) {
    return this.filter.transform(this.data, this.objFilter, true)
                      .filter(x => x[this.propAlphaOrder].startsWith(letter.toUpperCase()))
                      .length > 0;
  }

  setFilter() {
    if (this.objFilter) {
      Object.keys(this.objFilter).forEach((prop) => this.objFilter[prop] = this.inputModel);
      this.objFilter = Object.assign({}, this.objFilter);
      setTimeout(() => this.defineCurrentLetterElement(), 100);
    }
  }

  clearFilter() {
    this.inputModel = null;
    this.setFilter();
  }

  orderBy() { 
    return this.data.sort((a: any, b: any) => {
      if (a[this.propAlphaOrder] < b[this.propAlphaOrder])
        return -1;
      if (a[this.propAlphaOrder] > b[this.propAlphaOrder])
        return 1;
          
      return 0;
    });
  }

  ngOnDestroy(): void {
  }
}
