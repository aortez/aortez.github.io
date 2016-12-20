
class vec3
{
  constructor( x, y, z ) {
    this.x = x;
    this.y = y;
    this.z = z;
    // console.log( "x, y: " + x + ", " + y );
  }

  copy() {
    let c = new vec3( this.x, this.y, this.z );
    return c;
  }

  times( scalar ) {
    this.x *= scalar;
    this.y *= scalar;
    this.z *= scalar;
    return this;
  }

  toRGB() {
    let rgb = "rgb(" + this.x + "," + this.y + "," + this.z + ")";
    return rgb;
  }

  randColor( variation ) {
    let c = this;
    c.x += Math.floor( variation * ( Math.random() - 0.5 ) );
    c.y += Math.floor( variation * ( Math.random() - 0.5 ) );
    c.z += Math.floor( variation * ( Math.random() - 0.5 ) );
    c.x = Math.min( 255, c.x ); c.x = Math.max( 0, c.x );
    c.y = Math.min( 255, c.y ); c.y = Math.max( 0, c.y );
    c.z = Math.min( 255, c.z ); c.z = Math.max( 0, c.z );
  }

}

var ObjectType = {
  NONE: 1,
  BALL: 2,
  PLANET: 3
};

class Controller
{
  constructor( world ) {
    this.ball = null;
    this.mousePos = new vec2( 0, 0 );
    this.mouseIsDown = false;
    this.world = world;
    this.cursor_v = new vec2( 0, 0 );
    this.next_object_type = ObjectType.BALL;
  }

  advance() {
    let b = this.ball;
    if ( this.mouseIsDown && b ) {
    //   ball.c.x = 255;
    //   ball.c.y = green;
    //   ball.c.z = blue;
      b.hp = b.calcHp() * 1000;
      b.v.x = 0;
      b.v.y = 0;
    }
  }

  mouseMove( canvas, e ) {
    let rect = canvas.getBoundingClientRect();
    this.mousePos.x = e.clientX - rect.left;
    this.mousePos.y = e.clientY - rect.top;

    let b = this.ball;
    if ( this.mouseIsDown && b ) {
      // record cursor movement while the button is down
      let d = this.mousePos.copy().minus( b.center );
      let alpha = 0.5;
      this.cursor_v.x = this.cursor_v.x * ( 1 - alpha ) + alpha * d.x;
      this.cursor_v.y = this.cursor_v.y * ( 1 - alpha ) + alpha * d.y;

      // keep the ball alive and move it to follow the cursor
      b.hp = b.calcHp() * 1000;
      b.center.x = this.mousePos.x;
      b.center.y = this.mousePos.y;
    }

  }

  mouseDown( e ) {
    console.log( "mouse down" );
    this.mouseIsDown = true;

    // check if cursor is over any balls
    let grabbed_ball = this.world.retrieveBall( this.mousePos.x, this.mousePos.y );
    if ( grabbed_ball ) {
      console.log("grabbed");
      this.ball = grabbed_ball;
    } else {
      let r = Math.random() * 50 + 50;
      let c = new vec3( 128, 128, 128 );
      c.randColor( 255 );
      this.ball = new Ball( this.mousePos.x, this.mousePos.y, r, c );
      if ( this.next_object_type == ObjectType.PLANET ) {
        this.ball.r = this.ball.r * 2;
        this.ball.is_affected_by_gravity = true;
        this.ball.m = this.ball.r * this.ball.r * 10;
        this.ball.hp = this.ball.r * this.ball.r * 10000;
        this.ball.is_moving = false;
        this.ball.is_invincible = true;
        this.world.addPlanet( this.ball );
        console.log("adding planet");
      } else {
        this.ball.is_affected_by_gravity = true;
        this.ball.v = this.cursor_v;
        this.ball.m = this.ball.r * this.ball.r;
        this.ball.is_moving = true;
        this.ball.is_invincible = false;
        this.ball.can_move = true;
        this.world.addBall( this.ball );
        console.log("adding ball");
      }
    }
  }

