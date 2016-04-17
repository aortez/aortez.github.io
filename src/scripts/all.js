var FPS = 60;
var counter = -100;
var ctx;
var frameDuration = 0;
var dir = 1;
var world;
var ball;
var controller;
var canvas;

function mouseDown( e ) {
  controller.mouseDown( e );
  canvas.removeEventListener( "mousedown", mouseDown, false );
  window.addEventListener( "mouseup", mouseUp, false );

  // e.preventDefault();
}

function mouseUp( e ) {
  controller.mouseUp( e );
  window.removeEventListener( "mouseup", mouseUp, false );
  canvas.addEventListener( "mousedown", mouseDown, false );
}

function mouseMove( e ) {
  controller.mouseMove( canvas, e );
}

function mouseOut( e ) {
  controller.mouseOut();
}

function mouseOver( e ) {
  controller.mouseOver();
}

function init() {

  world = new World();
  controller = new Controller( world );

  var slider = document.getElementById('slider');
  slider.addEventListener( 'value-change', world.sliding, false );

  setInterval( function() { advance(); }, 1000 / FPS );

  canvas = document.getElementById( 'pizza' );

  canvas.addEventListener( "mousedown", mouseDown, false );
  window.addEventListener( "mousemove", mouseMove, false );
  canvas.addEventListener( "mouseout", mouseOut, false );
  canvas.addEventListener( "mouseover", mouseOver, false );


  ctx = canvas.getContext( '2d' );
}

var previous = null;
function advance() {

  canvas.width  = window.innerWidth * 0.9;
  canvas.height = window.innerHeight * 0.8;
  world.max_x = canvas.width;
  world.max_y = canvas.height;

  var now = window.performance.now();
  var dt = now - previous;
  previous = now;

  draw( dt * 0.05 );

  controller.advance();

  world.doPhysics( dt * 0.05 );

  world.draw( ctx );
}

function draw( dt )
{
  var start = window.performance.now();

  var canvas = document.getElementById( 'pizza' );
  if ( !canvas.getContext ) {
    return;
  }
  if ( !ctx ) {
    ctx = getContext();
  }

  counter += ( dir * dt );
  var counterMax = 70;
  if ( counter > counterMax ) dir = -1;
  if ( counter <= -100 ) dir = 1;

  var ratio = canvas.height / canvas.width;

  var num_cols = 20;
  var num_rows = ratio * num_cols;
  var cell_width = canvas.width / num_cols;
  var cell_height = canvas.height / num_rows;

  var red = 0;
  var green = 0;
  var blue = 0;
  var c = ( 255.0 * Math.pow( ( counter + 100 ) / ( counterMax + 100 ), 4 ) ).toFixed(0);
  ctx.fillStyle = "rgb(" + 0 + "," + c + "," + 0 + ")";
  ctx.fillRect( 0, 0, canvas.width, canvas.height );
  for ( var y = 0; y < num_rows; y++ ) {
    for ( var x = 0.0; x < num_cols; x++ ) {
      red = 0;
      green = counter.toFixed(0);
      blue = ( 256.0 * ( (  x + ( x % 2 === 0 ? y : -y ) + counter * 0.5 ) / num_cols ) ).toFixed(0);
      var cell_size = Math.pow( blue / 256, 0.1 );
      ctx.fillStyle = "rgb(" + red + "," + green + "," + blue + ")";
      ctx.fillRect( x * cell_width, y * cell_height, cell_width * cell_size, cell_height * cell_size );
    }
  }

  var stop = window.performance.now();
  var elapsed = stop - start;
  frameDuration = 0.99 * frameDuration + 0.01 * elapsed;
  if ( counter % 50 === 0 ) { console.log( "frame duration: " + frameDuration ); }
}
