import { vec2 } from './vec2.js';
import { vec3 } from './vec3.js';
import { Ball } from './ball.js';
import { Background } from './background.js';
import { shuffle } from './utils.js';
import { quadtree, debug_on } from './quadtree.js';

function nowMilliseconds() {
  return globalThis.performance?.now?.() ?? Date.now();
}

export const GravityMode = Object.freeze({
  FAST: 'fast',
  FULL: 'full',
});

const GRAVITY_MODE_SETTINGS = Object.freeze({
  [GravityMode.FAST]: Object.freeze({
    barnesHutTheta: 0.7,
    useBallParticleGravity: false,
  }),
  [GravityMode.FULL]: Object.freeze({
    barnesHutTheta: 0.5,
    useBallParticleGravity: true,
  }),
});

function disabledCrossGravityStats() {
  return {
    mode: 'disabled-cross',
    exactInteractions: 0,
    approximations: 0,
    appliedSources: 0,
    ballTargetSources: 0,
    particleTargetSources: 0,
    ballTargetMs: 0,
    particleTargetMs: 0,
  };
}

export class World
{
  constructor() {
    this.min_x = 0;
    this.min_y = 0;
    this.max_x = 1;
    this.max_y = 1;
    this.g = 0.0005;
    this.c = new vec3( 0, 0, 255 );
    this.n_divs = 3;
    this.init();
    this.background = new Background();
    this.shouldDrawBackground = true;
    this.pizza_time = false;
    this.max_balls = 10000;
    this.max_particles = 25000;
    this.is_paused = false;
    this.useQuadtreeCollisions = true;
    this.useBarnesHutGravity = true;
    this.showQuadtreeOverlay = false;
    this.setGravityMode( GravityMode.FAST );
    this.gravitySoftening = 0.000001;
    this.lastGravityStats = null;
    this.purple = false;
    this.debug = false;
    this.EXPLODE_V_FACTOR = 0.1;
    this.EXPLODER_SIZE_FACTOR = 1.5;
    this.N_DIVS = 2;
  }

  setGravityMode( mode ) {
    const settings = GRAVITY_MODE_SETTINGS[ mode ];
    if ( !settings ) {
      throw new Error( `Unknown gravity mode "${mode}"` );
    }
    this.gravityMode = mode;
    this.barnesHutTheta = settings.barnesHutTheta;
    this.useBallParticleGravity = settings.useBallParticleGravity;
    return this.gravityMode;
  }

  toggleGravityMode() {
    return this.setGravityMode(
      this.gravityMode === GravityMode.FAST
        ? GravityMode.FULL
        : GravityMode.FAST
    );
  }

  init() {
    this.balls = [];
    this.planets = [];
    this.particles = [];
    this.lastQuadtree = null;
    this.quadtreeRejected = [];
    this.lastParticleQuadtree = null;
    this.particleQuadtreeRejected = [];
    this.lastGravityStats = null;
    this.lastCollisionStats = {
      ballCandidates: 0,
      ballFallbackCandidates: 0,
      ballCollisions: 0,
      ballParticleCandidates: 0,
      ballParticleFallbackCandidates: 0,
      ballParticleCollisions: 0,
    };
    this.lastPhysicsBreakdown = null;

    let pink = new vec3( 255, 50, 50 );
    let blue = new vec3( 0, 0, 255 );
    let green = new vec3( 0, 255, 0 );

    // let b1 = new Ball( 0.5, 0.2, 0.01, pink.copy() );
    // b1.v.x = -0.02;
    // b1.is_affected_by_gravity = true;
    // b1.is_moving = true;
    // b1.is_invincible = false;
    // b1.hp = 0.00001;
    // this.addBall( b1 );
    //
    // let b2 = new Ball( 0.2, 0.2, 0.10, blue.copy() );
    // b2.v.x = 0.02;
    // b2.is_affected_by_gravity = true;
    // b2.is_moving = true;
    // b2.is_invincible = false;
    // b2.hp = 0.00001;
    // this.addBall( b2 );
    //
    // let b3 = new Ball( 50, 500, 200, pink.copy() );
    // b3.v.x = 20;
    // b3.is_affected_by_gravity = true;
    // b3.is_moving = true;
    // b3.is_invincible = false;
    // this.addBall( b3 );
    //
    // let b4 = new Ball( 2000, 500, 50, green.copy() );
    // b4.v.x = -20;
    // b4.is_affected_by_gravity = true;
    // b4.is_moving = true;
    // b4.is_invincible = false;
    // this.addBall( b4 );
  }

