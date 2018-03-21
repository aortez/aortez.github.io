import { Component, ElementRef, Input, ViewChild } from '@angular/core';
import { Ball } from '../ball';
import { World } from '../world';

@Component({
  selector: 'app-view',
  templateUrl: './view.component.html',
  styleUrls: ['./view.component.css']
})
export class ViewComponent {

  @ViewChild("myCanvas") canvas: ElementRef;

  @Input() world: World;

  constructor() {}

  ngAfterViewInit() {
    this.paint();
  }

  private paint() {

    const context: CanvasRenderingContext2D = this.canvas.nativeElement.getContext("2d");
    context.fillStyle = 'black';
    context.fillRect(0, 0, 200, 200);
    context.fillStyle = this.world.background_color.toRgb();
    context.fillRect(10, 10, 150, Math.random() * 100);

    requestAnimationFrame(() => this.paint());
  }
}
