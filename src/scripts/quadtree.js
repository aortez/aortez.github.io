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

  draw( ctx, scale_factor ) {
    // draw children
    for ( let i = 0; i < this.children.length; i++ ) {
      this.children[ i ].draw( ctx, scale_factor );
    }

    // draw self as rectangle
    ctx.strokeStyle="#FFFFFF";
    let epsilon = 0.005;
    ctx.strokeRect( 
      (this.min_x + epsilon) * scale_factor,
      (this.min_y + epsilon) * scale_factor, 
      ( (this.max_x - this.min_x) - epsilon) * scale_factor, 
      ( (this.max_y - this.min_y) - epsilon) * scale_factor
    );
    
    // draw a nice little pizza in center of the quad
    let b = new Ball( this.centerX(), this.centerY(), 0.01, new vec3(255,255,255) );
    b.draw( ctx, scale_factor, false );
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
    for ( let child of this.children ) {
      let child_objects = child.getObjectsRecursive();
      if ( child_objects.length > 0 ) {
        objects = objects.concat( child_objects );
      }
    }
    return objects;
  }
  
  interact( g ) {
    let qt = this;
    
    // for each object at this level
    for ( let object_index_a = 0; object_index_a < qt.objects.length; object_index_a++ ) {
      let b = qt.objects[ object_index_a ];
      
      // collide against other objects at this level
      for ( let object_index_b = object_index_a + 1; object_index_b < qt.objects.length; object_index_b++ ) {
        let b2 = qt.objects[ object_index_b ];

        // crash em together
        if ( b.intersects( b2 ) ) {
          b.collide( b2 );
        }
        // apply gravity
        if ( b.is_affected_by_gravity && b2.is_affected_by_gravity ) {
          // F = (G * m1 * m2) / (Distance^2)
          let d = b.center.distance( b2.center );
          let F = ( g * b.m * b2.m ) / ( d * d );
          let a = F / b.m;
          let a2 = F / b2.m;
          let D = ( b2.center.copy().minus( b.center ) ).normalize();
          b.v.plus( D.times( a ) );
          b2.v.minus( D.times( a2 ) );
        }
      }
      
      // collide with children for each sub-tree
      for ( let child_index = 0; child_index < qt.children.length; child_index++ ) {
        let child = qt.children[ child_index ];
        let child_objects = child.getObjectsRecursive();
        for ( let child_object_index = 0; child_object_index < child_objects.length; child_object_index++ ) {
          let object_in_child = child_objects[ child_object_index ];
          if (object_in_child.intersects( b ) ) {
            b.collide( object_in_child );  
          }
        }
      }
    }
  
    // interact down the tree
    for ( let i = 0; i < qt.children.length; i++ ) {
      let child = qt.children[ i ];
      child.interact( g );
    }
    
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

    if ( !this.hasChildren() ) {
      if ( this.objects.length < this.max_local_objects ) {
        debug( "inserting internally..." );
        this.objects.push( element );  
      } else {
        this.split();
        this.insert( element );
      }
    } else {
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
    for ( let child of this.children ) {

    }
  }

  toS() {
    let s =
      "quadtree: x[" + this.min_x + ", " + this.max_x + "] - " +
      "y[" + this.min_y + ", "  + this.max_y + "]";

    if ( this.hasObjects() ) {
      s = s + "\n\tObjects " + this.objects.length + "/" + this.max_local_objects + ":";
      for ( let obj of this.objects ) {
        s = s + "\n\t\t" + obj.toS().replace( /\n/g, '\n\t' );
      }
    }
    if ( this.hasChildren() ) {
      s = s + "\n\tChildren[" + this.children.length + "]:";
      for ( let i = 0; i < this.children.length; i++ ) {
        let child = this.children[ i ];
        s = s + "\n\t\t" + "child[" + i + "]" + child.toS().replace( /\n/g, '\n\t' );
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
    for ( let object of qt.getObjectsRecursive() ) {
      log( object.toS() );
    }

    // display each child's object's
    log( "***************** objects belonging to each child subtree ***********" );
    for ( let node of qt.children ) {
      log ( node.toS() );
      log_in();
      for ( let object of node.objects ) {
        log( object.toS() );
      }

      log_out();
    }
  }

}

quadtree.test();