  advance( dt, canvas ) {
    const advanceStart = nowMilliseconds();
    let particle_dt = dt;
    if ( this.is_paused ) {
      // its sort of cool when we let the object settling process take play while paused
      dt = 0;

      // but instead we delay any world updates at all
      // return;
    }
    this.background.advance( dt * 13 );
    const backgroundEnd = nowMilliseconds();

    let MIN_BALL_RADIUS = 0.002;
    let MIN_FRAG_RADIUS = 0.0002;
    let WALL_ELASTIC_FACTOR = 0.9;

    // Move every ball before constructing the collision broad phase.
    for ( const b of this.balls ) {
      if ( b.is_moving ) {
        b.center.x += b.v.x * dt;
        b.center.y += b.v.y * dt;
      }
    }
    const preTreeWallCorrections = this.containBalls(
      canvas,
      WALL_ELASTIC_FACTOR,
    );
    const movementEnd = nowMilliseconds();

    const needsQuadtree = (
      this.useQuadtreeCollisions ||
      this.useBarnesHutGravity ||
      this.showQuadtreeOverlay
    );
    if ( needsQuadtree ) {
      this.lastQuadtree = this.buildQuadtree( canvas );
    } else {
      this.lastQuadtree = null;
      this.quadtreeRejected = [];
    }
    const ballTreeEnd = nowMilliseconds();

    const needsParticleQuadtree = (
      this.useQuadtreeCollisions ||
      this.useBarnesHutGravity
    );
    if ( needsParticleQuadtree && this.particles.length > 0 ) {
      this.lastParticleQuadtree = this.buildParticleQuadtree( canvas );
    } else {
      this.lastParticleQuadtree = null;
      this.particleQuadtreeRejected = [];
    }
    const particleTreeEnd = nowMilliseconds();

    let gravityMilliseconds = 0;
    let ballGravityMilliseconds = 0;
    let crossGravityMilliseconds = 0;
    if ( this.useBarnesHutGravity ) {
      const gravityStart = nowMilliseconds();
      const ballGravityStart = gravityStart;
      this.lastGravityStats = this.applyBallGravityBarnesHut(
        this.lastQuadtree,
      );
      const crossGravityStart = nowMilliseconds();
      ballGravityMilliseconds += crossGravityStart - ballGravityStart;
      const crossGravity = this.useBallParticleGravity
        ? this.applyBallParticleGravityBarnesHut(
          this.lastQuadtree,
          this.lastParticleQuadtree,
        )
        : disabledCrossGravityStats();
      const gravityEnd = nowMilliseconds();
      crossGravityMilliseconds += gravityEnd - crossGravityStart;
      this.lastGravityStats.exactInteractions += crossGravity.exactInteractions;
      this.lastGravityStats.approximations += crossGravity.approximations;
      this.lastGravityStats.appliedSources += crossGravity.appliedSources;
      this.lastGravityStats.crossInteractions = crossGravity.appliedSources;
      this.lastGravityStats.crossBallTargetSources = (
        crossGravity.ballTargetSources
      );
      this.lastGravityStats.crossParticleTargetSources = (
        crossGravity.particleTargetSources
      );
      this.lastGravityStats.crossBallTargetMs = crossGravity.ballTargetMs;
      this.lastGravityStats.crossParticleTargetMs = (
        crossGravity.particleTargetMs
      );
      this.lastGravityStats.gravityMode = this.gravityMode;
      this.lastGravityStats.particleGravityEnabled = (
        this.useBallParticleGravity
      );
      gravityMilliseconds += gravityEnd - gravityStart;
    }

    const ballCollisionStart = nowMilliseconds();
    if ( this.useQuadtreeCollisions ) {
      this.applyBallCollisionsQuadtree( canvas, this.lastQuadtree );
    } else {
      this.applyBallCollisionsBruteForce();
    }
    const ballCollisionEnd = nowMilliseconds();

    const ballParticleCollisionStart = nowMilliseconds();
    if ( this.useQuadtreeCollisions ) {
      this.applyBallParticleCollisionsQuadtree(
        this.lastQuadtree,
        this.lastParticleQuadtree,
      );
    } else {
      this.applyBallParticleCollisionsBruteForce();
    }
    const ballParticleCollisionEnd = nowMilliseconds();

    if ( !this.useBarnesHutGravity ) {
      const gravityStart = nowMilliseconds();
      const ballGravityStart = gravityStart;
      this.lastGravityStats = this.applyBallGravityExact();
      const crossGravityStart = nowMilliseconds();
      ballGravityMilliseconds += crossGravityStart - ballGravityStart;
      const crossGravity = this.useBallParticleGravity
        ? this.applyBallParticleGravityExact()
        : disabledCrossGravityStats();
      const gravityEnd = nowMilliseconds();
      crossGravityMilliseconds += gravityEnd - crossGravityStart;
      this.lastGravityStats.exactInteractions += crossGravity.exactInteractions;
      this.lastGravityStats.crossInteractions = crossGravity.exactInteractions;
      this.lastGravityStats.gravityMode = this.gravityMode;
      this.lastGravityStats.particleGravityEnabled = (
        this.useBallParticleGravity
      );
      gravityMilliseconds += gravityEnd - gravityStart;
    }

    const lifecycleStart = nowMilliseconds();

    // interact with planets
    for ( let i = 0; i < this.balls.length; i++ ) {
      let b = this.balls[ i ];

      for ( let pIndex = 0; pIndex < this.planets.length; pIndex++ ) {
        let p = this.planets[ pIndex ];
        // apply gravity
        // F = (G * m1 * m2) / (Distance^2)
        let d = b.center.distance( p.center );
        let F = ( this.g * b.m * p.m ) / ( d * d );
        let a = F / b.m;
        let D = ( p.center.copy().minus( b.center ) ).normalize();
        b.v.plus( D.times( a ) );

        // crash em together
        if ( b.center.distance( p.center ) < b.r + p.r ) {
          b.collide( p );
        }
      }
    }

    // Collision separation can push balls back through a wall, so contain them
    // again before finishing the frame.
    const postCollisionWallCorrections = this.containBalls(
      canvas,
      WALL_ELASTIC_FACTOR,
    );

    // remove dead balls from world
    const dead_balls = [];
    let liveBallIndex = 0;
    for ( const ball of this.balls ) {
      if ( !ball.is_invincible && ball.hp < 0 ) {
        dead_balls.push( ball );
      } else {
        this.balls[ liveBallIndex++ ] = ball;
      }
    }
    this.balls.length = liveBallIndex;

    // Deal with the dead balls.
    // Some get removed from the world. Others get exploded into more balls.
    // First though, randomly sort the dead balls. This helps prevent new balls from having a bias
    // toward one direction.
    shuffle(dead_balls);
    let explodedBallCount = 0;
    let generatedFragmentCount = 0;
    let discardedFragmentCount = 0;
    let newBallCount = 0;
    let newParticleCount = 0;
    for ( let i = 0; i < dead_balls.length; i++ ) {
      // If we're already at max capacity, just remove the ball.
      if ( this.balls.length >= this.max_balls ) {
        break;
      }

      // Otherwise, explode it and add its frags to the world.
      let ball = dead_balls[ i ];
      let frags = ball.explode( this.N_DIVS, MIN_FRAG_RADIUS, this.EXPLODE_V_FACTOR, this.EXPLODER_SIZE_FACTOR );
      explodedBallCount++;
      generatedFragmentCount += frags.length;
      shuffle(frags);
      for ( let frag_index = 0; frag_index < frags.length; frag_index++ ) {
        // If the fragment is big enough, and there is capacity, add it to the world as a ball.
        // Otherwise, add it as a particle.
        let frag = frags[ frag_index ];
        if ( frag.r >= MIN_BALL_RADIUS ) {
          if ( this.balls.length < this.max_balls ) {
            this.balls.push( frag );
            newBallCount++;
          } else {
            discardedFragmentCount++;
          }
        } else if ( this.particles.length < this.max_particles ) {
          // Add randomness to particle lifespan.
          frag.hp = frag.calcHp() * Math.random();
          // Give particles a velocity boost.
          frag.v.normalize().times(MIN_FRAG_RADIUS * 1000 * Math.random());
          this.particles.push( frag );
          newParticleCount++;
        } else {
          discardedFragmentCount++;
        }
      }
    }

    // do particle stuff
    const particleAdvanceStart = nowMilliseconds();
    const removedParticleCount = this.advanceParticles( particle_dt );
    const particleAdvanceEnd = nowMilliseconds();

    // Prune excess balls.
    let prunedBallCount = 0;
    if ( this.balls.length > this.max_balls ) {
      // console.log( "Before: this.balls[0].hp: " + this.balls[0].hp );

      // Sort the balls by size, as removing large balls will be less obvious than removing small ones.
      this.balls.sort( function(a, b) {
        return parseFloat( b.r ) - parseFloat( a.r );
      });
      // console.log( "After: this.balls[0].hp: " + this.balls[0].hp );

      // Remove excess balls.
      let to_remove = this.balls.length - this.max_balls;
      this.balls.splice( this.balls.length - to_remove, to_remove );
      prunedBallCount = to_remove;
    }

    const advanceEnd = nowMilliseconds();
    this.lastPhysicsBreakdown = {
      totalMs: advanceEnd - advanceStart,
      backgroundMs: backgroundEnd - advanceStart,
      movementMs: movementEnd - backgroundEnd,
      ballTreeBuildMs: ballTreeEnd - movementEnd,
      particleTreeBuildMs: particleTreeEnd - ballTreeEnd,
      gravityMs: gravityMilliseconds,
      ballGravityMs: ballGravityMilliseconds,
      crossGravityMs: crossGravityMilliseconds,
      ballCollisionMs: ballCollisionEnd - ballCollisionStart,
      ballParticleCollisionMs: (
        ballParticleCollisionEnd - ballParticleCollisionStart
      ),
      lifecycleMs: (
        advanceEnd -
        lifecycleStart -
        ( particleAdvanceEnd - particleAdvanceStart )
      ),
      particleAdvanceMs: particleAdvanceEnd - particleAdvanceStart,
      collisions: { ...this.lastCollisionStats },
      rejectedBalls: this.quadtreeRejected.length,
      rejectedParticles: this.particleQuadtreeRejected.length,
      preTreeWallCorrections,
      postCollisionWallCorrections,
      lifecycle: {
        removedBalls: dead_balls.length,
        addedBalls: newBallCount,
        addedParticles: newParticleCount,
        removedParticles: removedParticleCount,
        prunedBalls: prunedBallCount,
        explodedBalls: explodedBallCount,
        skippedExplosions: dead_balls.length - explodedBallCount,
        generatedFragments: generatedFragmentCount,
        discardedFragments: discardedFragmentCount,
      },
      gravityMode: this.gravityMode,
      particleGravityEnabled: this.useBallParticleGravity,
      barnesHutTheta: this.barnesHutTheta,
    };
  }