  mouseUp( e ) {
    console.log( "mouse up" );
    if ( !this.mouseIsDown ) {
      console.log( "mouse is _not_ down" );
      return;
    }
    this.mouseIsDown = false;

    let b = this.ball;

    // set released ball to full life
    b.hp = b.calcHp();

    // toss it in the direction of recent movement
    b.v = this.cursor_v.copy();

    // clear recent cursor movement so we don't accidentally reuse it
    this.cursor_v = new vec2( 0, 0 );

    // good bye ball
    this.ball = null;
  }

  mouseOut( e ) {
    console.log( "mouse OUT" );
    if ( this.mouseIsDown ) {
      this.mouseUp( e );
    }
  }

  mouseOver( e ) {
    console.log("mouse over" );
  }

  requestPlanet() {
    console.log("I want a planet!!!!!!!!!!!!");
    this.next_object_type = ObjectType.PLANET;
  }

  requestBall() {
    console.log("I want a ball &&&&&&&&&&&&&&");
    this.next_object_type = ObjectType.BALL;
  }
}

class Background
{
  constructor() {
    this.counter = -100;
    this.frameDuration = 0;
    this.dir = 1;
    this.counterMax = 70;
  }

  advance( dt ) {
    this.counter += ( this.dir * dt );
    if ( this.counter > this.counterMax ) this.dir = -1;
    if ( this.counter <= -100 ) this.dir = 1;
  }

  draw() {
    let ratio = canvas.height / canvas.width;

    let num_cols = 20;
    let num_rows = ratio * num_cols;
    let cell_width = canvas.width / num_cols;
    let cell_height = canvas.height / num_rows;

    let red = 0;
    let green = 0;
    let blue = 0;
    let c = ( 255.0 * Math.pow( ( this.counter + 100 ) / ( this.counterMax + 100 ), 4 ) ).toFixed(0);
    ctx.fillStyle = "rgb(" + 0 + "," + c + "," + 0 + ")";
    ctx.fillRect( 0, 0, canvas.width, canvas.height );
    for ( let y = 0; y < num_rows; y++ ) {
      for ( let x = 0.0; x < num_cols; x++ ) {
        red = 0;
        green = this.counter.toFixed(0);
        blue = ( 256.0 * ( (  x + ( x % 2 === 0 ? y : -y ) + this.counter * 0.5 ) / num_cols ) ).toFixed(0);
        let cell_size = Math.pow( blue / 256, 0.1 );
        ctx.fillStyle = "rgb(" + red + "," + green + "," + blue + ")";
        ctx.fillRect( x * cell_width, y * cell_height, cell_width * cell_size, cell_height * cell_size );
      }
    }

  }

}

class Ball
{
  constructor( x, y, r, c ) {
    this.center = new vec2( x, y );
    this.v = new vec2( 0, 0 );
    this.r = r; // radius
    this.color = c; // color
    this.hp = r * r; // current hit points
    this.hp_max = r * r; // max hit points
    this.m = r * r; // mass
    this.is_affected_by_gravity = true;
    this.is_moving = true;
    this.is_invincible = true;

    this.pattern = null;
  }

  calcHp() {
    let hp = this.r * this.r;
    return hp;
  }

