class vec3
{
  constructor( x, y, z ) {
    this.x = x;
    this.y = y;
    this.z = z;
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


class vec2
{
  constructor( x, y ) {
    this.x = x;
    this.y = y;
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
    return "(" + this.x + ", " + this.y + ")";
  }

  toStringVerbose() {
    return "vec2 x: " + this.x + ", y: " + this.y;
  }

}

"use strict";

let qt_indent = 0;
let debug_on = false;

function log( text ) {
  const whitespace = '                                                         ';
  console.log( text.replace( /^/mg, whitespace.substring( 0, qt_indent ) ) );
}

function debug( text ) {
  if ( !debug_on ) return;
  log( text );
}

function log_in() { qt_indent = qt_indent + 4; }
function log_out() { qt_indent = qt_indent - 4; }

class qtElement
{
  constructor( x, y, r ) {
    this.center = new vec2( x, y );
    this.r = r;
  }

  toS() {
    return "qtElement(" + this.center.x + ", " + this.center.y + ", " + this.r + ")";
  }
}

class quadtree
{
  constructor(
    min_x,
    min_y,
    max_x,
    max_y,
    max_local_objects ) {
    this.min_x = min_x;
    this.min_y = min_y;
    this.max_x = max_x;
    this.max_y = max_y;
    this.max_local_objects = max_local_objects;
    this.objects = [];
    this.children = [];
  }

  draw( ctx ) {
    for ( let i = 0; i < this.children.length; i++ ) {
      this.children[ i ].draw( ctx );
    }
    let canvas = ctx.canvas;
    // ctx.strokeStyle="#000000";
    ctx.strokeStyle="#FFFFFF";
    ctx.strokeRect( this.min_x, this.min_y, this.max_x, this.max_y );
    // ctx.strokeStyle="#FFFFFF";
    ctx.strokeRect( this.min_x + 1, this.min_y + 1, this.max_x - 1, this.max_y - 1 );
    // ctx.strokeStyle="#000000";
    // ctx.strokeRect( this.min_x + 2, this.min_y + 2, this.max_x - 2, this.max_y - 2 );
  }

  fitsInside( element ) {
    let fits = (
      element.center.x - element.r >= this.min_x &&
      element.center.x + element.r < this.max_x &&
      element.center.y - element.r >= this.min_y &&
      element.center.y + element.r < this.max_y );
    debug( "fits? " + fits + ": element: " + element.center.toString() + ", r: " + element.r +
      ", quad x[" + this.min_x + ", " + this.max_x + "], y[" + this.min_y + ", " + this.max_y + "]" );
    return fits;
  }

  getObjectsRecursive() {
    // start with any local objects
    let objects = this.objects;

    // add any objects from children
    for ( const child of this.children ) {
      let child_objects = child.getObjectsRecursive();
      if ( child_objects.length > 0 ) {
        objects = objects.concat( child_objects );
      }
    }
    return objects;
  }

  hasChildren() {
    return ( this.children.length > 0 );
  }

  hasObjects() {
    return ( this.objects.length > 0 );
  }

  insert( element ) {
    debug( "\ninserting... " + element.toS() );
    log_in();
    if ( !this.fitsInside( element ) ) {
        log( "self: " + this.toS() );
        log( "element: " + element.toS() );
        throw "input OOBs!";
    }

    if ( !this.hasChildren() && this.objects.length < this.max_local_objects ) {
      debug( "inserting internally..." );
      this.objects.push( element );
    } else if ( this.hasChildren() ) {
      debug( "child nodes exist, search for destination node" );
      log_in();
      let inserted = false;
      for ( let i = 0; i < this.children.length; i++ ) {
        let child = this.children[ i ];
        if ( child.fitsInside( element ) ) {
          debug( "fits! insert to child" );
          debug( "child:\n" + child.toS() );
          log_in();
          child.insert( element );
          log_out();
          inserted = true;
          break;
        }
        else {
          debug(" not fits " );
        }
      }
      if ( !inserted ) {
        debug( "could not fit into any children, inserting locally" );
        this.objects.push( element );
      }
      log_out();
    } else {
      this.split();
      this.insert( element );
    }
    debug( "insert is done" );
    log_out();
  }

  centerX() {
    return ( this.min_x + this.max_x ) * 0.5;
  }

  centerY() {
    return ( this.min_y + this.max_y ) * 0.5;
  }

  split() {
    debug( "splitting..." );
    if ( this.hasChildren() ) {
      throw "can only split once: "  + this;
    }
    this.children = [
      new quadtree( this.min_x, this.min_y, this.centerX(), this.centerY(), this.max_local_objects ), // top left
      new quadtree( this.min_x, this.centerY(), this.centerX(), this.max_y, this.max_local_objects ), // bottom left
      new quadtree( this.centerX(), this.min_y, this.max_x, this.centerY(), this.max_local_objects ), // top right
      new quadtree( this.centerX(), this.centerY(), this.max_x, this.max_y, this.max_local_objects ) // bottom right
    ];
    debug( "inserting existing objects to children" );
    log_in();
    let objects = this.objects;
    this.objects = [];
    for ( let i = 0; i < objects.length; i++ ) {
      let obj = objects[ i ];
      this.insert( obj );
    }
    log_out();
    debug( this.toS() );
    debug( "split is done" );
  }

  remove( element ) {
    // base case: empty leaf node
    if ( !this.hasObjects() && !this.hasChildren() ) {
      return;
    }

    // leaf node w/ objects stored locally
    for ( let i = 0; i < this.objects.length; i++ ) {

      // if this is the target element, remove it
      if ( this.objects[ i ] === element ) {
        array.splice( i, 1 );
      }

    }

    // interior node w/ objects: interior node
    for ( const child of this.children ) {

    }
  }

  toS() {
    let s =
      "quadtree: x[" + this.min_x + ", " + this.max_x + "] - " +
      "y[" + this.min_y + ", "  + this.max_y + "]";

    if ( this.hasObjects() ) {
      s = s + "\n\tObjects " + this.objects.length + "/" + this.max_local_objects + ":";
      for ( const obj of this.objects ) {
        s = s + "\n\t\t" + obj.toS().replace( /\n/g, '\n\t' );
      }
    }
    if ( this.hasChildren() ) {
      s = s + "\n\tChildren[" + this.children.length + "]:";
      for ( const child of this.children ) {
        s = s + "\n\t\t" + child.toS().replace( /\n/g, '\n\t' );
      }
    }
    return s;
  }

  static test() {
    let qt = new quadtree( 0, 0, 100, 100, 2 );
    console.log( "**************** initial state: ********************" );
    console.log( qt.toS() );

    let insert_node = function( x, y, r ) {
      let node = new qtElement( x, y, r );
      console.log( "inserting node: " + node.toS() );
      qt.insert( node );
      console.log( "resulting qtree: " + qt.toS() );
    };
    console.log( "**************** inserting *************************" );
    insert_node( 5, 5, 5 );
    insert_node( 5, 75, 5 );
    insert_node( 75, 75, 5 );
    insert_node( 75,  5, 5 );
    insert_node( 80,  10, 10 );
    insert_node( 90,  10, 5 );

    log( "******************* objects belonging to parent tree *******" );
    for ( const object of qt.getObjectsRecursive() ) {
      log( object.toS() );
    }

    // display each child's object's
    log( "***************** objects belonging to each child subtree ***********" );
    for ( const node of qt.children ) {
      log ( node.toS() );
      log_in();
      for ( const object of node.objects ) {
        log( object.toS() );
      }

      log_out();
    }
  }

}

quadtree.test();

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
      b.hp = b.calcHp() * 1000;
      b.v.x = 0;
      b.v.y = 0;
    }
  }

  pause() {
    world.is_paused = !world.is_paused;
  }

  quadtree() {
    world.use_quadtree = !world.use_quadtree;
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

  toS() {
    return "ball(" + this.center.toString() + ", " + this.r + ")";
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
    this.shouldDrawBackground = true;
    this.pizza_time = false;
    this.max_balls = 400;
    this.is_paused = false;
    this.use_quadtree = false;
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
    if ( this.is_paused ) {
      // its sort of cool when we let the object settling process take play while paused
      // dt = 0;

      // but instead we delay any world updates at all
      return;
    }
    this.background.advance( dt );

    let MIN_BALL_RADIUS = 6;
    let WALL_ELASTIC_FACTOR = 0.9;

    let balls = this.balls;
    for ( let i = 0; i < balls.length; i++ ) {
      let b = balls[ i ];

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
      // move moving stuff
      if ( b.is_moving ) {
        b.center.plus( b.v.copy().times( dt ) );
      }

      // bounce off walls
      let fudge = 0.0001;
      if ( b.center.x + b.r >= this.max_x ) { b.center.x = this.max_x - b.r - fudge; b.v.x = -b.v.x * WALL_ELASTIC_FACTOR; }
      if ( b.center.y + b.r >= this.max_y ) { b.center.y = this.max_y - b.r - fudge; b.v.y = -b.v.y * WALL_ELASTIC_FACTOR; }
      if ( b.center.x - b.r <= this.min_x ) { b.center.x = this.min_x + b.r + fudge; b.v.x = -b.v.x * WALL_ELASTIC_FACTOR; }
      if ( b.center.y - b.r <= this.min_y ) { b.center.y = this.min_y + b.r + fudge; b.v.y = -b.v.y * WALL_ELASTIC_FACTOR; }      
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

    // deal with the dead balls
    // some get removed from the world
    // some get exploded
    let new_balls = [];
    for ( let i = 0; i < dead_balls.length && this.balls.length < this.max_balls; i++ ) {
      let ball = dead_balls[ i ];

      let dead_frags = ball.explode( NUM_EXPLOD_DIVS );
      for ( let frag_index = 0; frag_index < dead_frags.length && this.balls.length < this.max_balls; frag_index++ ) {
        let frag = dead_frags[ frag_index ];
        if ( frag.r >= MIN_BALL_RADIUS ) {
          new_balls.push( frag );
        } else {
          frag.hp = frag.calcHp() * Math.random(); // add randomness to particle lifespan
          this.particles.push( frag );
        }
      }
    }

    // add exploded fragments to the main collection
    for ( let i = 0; i < new_balls.length && this.balls.length < this.max_balls; i++ ) {
      this.balls.push( new_balls[ i ] );
    }

    // do particle stuff
    this.advanceParticles( dt );

    // truncate balls to max
    if ( this.balls.length > this.max_balls ) {
      console.log( "**************** TRUNCATE ****************");
      this.balls = this.balls.slice( 0, this.max_balls.toFixed( 0 ) );
    }
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
    console.log( 'adding ball' );
    if ( b ) {
       // if there is capacity, just add the ball
      if ( this.balls.length < this.max_balls ) {
        this.balls.push( b );
        console.log( 'ball added' );
      } else {
        // if we've exceeded capacity, replace a random ball
        let ball_index = Math.trunc( Math.random() * this.balls.length );
        this.balls[ ball_index ] = b;
        console.log( 'ball added, displacing ball at index: ' + ball_index );
      }
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
    if ( this.shouldDrawBackground ) {
      this.background.draw();
    } else {
      ctx.fillStyle = "rgb(" + 0 + "," + 0 + "," + 0 + ")";
      ctx.fillRect( 0, 0, canvas.width, canvas.height );
    }

    for ( let i = 0; i < this.balls.length && !this.use_quadtree; i++ ) {
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

    if ( this.use_quadtree ) {
      // build quadtree
      let qt = new quadtree( 0, 0, canvas.width, canvas.height, 3 );

      // put some objects into the quad tree
      for ( let i = 0; i < this.balls.length; i++ ) {
        let ball = this.balls[ i ];
        if ( qt.fitsInside( ball ) ) {
          qt.insert( ball );
        }
      }

      // draw quadtree
      qt.draw( ctx );

      // draw its contained objects
      let objects = qt.getObjectsRecursive();
      for ( let i = 0; i < objects.length; i++ ) {
        objects[ i ].draw( ctx );
      }
    }

  }

  getDrawBackground() {
    return this.shouldDrawBackground;
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

  setDrawBackground( shouldDrawBackground ) {
    this.shouldDrawBackground = shouldDrawBackground;
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
  canvas.removeEventListener( 'mousedown', mouseDown, false );
  canvas.addEventListener( 'mouseup', mouseUp, false );
  e.preventDefault();
}

function mouseUp( e ) {
  controller.mouseUp( e );
  canvas.removeEventListener( 'mouseup', mouseUp, false );
  canvas.addEventListener( 'mousedown', mouseDown, false );
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

  let slider = document.getElementById( 'slider' );
  slider.addEventListener( 'value-change', world.sliding, false );

  canvas = document.getElementById( 'pizza' );
  canvas.addEventListener( 'mousedown', mouseDown, false );
  canvas.addEventListener( 'mousemove', mouseMove, false );
  canvas.addEventListener( 'mouseout', mouseOut, false );
  canvas.addEventListener( 'touchstart', function (e) {
    if ( e.target == canvas ) { e.preventDefault(); }
    var touch = e.touches[ 0 ];
    var mouseEvent = new MouseEvent( 'mousedown', {
      clientX: touch.clientX,
      clientY: touch.clientY
    });
    canvas.dispatchEvent(mouseEvent);
    }, false
  );
  canvas.addEventListener( 'touchend', function ( e ) {
      if ( e.target == canvas ) { e.preventDefault(); }
      var mouseEvent = new MouseEvent( 'mouseup', {} );
      canvas.dispatchEvent( mouseEvent );
    }, false
  );
  canvas.addEventListener( 'touchmove', function ( e ) {
    if ( e.target == canvas ) { e.preventDefault(); }
    var touch = e.touches[ 0 ];
    var mouseEvent = new MouseEvent( 'mousemove', {
      clientX: touch.clientX,
      clientY: touch.clientY
    });
    canvas.dispatchEvent(mouseEvent);
    }, false
  );

  ctx = canvas.getContext( '2d' );

  document.getElementById( 'background_button' ).addEventListener( 'click', function() {
    world.setDrawBackground( !world.getDrawBackground() );
  });

  document.getElementById( 'pizza_button' ).addEventListener( 'click', function() {
    world.pizza_time = !world.pizza_time;
  });

  document.getElementById( 'reset_button' ).addEventListener( 'click', function() {
    world.init();
  });

  document.getElementById( 'planet_button' ).addEventListener( 'click', function() {
    controller.requestPlanet();
  });

  document.getElementById( 'ball_button' ).addEventListener( 'click', function() {
    controller.requestBall();
  });

  document.getElementById( 'pause_button' ).addEventListener( 'click', function() {
    controller.pause();
  });

  document.getElementById( 'quadtree_button' ).addEventListener( 'click', function() {
    controller.quadtree();
  });

  requestAnimationFrame( advance );
}

let previous = null;
let smoothed_fps = 0;
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

  world.advance( dt * 0.05 );

  world.draw( ctx );

  let fps = 1000.0 / dt;
  let fps_alpha = 0.1;
  smoothed_fps = smoothed_fps * ( 1 - fps_alpha ) + fps * fps_alpha;
  updateInfoLabel( smoothed_fps );

  if ( smoothed_fps < 45 ) {
    if ( world.max_balls > 75 ) {
      world.max_balls = world.max_balls - 5;
    }
  } else {
    if ( world.max_balls < 400 ) {
      world.max_balls = world.max_balls + 0.1;
    }
  }

  requestAnimationFrame( advance );
}

function updateInfoLabel( fps ) {
  let fps_label = document.getElementById( 'fps_label' );
  fps_label.innerHTML = 'fps: ' + fps.toFixed( 0 ) + ' ';

  let num_balls_label = document.getElementById( 'num_balls_label' );
  num_balls_label.innerHTML = 'num balls / max: ' + world.balls.length + ' / ' + world.max_balls.toFixed( 0 );
}
