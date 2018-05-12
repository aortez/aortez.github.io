import { Component } from '@angular/core';
import { World } from './world';

@Component({
  selector: 'app-root',
  template:`
  <div class="container">
    <div>foo!!!!</div>

    <div class="child" id="canvas-div">
      <app-view [world]="world"></app-view>
    </div>

    <div>fee!!!!</div>
  </div>
  `,
  styles: [`
    .container {
      height: 100%;
      width: 100%;
      display: flex;
      flex-direction: column;
      flex: 1;
    }
    .child {
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
