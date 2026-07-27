import {
  PARTICLE_PIXEL_RADIUS,
} from '../world.js';

const INITIAL_INSTANCE_CAPACITY = 1024;

const VERTEX_SHADER_SOURCE = `#version 300 es
precision highp float;

layout(location = 0) in vec2 a_corner;
layout(location = 1) in vec3 a_circle;
layout(location = 2) in vec4 a_color;
layout(location = 3) in float a_outline;

uniform vec2 u_canvas_size;
uniform float u_scale;

out vec2 v_local;
out vec4 v_color;
out float v_outline;
out float v_radius_pixels;

void main() {
  float radius_pixels = a_circle.z * u_scale;
  vec2 center_pixels = a_circle.xy * u_scale;
  vec2 position_pixels = center_pixels + a_corner * radius_pixels;
  vec2 clip_position = vec2(
    position_pixels.x / u_canvas_size.x * 2.0 - 1.0,
    1.0 - position_pixels.y / u_canvas_size.y * 2.0
  );

  gl_Position = vec4(clip_position, 0.0, 1.0);
  v_local = a_corner;
  v_color = a_color;
  v_outline = a_outline;
  v_radius_pixels = radius_pixels;
}
`;

const FRAGMENT_SHADER_SOURCE = `#version 300 es
precision highp float;

in vec2 v_local;
in vec4 v_color;
in float v_outline;
in float v_radius_pixels;

out vec4 out_color;

void main() {
  float distance_from_center = length(v_local);
  float antialias_width = max(fwidth(distance_from_center), 0.001);
  float coverage = 1.0 - smoothstep(
    1.0 - antialias_width,
    1.0 + antialias_width,
    distance_from_center
  );
  if (coverage <= 0.0) {
    discard;
  }

  vec3 color = v_color.rgb;
  if (v_outline > 0.5) {
    float outline_width = min(
      0.45,
      1.0 / max(v_radius_pixels, 1.0)
    );
    float outline_start = 1.0 - outline_width;
    float outline_mix = smoothstep(
      outline_start - antialias_width,
      outline_start + antialias_width,
      distance_from_center
    );
    color = mix(color, vec3(0.0), outline_mix);
  }

  out_color = vec4(color, v_color.a * coverage);
}
`;

function nowMilliseconds() {
  return globalThis.performance?.now?.() ?? Date.now();
}

function compileShader( gl, type, source ) {
  const shader = gl.createShader( type );
  if ( !shader ) {
    throw new Error( 'WebGL2 failed to allocate a shader' );
  }
  gl.shaderSource( shader, source );
  gl.compileShader( shader );
  if ( !gl.getShaderParameter( shader, gl.COMPILE_STATUS ) ) {
    const message = gl.getShaderInfoLog( shader ) ?? 'unknown shader error';
    gl.deleteShader( shader );
    throw new Error( `WebGL2 shader compilation failed: ${message}` );
  }
  return shader;
}

function createProgram( gl ) {
  const vertexShader = compileShader(
    gl,
    gl.VERTEX_SHADER,
    VERTEX_SHADER_SOURCE,
  );
  const fragmentShader = compileShader(
    gl,
    gl.FRAGMENT_SHADER,
    FRAGMENT_SHADER_SOURCE,
  );
  const program = gl.createProgram();
  if ( !program ) {
    gl.deleteShader( vertexShader );
    gl.deleteShader( fragmentShader );
    throw new Error( 'WebGL2 failed to allocate a program' );
  }

  gl.attachShader( program, vertexShader );
  gl.attachShader( program, fragmentShader );
  gl.linkProgram( program );
  gl.deleteShader( vertexShader );
  gl.deleteShader( fragmentShader );
  if ( !gl.getProgramParameter( program, gl.LINK_STATUS ) ) {
    const message = gl.getProgramInfoLog( program ) ?? 'unknown link error';
    gl.deleteProgram( program );
    throw new Error( `WebGL2 program link failed: ${message}` );
  }
  return program;
}

function createBuffer( gl ) {
  const buffer = gl.createBuffer();
  if ( !buffer ) {
    throw new Error( 'WebGL2 failed to allocate a buffer' );
  }
  return buffer;
}

