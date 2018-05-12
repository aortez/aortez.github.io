import { Component } from '@angular/core';
import { World } from './world';

@Component({
  selector: 'app-root',
  template:
  `
    <app-view [world]="world"></app-view>
  `
})
export class AppComponent {
  world: World;

  constructor() {
    this.world = new World();
  }
}
