"use strict";
let qt_indent = 0;
function log( text ) {
  const whitespace = '                                                         ';
  console.log( text.replace( /^/mg, whitespace.substring(0, qt_indent) ) );
}
function log_in() { qt_indent = qt_indent + 4; };
function log_out() { qt_indent = qt_indent - 4; };

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
  constructor( min_x, min_y, max_x, max_y ) {
    this.min_x = min_x;
    this.min_y = min_y;
    this.max_x = max_x;
    this.max_y = max_y;
    this.MAX_SIZE = 2;
    this.objects = [];
    this.children = [];
  }

  fitsInside( element ) {
    let fits = (
      element.x >= this.min_x &&
      element.x < this.max_x &&
      element.y >= this.min_y &&
      element.y < this.max_y );
    log( "fits? " + fits + ": element: " + element.x + ", " + element.y +
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
    log( "\ninserting... " + element.toS() );
    log_in();
    if ( !this.fitsInside( element ) ) {
        log( "self: " + this.toS() );
        throw "input OOBs!";
    }

    if ( !this.hasChildren() && this.objects.length < this.MAX_SIZE ) {
      log( "inserting internally..." );
      this.objects.push( element );
      log( "insert is done" );
    } else if ( this.hasChildren() ) {
      log( "child nodes exist, search for destination node" ); log_in();
      let inserted = false;
      for ( const child of this.children ) {
        if ( child.fitsInside( element ) ) {
          log( "fits!  insert to child" );
          log_in();
          child.insert( element );
          log_out();
          inserted = true;
          break;
        }
        else {
          log(" not fits " );
        }
      }
     log_out();
      if ( !inserted ) { throw "unable to insert"; }
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
    log("splitting...");
    if ( this.hasChildren() ) {
      throw "can only split once: "  + this;
    }
    this.children = [
      new quadtree( 0, 0, this.centerX(), this.centerY() ), // top left
      new quadtree( 0, this.centerY(), this.centerX(), this.max_y ), // bottom left
      new quadtree( this.centerX(), 0, this.max_x, this.centerY() ), // top right
      new quadtree( this.centerX(), this.centerY(), this.max_x, this.max_y ) // bottom right
    ];
    log("inserting existing objects to children");
    log_in();
    for ( const obj of this.objects ) {
      this.insert( obj );
    }
    log_out();
    this.objects = [];
    log( this.toS() );
    log( "split is done" );
  }

  remove( element ) {
    for ( const object of this.objects ) {

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
    let qt = new quadtree( 0, 0, 100, 100 );
    console.log( "**************** initial state: ********************" );
    console.log( qt.toS() );


    console.log( "**************** inserting *************************" );
    qt.insert( new qtElement(  5,  5 ) );
    log( qt.toS() );
    qt.insert( new qtElement(  5, 75 ) );
    log( qt.toS() );
    qt.insert( new qtElement( 75, 75 ) );
    log( qt.toS() );
    qt.insert( new qtElement( 75,  5 ) );
    log( qt.toS() );

    log( "******************* objects belonging to parent tree *******");
    for ( const object of qt.getObjectsRecursive() ) {
      log( object.toS() );
    }

    // display each child's object's
    log( "***************** objects belonging to each child subtree ***********");
    for ( const node of s.children ) {
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
