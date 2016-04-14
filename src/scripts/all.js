var FPS = 60;
var counter = -100;
var ctx;
var frameDuration = 0;
var dir = 1;
var mousePos = { x: 0, y: 0 };
var mouseIsDown = false;
var world;
var ball;

function writeMessage( canvas, message )
{
  var context = canvas.getContext('2d');
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.font = '18pt Calibri';
  context.fillStyle = 'black';
  context.fillText(message, 10, 25);
}

function getMousePos( canvas, evt )
{
  var rect = canvas.getBoundingClientRect();
  return {
    x: evt.clientX - rect.left,
    y: evt.clientY - rect.top
  };
}

function mouseDown( e ) {
  console.log( "mouse down" );
  mouseIsDown = true;

  // check if cursor is over any balls
  var grabbed_ball = world.retrieveBall( mousePos.x, mousePos.y );
  if ( grabbed_ball ) {
    ball = grabbed_ball;
  }
  else {
    var r = Math.random() * 50 + 50;
    var c = new vec3( 255, 0, 0 );
    ball = new Ball( mousePos.x, mousePos.y, r, c );
    world.addBall( ball );
  }

  window.removeEventListener( "mousedown", mouseDown, false );
  window.addEventListener( "mouseup", mouseUp, false );
  e.preventDefault();
}

function mouseUp( e ) {
  console.log( "mouse up" );
  mouseIsDown = false;
  window.addEventListener( "mousedown", mouseDown, false );
  ball.hp = ball.calcHp();
  var alpha = 1;
  ball.v.x = ( 1 - alpha ) * ball.v.x + alpha * ( mousePos.x - ball.center.x );
  ball.v.y = ( 1 - alpha ) * ball.v.y + alpha * ( mousePos.y - ball.center.y );
}

function init()
{
  // var slider = document.getElementById('slider');
  // slider.addEventListener( 'value-change', world.sliding, false );
  // if ( slider ) {
  //   console.log('slider value' + slider.value);
  //   slider.addEventListener( 'value-change', function() {
  //     console.log("slider.value: " + slider.value);
  //   });
  // }
  // else {
  //   console.log('no slider');
  // }

  world = new World();

  var slider = document.getElementById('slider');
  slider.addEventListener( 'value-change', world.sliding, false );

  setInterval( function() { advance(); }, 1000 / FPS );

  var canvas = document.getElementById( 'pizza' );
  if ( !canvas.getContext ) {
    return;
  }

  canvas.addEventListener( "mousedown", mouseDown, false );

  canvas.onmousemove = function( evt ) {
    mousePos = getMousePos( canvas, evt );
  };

  ctx = canvas.getContext( '2d' );
}

var previous = null;
function advance() {
  var canvas = document.getElementById( 'pizza' );
  if ( !canvas.getContext ) {
    return;
  }
  if ( !ctx ) {
    ctx = getContext();
  }

  canvas.width  = window.innerWidth * 0.9;
  canvas.height = window.innerHeight * 0.8;
  world.max_x = canvas.width;
  world.max_y = canvas.height;

  var now = window.performance.now();
  var dt = now - previous;
  previous = now;

  draw( dt * 0.05 );

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

  if ( mouseIsDown && ball ) {
    ball.c.x = 255;
    ball.c.y = green;
    ball.c.z = blue;
    ball.hp = ball.calcHp() * 1000;
    var alpha = 0.05;
    ball.v.x = ( 1 - alpha ) * ball.v.x + alpha * ( mousePos.x - ball.center.x );
    ball.v.y = ( 1 - alpha ) * ball.v.y + alpha * ( mousePos.y - ball.center.y );
    ball.center.x = mousePos.x;
    ball.center.y = mousePos.y;
  }

  var stop = window.performance.now();
  var elapsed = stop - start;
  frameDuration = 0.99 * frameDuration + 0.01 * elapsed;
  if ( counter % 50 === 0 ) { console.log( "frame duration: " + frameDuration ); }
}