  ballsIntersect( left, right ) {
    const dx = left.center.x - right.center.x;
    const dy = left.center.y - right.center.y;
    const radius = left.r + right.r;
    return dx * dx + dy * dy < radius * radius;
  }

  collideBallPair( left, right ) {
    if ( this.ballsIntersect( left, right ) ) {
      left.collide( right );
      return true;
    }
    return false;
  }

  applyBallCollisionsBruteForce() {
    let collisionCount = 0;
    const candidateCount = (
      this.balls.length * ( this.balls.length - 1 ) / 2
    );
    for ( let i = 0; i < this.balls.length; i++ ) {
      for ( let j = i + 1; j < this.balls.length; j++ ) {
        if ( this.collideBallPair( this.balls[ i ], this.balls[ j ] ) ) {
          collisionCount++;
        }
      }
    }
    this.lastCollisionStats.ballCandidates = candidateCount;
    this.lastCollisionStats.ballFallbackCandidates = 0;
    this.lastCollisionStats.ballCollisions = collisionCount;
    return collisionCount;
  }

  applyBallCollisionsQuadtree( canvas, tree = null ) {
    this.lastQuadtree = tree ?? this.buildQuadtree( canvas );
    let collisionCount = 0;

    const candidateCount = this.lastQuadtree.forEachPotentialPair( ( left, right ) => {
      if ( this.collideBallPair( left, right ) ) {
        collisionCount++;
      }
    });

    let fallbackCandidateCount = 0;
    if ( this.quadtreeRejected.length > 0 ) {
      const rejected = new Set( this.quadtreeRejected );
      const rejectedIndices = this.quadtreeRejected
        .map( ball => this.balls.indexOf( ball ) )
        .filter( index => index >= 0 )
        .sort( ( left, right ) => left - right );

      for ( let i = 0; i < this.balls.length; i++ ) {
        const left = this.balls[ i ];
        if ( rejected.has( left ) ) {
          for ( let j = i + 1; j < this.balls.length; j++ ) {
            fallbackCandidateCount++;
            if ( this.collideBallPair( left, this.balls[ j ] ) ) {
              collisionCount++;
            }
          }
          continue;
        }

        for ( const rejectedIndex of rejectedIndices ) {
          if ( rejectedIndex <= i ) {
            continue;
          }
          fallbackCandidateCount++;
          if ( this.collideBallPair( left, this.balls[ rejectedIndex ] ) ) {
            collisionCount++;
          }
        }
      }
    }

    this.lastCollisionStats.ballCandidates = candidateCount;
    this.lastCollisionStats.ballFallbackCandidates = fallbackCandidateCount;
    this.lastCollisionStats.ballCollisions = collisionCount;
    return collisionCount;
  }

