import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

import { AppComponent } from './app.component';
import { WorldViewComponent } from './worldview/worldview.component';
import { Controller } from './controller';


@NgModule({
  declarations: [
    AppComponent,
    Controller,
    WorldViewComponent
  ],
  imports: [
    BrowserModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