  collide( b ) {
    let DAMAGE_SCALAR = 0.002;
    // let DAMAGE_SCALAR = 0.05;

    // distance between centers
    let D = this.center.copy().minus( b.center );

    // test to see if circles are in the exact same spot
    let delta = D.mag();
    // or if they are sitting exactly on top of each other
    let offset = Math.abs( this.center.x - b.center.x );
    while ( delta === 0 || offset < 0.001 ) {
      let max_jitter = 0.01;
      // give the other object a small random jitter
      b.center.x += Math.random() * max_jitter;
      b.center.y += Math.random() * max_jitter;
      D = this.center.copy().minus( b.center );
      delta = D.mag();
      offset = Math.abs( this.center.x - b.center.x );
    }

    // normalize vector between centers
    let Dn = D.normalize();

    // minimum translation distance to separate circles
    let T = new vec2( Dn.x, Dn.y );
    T.times( this.r + b.r - delta );

    // compute masses
    let m1 = this.m;
    let m2 = b.m;
    let M = m1 + m2;

    // if ( !this.is_moving ) { b.center.minus( T );  }
    // else if ( !b.is_moving ) { this.center.plus( T ); }
    // else {
    //   // push the circles apart proportional to their mass
    this.center.plus( T.copy().times( m2 / M ) );
    b.center.minus( T.copy().times( m1 / M ) );
    // }

    // if neither can move, as soon as we've moved the objects, we don't need to adjust their velocity any further
    if ( !b.is_moving && !this.is_moving ) {
      return;
    }

    // vector tangential to the collision plane
    let Dt = new vec2( Dn.y, -Dn.x );

    // split the velocity vector of the first ball into a normal and a tangential component in respect of the collision plane
    let v1n = Dn.copy().times( this.v.dot( Dn ) );
    let v1t = Dt.copy().times( this.v.dot( Dt ) );

    // split the velocity vector of the second ball into a normal and a tangential component in respect of the collision plane
    let v2n = Dn.copy().times( b.v.dot( Dn ) );
    let v2t = Dt.copy().times( b.v.dot( Dt ) );

    // calculate new velocity vectors of the balls, the tangential component stays the same, the normal component changes
    let elastic_factor = 0.9;
    let dv1t = Dn.copy().times( ( m1 - m2 ) /  M * v1n.mag() + 2 * m2 / M * v2n.mag() );
    let dv2t = Dn.times( ( m2 - m1 ) / M * v2n.mag() + 2 * m1 / M * v1n.mag() );
    this.v = v1t.plus( dv1t.times( elastic_factor ) );
    b.v = v2t.minus( dv2t.times( elastic_factor ) );

    // damage life based upon change in momemtum
    this.hp -= ( dv1t.mag() * m1 * DAMAGE_SCALAR );
    b.hp -= ( dv2t.mag() * m2  * DAMAGE_SCALAR );
    // console.log( "this.hp: " + this.hp );
  }

  draw( ctx, pizza_time ) {
    if ( !this.pattern ) {
      var imageObj = new Image();
      // imageObj.src = 'http://www.html5canvastutorials.com/demos/assets/wood-pattern.png';
      imageObj.src = 'http://s3.amazonaws.com/spoonflower/public/design_thumbnails/0289/6414/rrrpizza_pepperoni_shop_preview.png';
      this.pattern = ctx.createPattern(imageObj, 'repeat');
    }

    var sizeWidth = ctx.canvas.clientWidth;
    var sizeHeight = ctx.canvas.clientHeight;
    var scaleWidth = sizeWidth / 100;
    var scaleHeight = sizeHeight / 100;
    let scale = sizeHeight / 800;
    let r_scaled = this.r * scale;
    // r_scaled = this.r;
    let x_scaled = this.center.x * scale;
    let y_scaled = this.center.y * scale;

    ctx.beginPath();
    // ctx.arc( x_scaled, y_scaled, r_scaled, 0, 2 * Math.PI, false );
    ctx.arc( this.center.x, this.center.y, this.r, 0, 2 * Math.PI, false );
    if ( pizza_time ) {
      ctx.fillStyle = this.pattern;
    } else {
      ctx.fillStyle = "rgb(" + this.color.x + "," + this.color.y + "," + this.color.z + ")";
    }
    ctx.fill();
    ctx.stroke();
    ctx.closePath();
  }

  explode( n_divs ) {
    let EXPLODER_PARENT_VELOCITY_FACTOR = 0.2;
    let EXPLODER_SIZE_FACTOR = 0.4;
    let EXPLODE_V_FACTOR = 0.4;
    let MIN_FRAG_RADIUS = 1;

    let frags = [];
    let div_size = this.r / n_divs;
    for ( let y = this.center.y - this.r; y < this.center.y + this.r; y += div_size ) {
      for ( let x = this.center.x - this.r; x < this.center.x + this.r; x += div_size ) {
        const new_center = new vec2( x, y );
        if ( new_center.distance( this.center ) > this.r ) continue;

        let r = div_size * EXPLODER_SIZE_FACTOR;
        if ( r < MIN_FRAG_RADIUS ) continue;
        let c = this.color.copy();
        c.randColor( 100 );

        let new_ball = new Ball( x, y, r, c );

        let v = new_ball.center.copy().minus( this.center );
        v.times( Math.random() * EXPLODE_V_FACTOR );
        v.plus( v.copy().times( EXPLODER_PARENT_VELOCITY_FACTOR ) );
        new_ball.v = v;
        new_ball.is_affected_by_gravity = true;
        new_ball.is_moving = true;
        new_ball.is_invincible = false;

        frags.push( new_ball );
      }
    }
    return frags;
  }

}


