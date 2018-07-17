import {
  AfterViewInit,
  Component,
  ViewChild
} from '@angular/core';
import { Controller } from './controller';
import { World } from './world';
import { WorldViewComponent } from './worldview/worldview.component';
import { Vec2 } from './vec2';

@Component({
  selector: 'app-root',
  template:`
  <div class="parent">
    <div>some stuff on top</div>

    <div class="growingChild" id="canvas-div">
      <world-view [world]="world"></world-view>
      <controller></controller>
    </div>

    <div>some stuff on bottom</div>
  </div>
  `,
  styles: [`
    .parent {
      height: 100%;
      width: 100%;
      display: flex;
      flex-direction: column;
      flex: 1;
    }
    .growingChild {
      display: flex;
      flex: 1;
    }
  `]
})

export class AppComponent implements AfterViewInit {
  @ViewChild(Controller) controller: Controller;
  @ViewChild(WorldViewComponent) view: WorldViewComponent;
  world: World;


  constructor() {
    this.world = new World();
  }

  ngAfterViewInit() {
    const viewDims = this.view.getDims();
    const scale = this.view.getDrawScale() * 2;

    const min = new Vec2( -viewDims.x / scale, -viewDims.y / scale );
    const max = new Vec2( viewDims.x / scale, viewDims.y / scale );

    this.world.setBoundingBox( min, max );
    this.view.setPause( true );
    this.controller.setWorld( this.world );
    this.controller.setView( this.view );
    console.log(`viewDims: ${JSON.stringify(viewDims)} 🍕`);
 }
}
