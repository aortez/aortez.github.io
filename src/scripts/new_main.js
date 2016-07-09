let world;
let controller;
let canvas;
let view;

function mouseDown( e ) {
  controller.mouseDown( e );
  document.removeEventListener( "mousedown", mouseDown, false );
  document.addEventListener( "mouseup", mouseUp, false );
  // e.preventDefault();
}

function mouseUp( e ) {
  controller.mouseUp( e );
  document.removeEventListener( "mouseup", mouseUp, false );
  document.addEventListener( "mousedown", mouseDown, false );
}

function mouseMove( e ) {
  controller.mouseMove( document, e, view );
}

function ball_button( e ) {
  world = new World();
  view.clear();
  controller = new Controller( world );
  console.log( "ball time" );
}

function space_button( e ) {
  world = new SpaceWorld();
  controller = new Controller( world );
  console.log( "space time" );
}

function init() {
  view = new View();

  ball_button();

	document.addEventListener( 'mousedown', mouseDown, false );
  document.addEventListener( "mousemove", mouseMove, false );

  let slider = document.getElementById('slider');
  slider.addEventListener( 'value-change', world.sliding, false );

  requestAnimationFrame( advance );
}

let previous = null;
function advance() {
  let now = window.performance.now();
  let dt = now - previous;
  previous = now;

  world.advance( dt * 0.05 );

  world.draw( view );

  view.render();

  requestAnimationFrame( advance );
}