class vec2
{
  constructor( x, y ) {
    this.x = x;
    this.y = y;
    // console.log( "x, y: " + x + ", " + y );
  }

  copy() {
    let c = new vec2( this.x, this.y );
    return c;
  }

  distance( b ) {
    let dx = this.x - b.x;
    let dy = this.y - b.y;
    let d = Math.sqrt( dx * dx + dy * dy );
    return d;
  }

  plus( a ) {
    this.x += a.x;
    this.y += a.y;
    return this;
  }

  minus( a ) {
    this.x -= a.x;
    this.y -= a.y;
    return this;
  }

  times( scalar ) {
    this.x *= scalar;
    this.y *= scalar;
    return this;
  }

  divided_by( scalar ) {
    this.x /= scalar;
    this.y /= scalar;
    return this;
  }

  mag() {
    let m = Math.sqrt( this.x * this.x + this.y * this.y );
    return m;
  }

  dot( b ) {
    let scalarProduct = this.x * b.x + this.y * b.y;
    return scalarProduct;
  }

  normalize() {
    let m = this.mag();
    this.x /= m;
    this.y /= m;
    return this;
  }

  toString() {
    return "x: " + this.x + ", y: " + this.y;
  }
}

var NUM_EXPLOD_DIVS = 3;

class World
{
  constructor() {
    this.min_x = 0;
    this.min_y = 0;
    this.max_x = 100;
    this.max_y = 100;
    this.g = 0.1;
    this.c = new vec3( 0, 0, 255 );
    this.n_divs = 3;
    this.init();
    this.background = new Background();
    this.pizza_time = false;
  }

  init() {
    this.balls = [];
    this.planets = [];
    this.particles = [];
    let pink = new vec3( 255, 50, 50 );
    let blue = new vec3( 0, 0, 255 );
    let b1 = new Ball( 50, 150, 50, pink );
    b1.v.x = 20;
    b1.is_affected_by_gravity = true;
    b1.is_moving = true;
    b1.is_invincible = false;
    this.addBall( b1 );

    let b2 = new Ball( 1750, 150, 50, blue );
    b2.v.x = -20;
    b2.is_affected_by_gravity = true;
    b2.is_moving = true;
    b2.is_invincible = false;
    this.addBall( b2 );

    let b3 = new Ball( 50, 500, 100, pink );
    b3.v.x = 20;
    b3.is_invincible = false;
    this.addBall( b3 );

    let b4 = new Ball( 2000, 500, 100, blue );
    b4.v.x = -20;
    b4.is_invincible = false;
    this.addBall( b4 );
  }

