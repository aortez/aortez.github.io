let ctx;
let world;
let canvas;

function init() {
  let FPS = 60;

  world = new World();
  world.init();
  controller = new Controller( world );

  requestAnimationFrame( advance );
}

function advance() {

  canvas.height = window.innerHeight * 0.9;
  canvas.width = window.innerWidth * 0.9;

  world.draw( ctx );

  requestAnimationFrame( advance );
}
