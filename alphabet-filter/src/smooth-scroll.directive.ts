import { Directive, ElementRef, Renderer, OnDestroy, Input } from '@angular/core';

@Directive({ selector: '[smooth-scroll]' })
export class SmoothScrollDirective implements OnDestroy {

  @Input('smooth-scroll') public smoothScroll = true;

	private requestFrame: any = function(func) { window.setTimeout(func, 1000 / 50); };
  private moving: boolean = false;
  private pos: number = 0;
  private speed: number = 120;
  private smooth: number = 12;

  constructor(private element: ElementRef,
              private renderer: Renderer) {
                
    this.requestFrame = window['requestAnimationFrame'] ||
                        window['webkitRequestAnimationFrame'] ||
                        window['mozRequestAnimationFrame'] ||
                        window['oRequestAnimationFrame'] ||
                        window['msRequestAnimationFrame'] ||
                        function(func) { window.setTimeout(func, 1000 / 50); };
                        
    this.moving = false;
    this.pos = this.element.nativeElement.scrollTop;

    this.renderer.listen(this.element.nativeElement, 'mousewheel', this.mousewheel.bind(this));
    this.renderer.listen(this.element.nativeElement, 'DOMMouseScroll', this.mousewheel.bind(this));

    this.renderer.listen(this.element.nativeElement, 'scroll', this.scroll.bind(this));
  }

	public mousewheel = (e) => {
    if (this.smoothScroll) {
      e.preventDefault();
      
      let delta = e.delta || e.wheelDelta;
      
      if (delta === undefined) delta = -e.detail;
      
      delta = Math.max(-1, Math.min(1, delta));
  
      this.pos += -delta * this.speed;
      this.pos = Math.max(0, Math.min(this.pos, this.element.nativeElement.scrollHeight - this.element.nativeElement.clientHeight))
  
      if (!this.moving) this.update();
    }
	}

	public update = () => {
		this.moving = true;
		var delta = (this.pos - this.element.nativeElement.scrollTop) / this.smooth;
    this.element.nativeElement.scrollTop += delta;

		if (Math.abs(delta) > 1)
			this.requestFrame(this.update);
		else
			this.moving = false;
  }

  public scroll = () => {
    if (this.smoothScroll) {
      if (!this.moving) this.pos = this.element.nativeElement.scrollTop;
    }
  }
  
  ngOnDestroy() {
    
  }
}