  collideBallParticlePair( ball, particle ) {
    if ( !this.ballsIntersect( ball, particle ) ) {
      return false;
    }

    const wasInvincible = ball.is_invincible;
    const wasMoving = ball.is_moving;
    ball.is_invincible = true;
    ball.is_moving = false;
    try {
      ball.collide( particle );
    } finally {
      ball.is_invincible = wasInvincible;
      ball.is_moving = wasMoving;
    }
    return true;
  }

  applyBallParticleCollisionsBruteForce() {
    let collisionCount = 0;
    const candidateCount = this.balls.length * this.particles.length;
    for ( const ball of this.balls ) {
      for ( const particle of this.particles ) {
        if ( this.collideBallParticlePair( ball, particle ) ) {
          collisionCount++;
        }
      }
    }
    this.lastCollisionStats.ballParticleCandidates = candidateCount;
    this.lastCollisionStats.ballParticleFallbackCandidates = 0;
    this.lastCollisionStats.ballParticleCollisions = collisionCount;
    return collisionCount;
  }

  applyBallParticleCollisionsQuadtree( ballTree, particleTree ) {
    if ( !particleTree ) {
      this.lastCollisionStats.ballParticleCandidates = 0;
      this.lastCollisionStats.ballParticleFallbackCandidates = 0;
      this.lastCollisionStats.ballParticleCollisions = 0;
      return 0;
    }
    if ( !ballTree ) {
      throw new Error('Ball-particle quadtree collisions require a ball tree');
    }

    let collisionCount = 0;
    const candidateCount = ballTree.forEachPotentialPairBetween(
      particleTree,
      ( ball, particle ) => {
        if ( this.collideBallParticlePair( ball, particle ) ) {
          collisionCount++;
        }
      },
    );

    let fallbackCandidateCount = 0;
    if (
      this.quadtreeRejected.length > 0 ||
      this.particleQuadtreeRejected.length > 0
    ) {
      const rejectedBalls = new Set( this.quadtreeRejected );
      for ( const ball of this.balls ) {
        const particles = rejectedBalls.has( ball )
          ? this.particles
          : this.particleQuadtreeRejected;
        for ( const particle of particles ) {
          fallbackCandidateCount++;
          if ( this.collideBallParticlePair( ball, particle ) ) {
            collisionCount++;
          }
        }
      }
    }

    this.lastCollisionStats.ballParticleCandidates = candidateCount;
    this.lastCollisionStats.ballParticleFallbackCandidates = (
      fallbackCandidateCount
    );
    this.lastCollisionStats.ballParticleCollisions = collisionCount;
    return collisionCount;
  }

