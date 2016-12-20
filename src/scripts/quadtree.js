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
      console.log( "inserting to children" );
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
      new quadtree( 0, 0, this.centerX(), this.centerY() ), // bottom right
    ]
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

    let o1 = { x: 5, y: 5 }
    let o2 = { x: 5, y: 75 }
    let o3 = { x: 75, y: 75 }
    let o4 = { x: 75, y: 5 }

    s.insert( o1 );
    s.insert( o2 );
    s.insert( o3 );
    s.insert( o4 );
  }

}

quadtree.test();