  advance( dt ) {
    this.background.advance( dt );

    let MAX_BALLS = 400;
    let MIN_EXPLODER_RADIUS = 25;
    let NEW_PARTICLE_HP = 1;
    let WALL_ELASTIC_FACTOR = 0.9;

    let balls = this.balls;
    for ( let i = 0; i < balls.length; i++ ) {
      let b = balls[ i ];

      // move moving stuff
      if ( b.is_moving ) {
        b.center.plus( b.v.copy().times( dt ) );
      }

      // bounce off walls
      if ( b.center.x + b.r > this.max_x ) { b.center.x = this.max_x - b.r; b.v.x = -b.v.x * WALL_ELASTIC_FACTOR; }
      if ( b.center.y + b.r > this.max_y ) { b.center.y = this.max_y - b.r; b.v.y = -b.v.y * WALL_ELASTIC_FACTOR; }
      if ( b.center.x - b.r < this.min_x ) { b.center.x = this.min_x + b.r; b.v.x = -b.v.x * WALL_ELASTIC_FACTOR; }
      if ( b.center.y - b.r < this.min_y ) { b.center.y = this.min_y + b.r; b.v.y = -b.v.y * WALL_ELASTIC_FACTOR; }

      // interact with other balls
      for ( let j = i + 1; j < balls.length; j++ ) {
        let b2 = balls[ j ];
        // crash em together
        if ( b.center.distance( b2.center ) < b.r + b2.r ) {
          b.collide( b2 );
        }
        // apply gravity
        if ( b.is_affected_by_gravity && b2.is_affected_by_gravity ) {
          // F = (G * m1 * m2) / (Distance^2)
          let d = b.center.distance( b2.center );
          let G = 1.0;
          let F = ( G * b.m * b2.m ) / ( d * d );
          let a = F / b.m;
          let a2 = F / b2.m;
          let D = ( b2.center.copy().minus( b.center ) ).normalize();
          b.v.plus( D.times( a ) );
          b2.v.minus( D.times( a2 ) );
        }
      }

      // interact with planets
      for ( let pIndex = 0; pIndex < this.planets.length; pIndex++ ) {
        let p = this.planets[ pIndex ];
        // apply gravity
        // F = (G * m1 * m2) / (Distance^2)
        let d = b.center.distance( p.center );
        let G = 1.0;
        let F = ( G * b.m * p.m ) / ( d * d );
        let a = F / b.m;
        let D = ( p.center.copy().minus( b.center ) ).normalize();
        b.v.plus( D.times( a ) );

        // crash em together
        if ( b.center.distance( p.center ) < b.r + p.r ) {
          b.collide( p );
        }
      }
    }

    // remove dead balls from world
    let dead_balls = [];
    for ( let i = balls.length; i--; ) {
      let b = balls[ i ];
      if ( !b.is_invincible && b.hp < 0 ) {
        // console.log( "removing dead ball, hp: " + balls.hp );
        dead_balls.push( b );
        balls.splice( i, 1 );
      }
    }

    // ok, now we have these dead balls, what to do with them?
    let new_balls = [];
    for ( let i = 0; i < dead_balls.length; i++ ) {
      let ball = dead_balls[ i ];

      // if they are big enough, then lets blow them into smaller pieces
      if ( ball.r > MIN_EXPLODER_RADIUS ) {
        // console.log( "exploded - r: " + ball.r );
        // console.log( "world says: this.n_divs: " + this.n_divs + ", foog: " + foog );
        new_balls = new_balls.concat( ball.explode( NUM_EXPLOD_DIVS ) );
        // console.log( "new_balls.length: " + new_balls.length );
      } else { //if ( ball.r > 1 ) {
        // if they are smaller then they go into the particle loop
        let new_particles = ball.explode( 2 );
        for ( let p_index = new_particles.length; p_index--; ) {
          let p = new_particles[ p_index ];

          // p.c = new vec3( 255, 255, 255 );
          // p.hp_max = NEW_PARTICLE_HP;
          // p.hp = NEW_PARTICLE_HP;
        }
        this.particles = this.particles.concat( new_particles );
        // console.log( "to particles - r: " + ball.r );
        // console.log( "particles.length: " + new_balls.length );
      }
    }

    // add exploded fragments to the main collection
    for ( let i = 0; i < new_balls.length; i++ ) {
      if ( this.balls.length >= MAX_BALLS ) { break; }

      this.balls.push( new_balls[ i ] );
    }

    // do particle stuff
    this.advanceParticles( dt );
  }

  advanceParticles( dt ) {
    // if ( this.particles.length > 0 ) console.log( "num particles: " + this.particles.length );

    for ( let i = this.particles.length; i--; ) {
      let p = this.particles[ i ];
      // fade em
      p.hp -= 0.05 * dt;
      // remove the dead ones
      if ( p.hp <= 0 ) {
        this.particles.splice( i, 1 );
        continue;
      }
      // move em
      p.center.plus( p.v.copy().times( dt ) );

      // interact with planets
      for ( let pIndex = 0; pIndex < this.planets.length; pIndex++ ) {
        let planet = this.planets[ pIndex ];

        // apply gravity
        let d = p.center.distance( planet.center );
        let G = 1.0;
        let F = ( G * p.m * planet.m ) / ( d * d );
        let a = F / p.m;
        let D = ( planet.center.copy().minus( p.center ) ).normalize();
        p.v.plus( D.times( a ) );

        // crash em together
        if ( p.center.distance( planet.center ) < p.r + planet.r ) {
          p.collide( planet );
        }
      }

      // maybe could apply gravity against other ojects
      }
  }

  addBall( b ) {
    console.log("adding ball");
    if ( b ) {
      this.balls.push( b );
      console.log("ball added");
    }
  }