  applyGravityFromSource( target, sourceMass, sourceX, sourceY ) {
    const dx = sourceX - target.center.x;
    const dy = sourceY - target.center.y;
    if ( dx === 0 && dy === 0 ) {
      return false;
    }

    const distanceSquared = (
      dx * dx +
      dy * dy +
      this.gravitySoftening * this.gravitySoftening
    );
    const inverseDistance = 1 / Math.sqrt( distanceSquared );
    const velocityScale = (
      this.g *
      sourceMass *
      inverseDistance /
      distanceSquared
    );
    target.v.x += dx * velocityScale;
    target.v.y += dy * velocityScale;
    return true;
  }

  applyBallGravityExact() {
    let interactionCount = 0;
    for ( let i = 0; i < this.balls.length; i++ ) {
      const b = this.balls[ i ];
      for ( let j = i + 1; j < this.balls.length; j++ ) {
        const b2 = this.balls[ j ];
        if ( b.is_affected_by_gravity && b2.is_affected_by_gravity ) {
          const dx = b2.center.x - b.center.x;
          const dy = b2.center.y - b.center.y;
          if ( dx === 0 && dy === 0 ) {
            continue;
          }
          const distanceSquared = (
            dx * dx +
            dy * dy +
            this.gravitySoftening * this.gravitySoftening
          );
          const inverseDistance = 1 / Math.sqrt( distanceSquared );
          const scale = this.g * inverseDistance / distanceSquared;
          b.v.x += dx * scale * b2.m;
          b.v.y += dy * scale * b2.m;
          b2.v.x -= dx * scale * b.m;
          b2.v.y -= dy * scale * b.m;
          interactionCount++;
        }
      }
    }

    return {
      mode: 'exact',
      exactInteractions: interactionCount,
      approximations: 0,
    };
  }

