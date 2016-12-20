"use strict";
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
      element.x >= this.min_x ||
      element.x < this.max_x ||
      element.y >= this.min_y ||
      element.y < this.max_y );
    console.log( "fits? " + fits + ": element: " + element.x + ", " + element.y +
      ", quad x[" + this.min_x + ", " + this.max_x + "], y[" + this.min_y + ", " + this.max_y + "]");
    return fits;
  }

  hasChildren() {
    return ( this.children.length > 0 );
  }

  hasObjects() {
    return ( this.objects.length > 0 );
  }

  insert( element ) {
    console.log( "\ninserting... " + element.toS() );
    if ( !this.fitsInside( element ) ) {
        console.log( "self: " + this.toS() );
        throw "input OOBs!";
    }

    if ( this.objects.length < this.MAX_SIZE ) {
      console.log( "inserting internally" );
      this.objects.push( element );
    } else if ( this.hasChildren() ) {
      console.log( "inserting to children..." );
      let inserted = false;
      for ( const child of this.children ) {
        if ( this.fitsInside( element ) ) {
          console.log( "  fits!" );
          child.insert( element );
          inserted = true;
        }
        else {
          console.log(" not fits " );
        }
      }
      if ( !inserted ) { throw "unable to insert"; }
    } else {
      this.split();
      this.insert( element );
    }
    console.log( "insert is done" );
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
      throw "can only split once: "  + this;
    }
    this.children = [
      new quadtree( 0, 0, this.centerX(), this.centerY() ), // top left
      new quadtree( 0, this.centerY(), this.centerX(), this.max_y ), // bottom left
      new quadtree( this.centerX(), 0, this.max_x, this.centerY() ), // top right
      new quadtree( this.centerX(), this.centerY(), this.max_x, this.max_y ) // bottom right
    ];
    for ( const obj in this.objects ) {
      this.insert( obj );
    }
    console.log( this.toS() );
    console.log( "split is done" );
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
      s = s + "\nObjects[" + this.objects.length + "]:";
      for ( const obj of this.objects ) {
        s = s + "\n\t" + obj.toS();//.replace( /\n/g, '\n\t' );
      }
    }
    if ( this.hasChildren() ) {
      s = s + "\nChildren[" + this.children.length + "]:";
      for ( const child of this.children ) {
        s = s + "\n\t" + child.toS();//.replace( /\n/g, '\n\t' );
      }
    }
    return s;
  }

  static test() {
    console.log( "yalla!" );
    let s = new quadtree( 0, 0, 100, 100 );
    console.log( "say hello to quadtree:\n" + s.toS() );

    s.insert( new qtElement(  5,  5 ) );
    console.log( "\n" + s.toS() );
    s.insert( new qtElement(  5, 75 ) );
    console.log( "\n" + s.toS() );
    s.insert( new qtElement( 75, 75 ) );
    s.insert( new qtElement( 75,  5 ) );
  }

}

quadtree.test();