  addPlanet( p ) {
    console.log("adding planet");
    this.planets.push( p );
    if ( !p ) {
      console.log("planet NOT added");
    }
  }

  draw( ctx ) {
    this.background.draw();

    for ( let i = 0; i < this.balls.length; i++ ) {
      let b = this.balls[ i ];
      b.draw( ctx, this.pizza_time );
    }

    for ( let i = 0; i < this.particles.length; i++ ) {
      let p = this.particles[ i ];
      p.draw( ctx, false );
    }

    for ( let i = 0; i < this.planets.length; i++ ) {
      let p = this.planets[ i ];
      p.draw( ctx, this.pizza_time );
    }

  }

  retrieveBall( x, y ) {
    let pos = new vec2( x, y );

    for( let i = 0; i < this.balls.length; i++ ) {
      let b = this.balls[ i ];

      let dist = pos.distance( b.center );
      if ( dist <= b.r ) {
        return b;
      }
    }

    for( let i = 0; i < this.planets.length; i++ ) {
      let p = this.planets[ i ];

      let dist = pos.distance( p.center );
      if ( dist <= p.r ) {
        return p;
      }
    }


    return null;
  }

  sliding( e ) {
    this.n_divs = e.currentTarget.value;
    NUM_EXPLOD_DIVS = this.n_divs;
    console.log( "sliding: " + this.n_divs );
  }

}

let ctx;
let world;
let controller;
let canvas;

function mouseDown( e ) {
  controller.mouseDown( e );
  canvas.removeEventListener( "mousedown", mouseDown, false );
  canvas.addEventListener( "mouseup", mouseUp, false );
  e.preventDefault();
}

function mouseUp( e ) {
  controller.mouseUp( e );
  canvas.removeEventListener( "mouseup", mouseUp, false );
  canvas.addEventListener( "mousedown", mouseDown, false );
}

function mouseOut( e ) {
  controller.mouseOut( e );
}

function mouseMove( e ) {
  controller.mouseMove( canvas, e );
}

function getTouchPos(canvasDom, touchEvent) {
  var rect = canvasDom.getBoundingClientRect();
  return {
    x: touchEvent.touches[0].clientX - rect.left,
    y: touchEvent.touches[0].clientY - rect.top
  };
}

function init() {
  let FPS = 60;

  world = new World();
  controller = new Controller( world );

  let slider = document.getElementById('slider');
  slider.addEventListener( 'value-change', world.sliding, false );

  canvas = document.getElementById( 'pizza' );

  canvas.addEventListener( "mousedown", mouseDown, false );
  canvas.addEventListener( "mousemove", mouseMove, false );
  canvas.addEventListener( "mouseout", mouseOut, false );
  canvas.addEventListener( "touchstart", function (e) {
    if (e.target == canvas) {
      e.preventDefault();
    }
    var touch = e.touches[0];
    var mouseEvent = new MouseEvent( "mousedown", {
      clientX: touch.clientX,
      clientY: touch.clientY
    });
    canvas.dispatchEvent(mouseEvent);
    }, false );
  canvas.addEventListener( "touchend", function (e) {
    if (e.target == canvas) {
      e.preventDefault();
    }
    var mouseEvent = new MouseEvent( "mouseup", {});
    canvas.dispatchEvent(mouseEvent);
  }, false );
  canvas.addEventListener( "touchmove", function (e) {
    if (e.target == canvas) {
      e.preventDefault();
    }
    var touch = e.touches[0];
    var mouseEvent = new MouseEvent( "mousemove", {
      clientX: touch.clientX,
      clientY: touch.clientY
    });
    canvas.dispatchEvent(mouseEvent);
  }, false );

  ctx = canvas.getContext( '2d' );

  requestAnimationFrame( advance );
}

