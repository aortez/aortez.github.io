import { Component, ElementRef, Input, ViewChild, HostListener } from '@angular/core';
import { Ball } from '../ball';
import { World } from '../world';

@Component({
  selector: 'app-view',
  template:`
  <div id="view-div" class="container" (window:resize)="onResize($event)">
     <canvas #myCanvas id='canvas' drawing></canvas>
  </div>`,
  styles: [
    `box { display: flex; flex: 1 1 auto; }`,
    `.height-full { height: 100vh; }`,
    `.container{
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
    }`
   ],
})
export class ViewComponent {

  @ViewChild("myCanvas") canvas: ElementRef;

  @Input() world: World;

  private shouldResize = true;

  constructor() {
  }

  ngAfterViewInit() {
    this.shouldResize = true;
    this.paint();
    const width = this.canvas.nativeElement.width;
    const height = this.canvas.nativeElement.height;
    console.log(`initial canvas width/height: ${width}/${height}`);
  }

  onResize(event) {
    this.shouldResize = true;
 }

  private resizeCanvas() {
        if (!this.shouldResize) {
          return;
        }

        const element = document.getElementById("view-div");
        if (element) {
          const positionInfo = element.getBoundingClientRect();
          const height = positionInfo.height;
          const width = positionInfo.width;
          console.log(`view-div width, height: ${width}/${height}`);
          this.canvas.nativeElement.width = width;
          this.canvas.nativeElement.height = height - 25;
        } else {
          console.log("no element???");
        }
        this.shouldResize = false;
  }

  private paint() {
    this.resizeCanvas();

    const context: CanvasRenderingContext2D = this.canvas.nativeElement.getContext("2d");
    context.fillStyle = 'black';
    const width = this.canvas.nativeElement.offsetWidth;
    const height = this.canvas.nativeElement.offsetHeight;
    context.fillRect(0, 0, width, height);
    context.fillStyle = this.world.background_color.toRgb();
    context.fillRect(0, 0, width, height);

    this.world.advance();

    requestAnimationFrame(() => this.paint());
  }
}
