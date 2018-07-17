import { Component, ElementRef, Input, ViewChild, HostListener } from '@angular/core';
import { Ball } from '../ball';
import { Vec2 } from '../vec2';
import { World } from '../world';

@Component({
  selector: 'world-view',
  template:`
    <canvas #myCanvas id="canvas" class="canvasStyle" (window:resize)="onResize($event)"></canvas>
  `,
  styles: [`
    .canvasStyle {
      margin: 0;
      padding: 0;
      flex-shrink: 1;
      border: 0px solid black;
    }
  `],
})


export class WorldViewComponent {

  @ViewChild("myCanvas") canvas: ElementRef;

  @Input() world: World;

  private is_paused = false;
  private prev_time = 0;
  private should_resize = true;

  constructor() {
  }

  getDims() {
    const width = this.canvas.nativeElement.width;
    const height = this.canvas.nativeElement.height;
    return new Vec2(width, height);
  }

  get isPaused() {
    return this.is_paused;
  }

  ngAfterViewInit() {
    this.should_resize = true;
    const width = this.canvas.nativeElement.width;
    const height = this.canvas.nativeElement.height;
    console.log(`initial canvas width/height: ${width}/${height}`);
    this.step(0);
  }

  onResize(event) {
    this.should_resize = true;
  }

  public setPause(is_paused: boolean) {
    this.is_paused = is_paused;
    console.log(`is paused: ${this.is_paused}`);
    if (!this.is_paused) {
      this.prev_time = performance.now();
      this.step(this.prev_time); // kick off animation loop
    }
  }

  private resizeCanvas() {
    if (!this.should_resize) {
      return;
    }

    const element = document.getElementById("canvas-div");
    if (element) {
      const rect = element.getBoundingClientRect();
      const height = rect.height;
      const width = rect.width;
      const canvas = this.canvas.nativeElement;
      canvas.width = width;
      canvas.height = height;
      console.log(`resizeCanvas: width, height: ${width}/${height}`);
    } else {
      console.log("no element???");
    }
    this.should_resize = false;
  }

  private step( cur_time: number ) {
    if (!this.world || this.is_paused) {
      console.log(`this.is_paused: ${this.is_paused}`);
      return;
    }
    const ctx: CanvasRenderingContext2D = this.canvas.nativeElement.getContext("2d");
    this.resizeCanvas();

    // advance simluation
    const dt = cur_time - this.prev_time;
    this.prev_time = cur_time;
    // console.log(`step dt: ${dt}`);
    this.world.advance( dt );

    // clear screen
    ctx.fillStyle = 'black';
    const width = this.canvas.nativeElement.offsetWidth;
    const height = this.canvas.nativeElement.offsetHeight;
    ctx.fillRect(0, 0, width, height);

    // draw the world...
    this.world.draw( ctx, this.getDrawScale(), this.getTranslation() );

    // do it again
    window.requestAnimationFrame((cur_time) => this.step(cur_time));
  }

  private getDrawScale() {
    const scale_factor = Math.max( this.canvas.nativeElement.width, this.canvas.nativeElement.height ) * 0.5;
    return scale_factor;
  }

  private getTranslation() {
    let trans = new Vec2(this.canvas.nativeElement.width / 2, this.canvas.nativeElement.height / 2);
    trans.div(this.getDrawScale());
    return trans;
  }
}
