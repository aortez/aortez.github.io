import { Component } from '@angular/core';
import { World } from './world';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  world: World;

  constructor() {
    this.world = new World();
  }
}