  applyBallParticleGravityExact() {
    let interactionCount = 0;
    for ( const ball of this.balls ) {
      for ( const particle of this.particles ) {
        if (
          !ball.is_affected_by_gravity ||
          !particle.is_affected_by_gravity
        ) {
          continue;
        }

        const dx = particle.center.x - ball.center.x;
        const dy = particle.center.y - ball.center.y;
        if ( dx === 0 && dy === 0 ) {
          continue;
        }
        const distanceSquared = (
          dx * dx +
          dy * dy +
          this.gravitySoftening * this.gravitySoftening
        );
        const inverseDistance = 1 / Math.sqrt( distanceSquared );
        const scale = this.g * inverseDistance / distanceSquared;
        ball.v.x += dx * scale * particle.m;
        ball.v.y += dy * scale * particle.m;
        particle.v.x -= dx * scale * ball.m;
        particle.v.y -= dy * scale * ball.m;
        interactionCount++;
      }
    }

    return {
      mode: 'exact-cross',
      exactInteractions: interactionCount,
      approximations: 0,
    };
  }

  applyBallGravityBarnesHut( tree ) {
    if ( !tree ) {
      throw new Error('Barnes-Hut gravity requires a current quadtree');
    }

    tree.calculateMassProperties( ball => (
      ball.is_affected_by_gravity ? ball.m : 0
    ));

    let exactInteractions = 0;
    let approximations = 0;
    let appliedSources = 0;

    for ( const target of this.balls ) {
      if ( !target.is_affected_by_gravity ) {
        continue;
      }

      const acceleration = tree.calculateMassAcceleration(
        target,
        this.barnesHutTheta,
        this.gravitySoftening,
      );
      target.v.x += acceleration.x * this.g;
      target.v.y += acceleration.y * this.g;
      exactInteractions += acceleration.exactSources;
      approximations += acceleration.approximations;
      appliedSources += acceleration.appliedSources;

      for ( const source of this.quadtreeRejected ) {
        if (
          source !== target &&
          source.is_affected_by_gravity &&
          this.applyGravityFromSource(
            target,
            source.m,
            source.center.x,
            source.center.y,
          )
        ) {
          exactInteractions++;
          appliedSources++;
        }
      }
    }

    return {
      mode: 'barnes-hut',
      exactInteractions,
      approximations,
      appliedSources,
      theta: this.barnesHutTheta,
    };
  }

  applyBallParticleGravityBarnesHut( ballTree, particleTree ) {
    if ( !particleTree ) {
      return {
        mode: 'barnes-hut-cross',
        exactInteractions: 0,
        approximations: 0,
        appliedSources: 0,
        ballTargetSources: 0,
        particleTargetSources: 0,
        ballTargetMs: 0,
        particleTargetMs: 0,
      };
    }
    if ( !ballTree ) {
      throw new Error('Ball-particle Barnes-Hut gravity requires a ball tree');
    }

    particleTree.calculateMassProperties( particle => (
      particle.is_affected_by_gravity ? particle.m : 0
    ));
    if ( typeof ballTree.massAccessor !== 'function' ) {
      ballTree.calculateMassProperties( ball => (
        ball.is_affected_by_gravity ? ball.m : 0
      ));
    }

    let exactInteractions = 0;
    let approximations = 0;
    let appliedSources = 0;

    const applyTreeSources = (
      targets,
      sourceTree,
      rejectedSources,
    ) => {
      for ( const target of targets ) {
        if ( !target.is_affected_by_gravity ) {
          continue;
        }
        const acceleration = sourceTree.calculateMassAcceleration(
          target,
          this.barnesHutTheta,
          this.gravitySoftening,
        );
        target.v.x += acceleration.x * this.g;
        target.v.y += acceleration.y * this.g;
        exactInteractions += acceleration.exactSources;
        approximations += acceleration.approximations;
        appliedSources += acceleration.appliedSources;

        for ( const source of rejectedSources ) {
          if (
            source.is_affected_by_gravity &&
            this.applyGravityFromSource(
              target,
              source.m,
              source.center.x,
              source.center.y,
            )
          ) {
            exactInteractions++;
            appliedSources++;
          }
        }
      }
    };

    const ballTargetStart = nowMilliseconds();
    applyTreeSources(
      this.balls,
      particleTree,
      this.particleQuadtreeRejected,
    );
    const particleTargetStart = nowMilliseconds();
    const ballTargetSources = appliedSources;
    applyTreeSources(
      this.particles,
      ballTree,
      this.quadtreeRejected,
    );
    const particleTargetEnd = nowMilliseconds();

    return {
      mode: 'barnes-hut-cross',
      exactInteractions,
      approximations,
      appliedSources,
      ballTargetSources,
      particleTargetSources: appliedSources - ballTargetSources,
      ballTargetMs: particleTargetStart - ballTargetStart,
      particleTargetMs: particleTargetEnd - particleTargetStart,
    };
  }