function emptyCategoryStats( attemptedBodies ) {
  return {
    attemptedBodies,
    drawnBodies: 0,
    culledBodies: 0,
    pixelBodies: 0,
    circleBodies: 0,
    outlinedBodies: 0,
    packMs: 0,
  };
}

export class WebGL2Renderer
{
  constructor( canvas ) {
    const context = canvas.getContext( 'webgl2', {
      alpha: false,
      antialias: true,
      preserveDrawingBuffer: false,
    });
    if ( !context ) {
      throw new Error( 'WebGL2 is unavailable' );
    }

    this.backend = 'webgl2';
    this.canvas = canvas;
    this.context = context;
    const debugRendererInfo = context.getExtension(
      'WEBGL_debug_renderer_info',
    );
    this.graphicsInfo = Object.freeze({
      renderer: debugRendererInfo
        ? context.getParameter(
          debugRendererInfo.UNMASKED_RENDERER_WEBGL,
        )
        : context.getParameter( context.RENDERER ),
      shadingLanguageVersion: context.getParameter(
        context.SHADING_LANGUAGE_VERSION,
      ),
      vendor: debugRendererInfo
        ? context.getParameter(
          debugRendererInfo.UNMASKED_VENDOR_WEBGL,
        )
        : context.getParameter( context.VENDOR ),
      version: context.getParameter( context.VERSION ),
    });
    this.capabilities = Object.freeze({
      animatedBackground: false,
      debugOverlay: false,
      pizzaTexture: false,
      purpleMode: false,
      quadtreeOverlay: false,
    });

    const gl = this.context;
    this.program = createProgram( gl );
    this.vertexArray = gl.createVertexArray();
    if ( !this.vertexArray ) {
      throw new Error( 'WebGL2 failed to allocate a vertex array' );
    }
    this.cornerBuffer = createBuffer( gl );
    this.circleBuffer = createBuffer( gl );
    this.colorBuffer = createBuffer( gl );
    this.outlineBuffer = createBuffer( gl );
    this.canvasSizeLocation = gl.getUniformLocation(
      this.program,
      'u_canvas_size',
    );
    this.scaleLocation = gl.getUniformLocation( this.program, 'u_scale' );
    if ( !this.canvasSizeLocation || !this.scaleLocation ) {
      throw new Error( 'WebGL2 failed to locate renderer uniforms' );
    }

    gl.bindVertexArray( this.vertexArray );

    gl.bindBuffer( gl.ARRAY_BUFFER, this.cornerBuffer );
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([
        -1, -1,
         1, -1,
        -1,  1,
         1,  1,
      ]),
      gl.STATIC_DRAW,
    );
    gl.enableVertexAttribArray( 0 );
    gl.vertexAttribPointer( 0, 2, gl.FLOAT, false, 0, 0 );

    gl.bindBuffer( gl.ARRAY_BUFFER, this.circleBuffer );
    gl.enableVertexAttribArray( 1 );
    gl.vertexAttribPointer( 1, 3, gl.FLOAT, false, 0, 0 );
    gl.vertexAttribDivisor( 1, 1 );

    gl.bindBuffer( gl.ARRAY_BUFFER, this.colorBuffer );
    gl.enableVertexAttribArray( 2 );
    gl.vertexAttribPointer( 2, 4, gl.UNSIGNED_BYTE, true, 0, 0 );
    gl.vertexAttribDivisor( 2, 1 );

    gl.bindBuffer( gl.ARRAY_BUFFER, this.outlineBuffer );
    gl.enableVertexAttribArray( 3 );
    gl.vertexAttribPointer( 3, 1, gl.UNSIGNED_BYTE, false, 0, 0 );
    gl.vertexAttribDivisor( 3, 1 );

    gl.bindVertexArray( null );
    gl.bindBuffer( gl.ARRAY_BUFFER, null );

    gl.disable( gl.DEPTH_TEST );
    gl.disable( gl.CULL_FACE );
    gl.enable( gl.BLEND );
    gl.blendFunc( gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA );
    gl.clearColor( 0, 0, 0, 1 );

