"use strict";

let qt_indent = 0;
let debug_on = false;

function log( text ) {
  const whitespace = '                                                         ';
  console.log( text.replace( /^/mg, whitespace.substring(0, qt_indent) ) );
}

function debug( text ) {
  if ( !debug_on ) return;
  log( text );
}

function log_in() { qt_indent = qt_indent + 4; }
function log_out() { qt_indent = qt_indent - 4; }

class qtElement
{
  constructor( x, y ) {
    this.x = x;
    this.y = y;
  }

  toS() {
    return "qtElement(" + this.x + ", " + this.y + ")";
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

  fitsInside( element ) {
    let fits = (
      element.x >= this.min_x &&
      element.x < this.max_x &&
      element.y >= this.min_y &&
      element.y < this.max_y );
    debug( "fits? " + fits + ": element: " + element.x + ", " + element.y +
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
        debug( "self: " + this.toS() );
        throw "input OOBs!";
    }

    console.log( "this.max_local_objects: " + this.max_local_objects );
    if ( !this.hasChildren() && this.objects.length < this.max_local_objects ) {
      debug( "inserting internally..." );
      this.objects.push( element );
      debug( "insert is done" );
    } else if ( this.hasChildren() ) {
      debug( "child nodes exist, search for destination node" );
      log_in();
      let inserted = false;
      for ( const child of this.children ) {
        if ( child.fitsInside( element ) ) {
          debug( "fits!  insert to child" );
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
      log_out();
      if ( !inserted ) {
        throw "unable to insert";
      }
    } else {
      this.split();
      this.insert( element );
    }
    log_out();
  }

  centerX() {
    return ( this.min_x + this.max_x ) * 0.5;
  }

  centerY() {
    return ( this.min_y + this.max_y ) * 0.5;
  }

  split() {
    debug("splitting...");
    if ( this.hasChildren() ) {
      throw "can only split once: "  + this;
    }
    this.children = [
      new quadtree( 0, 0, this.centerX(), this.centerY(), this.max_local_objects ), // top left
      new quadtree( 0, this.centerY(), this.centerX(), this.max_y, this.max_local_objects ), // bottom left
      new quadtree( this.centerX(), 0, this.max_x, this.centerY(), this.max_local_objects ), // top right
      new quadtree( this.centerX(), this.centerY(), this.max_x, this.max_y, this.max_local_objects ) // bottom right
    ];
    debug("inserting existing objects to children");
    log_in();
    for ( const obj of this.objects ) {
      this.insert( obj );
    }
    log_out();
    this.objects = [];
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
      "quadtree: [" + this.min_x + ", " + this.min_y + "] - " +
      "[" + this.max_x + ", "  + this.max_y + "]";

    if ( this.hasObjects() ) {
      s = s + "\n\tObjects[" + this.objects.length + "]:";
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

    let insert_node = function( x, y ) {
      let node = new qtElement( x, y );
      console.log( "inserting node: " + node.toS() );
      qt.insert( node );
      console.log( "resulting qtree: " + qt.toS() );
    };
    console.log( "**************** inserting *************************" );
    insert_node( 5, 5 );
    insert_node( 5, 75 );
    insert_node( 75, 75 );
    insert_node( 75,  5 );
    insert_node( 80,  5 );
    insert_node( 95,  5 );

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