  advanceParticles( dt ) {
    // if ( this.particles.length > 0 ) console.log( "num particles: " + this.particles.length );

    let removedParticleCount = 0;
    let liveParticleIndex = 0;
    for ( const p of this.particles ) {
      // fade em 10x faster if past some limit
      const remainingParticleCount = (
        this.particles.length - removedParticleCount
      );
      let fade_scalar = remainingParticleCount > this.max_particles ? 10 : 1;
      p.hp -= 0.0005 * dt * fade_scalar;
      // remove the dead ones
      if ( p.hp <= 0 ) {
        removedParticleCount++;
        continue;
      }
      // move em
      if ( p.is_moving ) {
        p.center.x += p.v.x * dt;
        p.center.y += p.v.y * dt;
      }

      // interact with planets
      for ( let pIndex = 0; pIndex < this.planets.length; pIndex++ ) {
        let planet = this.planets[ pIndex ];

        // apply gravity
        let d = p.center.distance( planet.center );
        let F = ( this.g * p.m * planet.m ) / ( d * d );
        let a = F / p.m;
        let D = ( planet.center.copy().minus( p.center ) ).normalize();
        p.v.plus( D.times( a ) );

        // crash em together
        // if ( p.center.distance( planet.center ) < p.r + planet.r ) {
          p.collide( planet );
          // planet.collide( p );
        // }
      }

      // maybe could apply gravity against other objects
      this.particles[ liveParticleIndex++ ] = p;
    }
    this.particles.length = liveParticleIndex;
    return removedParticleCount;
  }

  addBall( b, addEvenIfFull = false ) {
    console.log( 'adding ball: ' + b.toS() );
    if ( !b ) {
      return;
    }

    if ( this.purple && this.background ) {
      b.color.copyFrom( this.background.rgb );
    }

     // if there is capacity, just add the ball
    if ( this.balls.length < this.max_balls ) {
      this.balls.push( b );
      console.log( 'ball added' );
    } else if ( addEvenIfFull ) {
      // if we've exceeded capacity, replace a random ball
      let ball_index = Math.trunc( Math.random() * this.balls.length );
      this.balls[ ball_index ] = b;
      console.log( 'ball added, displacing ball at index: ' + ball_index );
    }
  }

  addPlanet( p ) {
    console.log("adding planet");
    if ( this.purple && this.background ) {
      p.color.copyFrom( this.background.rgb );
    }

    this.planets.push( p );
    if ( !p ) {
      throw("planet NOT added");
    }
  }