    this.capacity = 0;
    this.circles = new Float32Array();
    this.colors = new Uint8Array();
    this.outlines = new Uint8Array();
    this.ensureCapacity( INITIAL_INSTANCE_CAPACITY );
  }

  resize( width, height ) {
    if ( this.canvas.width !== width ) {
      this.canvas.width = width;
    }
    if ( this.canvas.height !== height ) {
      this.canvas.height = height;
    }
    this.context.viewport( 0, 0, this.canvas.width, this.canvas.height );
  }

  ensureCapacity( requiredCapacity ) {
    if ( requiredCapacity <= this.capacity ) {
      return;
    }

    let nextCapacity = Math.max(
      INITIAL_INSTANCE_CAPACITY,
      this.capacity || INITIAL_INSTANCE_CAPACITY,
    );
    while ( nextCapacity < requiredCapacity ) {
      nextCapacity *= 2;
    }

    this.capacity = nextCapacity;
    this.circles = new Float32Array( this.capacity * 3 );
    this.colors = new Uint8Array( this.capacity * 4 );
    this.outlines = new Uint8Array( this.capacity );

    const gl = this.context;
    gl.bindBuffer( gl.ARRAY_BUFFER, this.circleBuffer );
    gl.bufferData(
      gl.ARRAY_BUFFER,
      this.circles.byteLength,
      gl.DYNAMIC_DRAW,
    );
    gl.bindBuffer( gl.ARRAY_BUFFER, this.colorBuffer );
    gl.bufferData(
      gl.ARRAY_BUFFER,
      this.colors.byteLength,
      gl.DYNAMIC_DRAW,
    );
    gl.bindBuffer( gl.ARRAY_BUFFER, this.outlineBuffer );
    gl.bufferData(
      gl.ARRAY_BUFFER,
      this.outlines.byteLength,
      gl.DYNAMIC_DRAW,
    );
    gl.bindBuffer( gl.ARRAY_BUFFER, null );
  }

  packBodies(
    world,
    bodies,
    scale,
    startIndex,
    useParticleLod,
    useOutlineLod,
  ) {
    const packStart = nowMilliseconds();
    const stats = emptyCategoryStats( bodies.length );
    const width = this.canvas.width;
    const height = this.canvas.height;
    let instanceIndex = startIndex;

    for ( const body of bodies ) {
      const x = body.center.x * scale;
      const y = body.center.y * scale;
      const radiusPixels = body.r * scale;
      if (
        x + radiusPixels < 0 ||
        y + radiusPixels < 0 ||
        x - radiusPixels > width ||
        y - radiusPixels > height
      ) {
        stats.culledBodies++;
        continue;
      }

      const isPixelBody = (
        useParticleLod &&
        radiusPixels <= PARTICLE_PIXEL_RADIUS
      );
      const radius = isPixelBody
        ? Math.max( body.r, 0.5 / scale )
        : body.r;
      const shouldOutline = (
        !isPixelBody &&
        world.renderOutlines &&
        ( !useOutlineLod || radiusPixels >= world.highLoadOutlineRadius )
      );
      const circleOffset = instanceIndex * 3;
      this.circles[ circleOffset ] = body.center.x;
      this.circles[ circleOffset + 1 ] = body.center.y;
      this.circles[ circleOffset + 2 ] = radius;

      const colorOffset = instanceIndex * 4;
      if ( world.renderFillStyleOverride ) {
        this.colors[ colorOffset ] = 128;
        this.colors[ colorOffset + 1 ] = 128;
        this.colors[ colorOffset + 2 ] = 128;
      } else {
        this.colors[ colorOffset ] = body.color.x;
        this.colors[ colorOffset + 1 ] = body.color.y;
        this.colors[ colorOffset + 2 ] = body.color.z;
      }
      this.colors[ colorOffset + 3 ] = 255;
      this.outlines[ instanceIndex ] = shouldOutline ? 1 : 0;

      stats.drawnBodies++;
      if ( isPixelBody ) {
        stats.pixelBodies++;
      } else {
        stats.circleBodies++;
      }
      if ( shouldOutline ) {
        stats.outlinedBodies++;
      }
      instanceIndex++;
    }

    stats.packMs = nowMilliseconds() - packStart;
    return {
      nextIndex: instanceIndex,
      stats,
    };
  }

  render( world ) {
    const renderStart = nowMilliseconds();
    const attemptedBodies = (
      world.particles.length +
      world.planets.length +
      world.balls.length
    );
    const useOutlineLod = (
      world.adaptiveOutlines &&
      attemptedBodies > world.maxFullOutlineBodyCount
    );
    const scale = world.getDrawScale( this.canvas );
    this.ensureCapacity( attemptedBodies );

    let instanceCount = 0;
    const particles = this.packBodies(
      world,
      world.particles,
      scale,
      instanceCount,
      true,
      useOutlineLod,
    );
    instanceCount = particles.nextIndex;
    const planets = this.packBodies(
      world,
      world.planets,
      scale,
      instanceCount,
      false,
      useOutlineLod,
    );
    instanceCount = planets.nextIndex;
    const balls = this.packBodies(
      world,
      world.balls,
      scale,
      instanceCount,
      false,
      useOutlineLod,
    );
    instanceCount = balls.nextIndex;
    const packEnd = nowMilliseconds();

    const gl = this.context;
    const uploadStart = packEnd;
    gl.bindBuffer( gl.ARRAY_BUFFER, this.circleBuffer );
    gl.bufferSubData(
      gl.ARRAY_BUFFER,
      0,
      this.circles.subarray( 0, instanceCount * 3 ),
    );
    gl.bindBuffer( gl.ARRAY_BUFFER, this.colorBuffer );
    gl.bufferSubData(
      gl.ARRAY_BUFFER,
      0,
      this.colors.subarray( 0, instanceCount * 4 ),
    );
    gl.bindBuffer( gl.ARRAY_BUFFER, this.outlineBuffer );
    gl.bufferSubData(
      gl.ARRAY_BUFFER,
      0,
      this.outlines.subarray( 0, instanceCount ),
    );
    const uploadEnd = nowMilliseconds();

    gl.clear( gl.COLOR_BUFFER_BIT );
    gl.useProgram( this.program );
    gl.uniform2f(
      this.canvasSizeLocation,
      this.canvas.width,
      this.canvas.height,
    );
    gl.uniform1f( this.scaleLocation, scale );
    gl.bindVertexArray( this.vertexArray );
    if ( instanceCount > 0 ) {
      gl.drawArraysInstanced(
        gl.TRIANGLE_STRIP,
        0,
        4,
        instanceCount,
      );
    }
    gl.bindVertexArray( null );
    gl.flush();
    const renderEnd = nowMilliseconds();

    const categoryStats = [
      particles.stats,
      planets.stats,
      balls.stats,
    ];
    const sum = property => categoryStats.reduce(
      ( total, stats ) => total + stats[ property ],
      0,
    );
    const breakdown = {
      backend: this.backend,
      totalMs: renderEnd - renderStart,
      backgroundMs: 0,
      particleMs: particles.stats.packMs,
      planetMs: planets.stats.packMs,
      ballMs: balls.stats.packMs,
      overlayMs: 0,
      packMs: packEnd - renderStart,
      uploadMs: uploadEnd - uploadStart,
      submitMs: renderEnd - uploadEnd,
      outlineLodActive: useOutlineLod,
      attemptedBodies,
      drawnBodies: sum( 'drawnBodies' ),
      culledBodies: sum( 'culledBodies' ),
      pixelBodies: sum( 'pixelBodies' ),
      circleBodies: sum( 'circleBodies' ),
      outlinedBodies: sum( 'outlinedBodies' ),
      bufferCapacity: this.capacity,
      cpuBufferBytes: (
        this.circles.byteLength +
        this.colors.byteLength +
        this.outlines.byteLength
      ),
      gpuBufferBytes: (
        this.circles.byteLength +
        this.colors.byteLength +
        this.outlines.byteLength
      ),
      particles: particles.stats,
      planets: planets.stats,
      balls: balls.stats,
    };
    world.lastRenderBreakdown = breakdown;
    return breakdown;
  }

  synchronize() {
    const start = nowMilliseconds();
    this.context.finish();
    return nowMilliseconds() - start;
  }

  dispose() {
    const gl = this.context;
    gl.deleteBuffer( this.cornerBuffer );
    gl.deleteBuffer( this.circleBuffer );
    gl.deleteBuffer( this.colorBuffer );
    gl.deleteBuffer( this.outlineBuffer );
    gl.deleteVertexArray( this.vertexArray );
    gl.deleteProgram( this.program );
  }
}
