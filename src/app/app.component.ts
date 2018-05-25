import { Component } from '@angular/core';
import { World } from './world';

@Component({
  selector: 'app-root',
  template:`
  <div class="parent">
    <div>some stuff on top</div>

    <div class="growingChild" id="canvas-div">
      <world-view [world]="world"></world-view>
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

export class AppComponent {
  world: World;

  constructor() {
    this.world = new World();
  }
}