let previous = null;
function advance() {

  let controls_height = document.getElementById('controls_div').offsetHeight;
  let pizza_height = document.getElementById('pizza').offsetHeight;
  let fps_height = document.getElementById('fps_div').offsetHeight;
  canvas.height = window.innerHeight - ( fps_height + controls_height + 30 );
  canvas.width  = window.innerWidth * 0.9;
  world.max_x = canvas.width;
  world.max_y = canvas.height;

  let now = window.performance.now();
  let dt = now - previous;
  previous = now;

  let reset_button = document.getElementById('reset_button');
  if ( reset_button.pressed ) {
    world.init();
  }

  let planet_button = document.getElementById('planet_button');
  if ( planet_button.pressed ) {
    controller.requestPlanet();
  }

  let ball_button = document.getElementById('ball_button');
  if ( ball_button.pressed ) {
    controller.requestBall();
  }

  let pizza_button = document.getElementById('pizza_button');
  if ( pizza_button.pressed ) {
    world.pizza_time = !world.pizza_time;
    console.log( "world.pizza_time: " + world.pizza_time );
  }

  world.advance( dt * 0.05 );

  world.draw( ctx );

  updateInfoLabel( dt );

  requestAnimationFrame( advance );
}

let smoothed_fps = 0;
function updateInfoLabel( dt ) {
  let fps = 1000.0 / dt;
  let alpha = 0.1;
  smoothed_fps = smoothed_fps * (1 - alpha) + fps * alpha;
  let new_fps = (smoothed_fps).toFixed(0);
  let fps_label = document.getElementById('fps_label');
  fps_label.innerHTML = "fps: " + new_fps + " ";

  let num_balls_label = document.getElementById('num_balls_label');
  num_balls_label.innerHTML = "num balls: " + world.balls.length;
}

"use strict";
class qtElement
{
  constructor( x, y ) {
    this.x = x;
    this.y = y;
  }
}

class quadtree
{
  constructor( min_x, min_y, max_x, max_y ) {
    this.min_x = min_x;
    this.min_y = min_y;
    this.max_x = max_x;
    this.max_y = max_y;
    this.MAX_SIZE = 2;
    this.objects = [];
    this.children = [];
  }

  hasChildren() {
    return ( this.children.length >= 0 );
  }

  insert( element ) {
    console.log( "\ninserting..." );
    if ( element.x < this.min_x || element.x > this.max_x || element.y < this.min_y || element.y > this.max_y ) {
        console.log( "element: " + element );
        console.log( "self: " + this.toS() );
        throw "input OOBs!";
    }

    if ( this.objects.length < this.MAX_SIZE ) {
      console.log( "inserting internally" );
      this.objects.push( element );
    } else if ( this.hasChildren() ) {
      console.log( "inserting to children: " + this.children );
      for ( let child of this.children ) {
        // make sure we insert into one of the children
        child.insert( element );
      }
    } else {
      this.split();
    }
    console.log( "insert is done" );
    console.log( "hello again:\n" + this.toS() );
  }

  centerX() {
    return ( this.min_x + this.max_x ) * 0.5;
  }

  centerY() {
    return ( this.min_y + this.max_y ) * 0.5;
  }

  split() {
    console.log("splitting...");
    if ( this.hasChildren() ) {
      throw "object already split: "  + this;
    }
    this.children = [
      new quadtree( 0, 0, this.centerX(), this.centerY() ), // top left
      new quadtree( 0, 0, this.centerX(), this.centerY() ), // bottom left
      new quadtree( 0, 0, this.centerX(), this.centerY() ), // top right
      new quadtree( 0, 0, this.centerX(), this.centerY() ) // bottom right
    ];
    console.log( "has children?: " + this.hasChildren() );
    console.log( "split is done" );
  }

  remove( element ) {
    for ( const object of this.objects ) {

    }
  }

  toS() {
    let s =
      "objects[" + this.objects.length + "]" + "\n" +
      "min_x, min_y: " + this.min_x + ", " + this.min_y + "\n" +
      "max_x, max_y: " + this.max_x + ", "  + this.max_y + "\n" +
      "children: " + this.children;
    for ( const child of this.children ) {
      let childString = child.toS();
      childString = childString.replace( /\n/g, '\n\t' );
      s = s + childString;
    }
    return s;
  }

  static test() {
    console.log( "yalla!" );
    let s = new quadtree( 0, 0, 100, 100 );
    console.log( "say hello to quadtree:\n" + s.toS() );

    let o1 = { x: 5, y: 5 };
    let o2 = { x: 5, y: 75 };
    let o3 = { x: 75, y: 75 };
    let o4 = { x: 75, y: 5 };

    s.insert( o1 );
    s.insert( o2 );
    s.insert( o3 );
    s.insert( o4 );
  }

}

quadtree.test();