  draw( canvas, ctx ) {
    if ( this.shouldDrawBackground ) {
      this.background.draw(canvas, ctx);
    } else {
      ctx.fillStyle = "rgb(" + 0 + "," + 0 + "," + 0 + ")";
      ctx.fillRect( 0, 0, canvas.width, canvas.height );
    }

    for ( let i = 0; i < this.particles.length; i++ ) {
      let p = this.particles[ i ];
      p.draw( ctx, this.getDrawScale(canvas), this.pizza_time );
    }

    for ( let i = 0; i < this.planets.length; i++ ) {
      let p = this.planets[ i ];
      p.draw( ctx, this.getDrawScale(canvas), this.pizza_time );
    }

    for ( let i = 0; i < this.balls.length; i++ ) {
      let b = this.balls[ i ];
      b.draw( ctx, this.getDrawScale(canvas), this.pizza_time );
    }

    if ( this.showQuadtreeOverlay && this.lastQuadtree ) {
      if ( debug_on ) {
        console.log( this.lastQuadtree.toS() );
        if ( this.quadtreeRejected.length > 0 ) {
          console.warn(
            "quadtree rejected " + this.quadtreeRejected.length + " ball(s)"
          );
        }
      }
      this.drawQuadtreeOverlay( this.lastQuadtree, canvas, ctx );
    }

  }

  containBalls( canvas, elasticFactor ) {
    const scale = this.getDrawScale( canvas );
    const maxX = canvas.width / scale;
    const maxY = canvas.height / scale;
    const fudge = 0.00001;
    let correctedBalls = 0;

    for ( const ball of this.balls ) {
      let corrected = false;
      if ( ball.center.x + ball.r >= maxX ) {
        ball.center.x = maxX - ball.r - fudge;
        ball.v.x = -ball.v.x * elasticFactor;
        corrected = true;
      }
      if ( ball.center.y + ball.r >= maxY ) {
        ball.center.y = maxY - ball.r - fudge;
        ball.v.y = -ball.v.y * elasticFactor;
        corrected = true;
      }
      if ( ball.center.x - ball.r <= this.min_x ) {
        ball.center.x = this.min_x + ball.r + fudge;
        ball.v.x = -ball.v.x * elasticFactor;
        corrected = true;
      }
      if ( ball.center.y - ball.r <= this.min_y ) {
        ball.center.y = this.min_y + ball.r + fudge;
        ball.v.y = -ball.v.y * elasticFactor;
        corrected = true;
      }
      if ( corrected ) {
        correctedBalls++;
      }
    }

    return correctedBalls;
  }

  quadtreeBounds( canvas, bodies ) {
    const scale = this.getDrawScale( canvas );
    let minX = this.min_x;
    let minY = this.min_y;
    let maxX = canvas.width / scale;
    let maxY = canvas.height / scale;

    for ( const body of bodies ) {
      minX = Math.min( minX, body.center.x - body.r );
      minY = Math.min( minY, body.center.y - body.r );
      maxX = Math.max( maxX, body.center.x + body.r );
      maxY = Math.max( maxY, body.center.y + body.r );
    }

    return { minX, minY, maxX, maxY };
  }

  buildQuadtree( canvas ) {
    const bounds = this.quadtreeBounds( canvas, this.balls );
    const tree = new quadtree(
      bounds.minX,
      bounds.minY,
      bounds.maxX,
      bounds.maxY,
      {
        capacity: 3,
        maxDepth: 16
      }
    );

    this.quadtreeRejected = [];
    for ( const ball of this.balls ) {
      if ( !tree.insert( ball ) ) {
        this.quadtreeRejected.push( ball );
      }
    }
    return tree;
  }

  buildParticleQuadtree( canvas ) {
    const bounds = this.quadtreeBounds( canvas, this.particles );
    const tree = new quadtree(
      bounds.minX,
      bounds.minY,
      bounds.maxX,
      bounds.maxY,
      {
        capacity: 3,
        maxDepth: 16
      }
    );

    this.particleQuadtreeRejected = [];
    for ( const particle of this.particles ) {
      if ( !tree.insert( particle ) ) {
        this.particleQuadtreeRejected.push( particle );
      }
    }
    return tree;
  }

  drawQuadtreeOverlay( tree, canvas, ctx ) {
    const scale = this.getDrawScale( canvas );
    const nodes = [ tree ];

    ctx.save();
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 1;
    while ( nodes.length > 0 ) {
      const node = nodes.pop();
      ctx.strokeRect(
        node.min_x * scale,
        node.min_y * scale,
        ( node.max_x - node.min_x ) * scale,
        ( node.max_y - node.min_y ) * scale
      );
      nodes.push( ...node.children );
    }
    ctx.restore();
  }

  getDrawBackground() {
    return this.shouldDrawBackground;
  }

  getDrawScale(canvas) {
    let scale_factor = Math.max( canvas.width, canvas.height );
    return scale_factor;
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
    this.n_divs = this.n_divs.toFixed( 0 );
    console.log( "sliding: " + this.n_divs );
  }
}
