# Browser Physics Baseline

Captured on 2026-07-25 after quadtree collision integration, Barnes-Hut
gravity, cross-tree particle indexing, and rendering cleanup.

## Environment

- Git commit: `052e4e179bb8d7da3c1482d989a359d949fe4c92`
- Branch: `quadtree-complete`
- Worktree: dirty with the branch implementation
- Node: `v24.11.1`
- Headless Chromium: `143.0.7499.4`
- CPU: AMD Ryzen 7 9800X3D 8-Core Processor
- Viewport: 1280 × 900
- Barnes-Hut theta: 0.5
- Fixture: seeded, non-overlapping jittered grid
- Samples: 20 warmup frames followed by 60 recorded frames

The command was:

```bash
npm run bench:browser
```

## Full-Frame Results

Times are median/p95 milliseconds. Frame interval includes scheduling and
browser work outside the JavaScript timing region.

| Mode | Population | Frame interval | Physics | Render | Frames over 33.3 ms |
|---|---:|---:|---:|---:|---:|
| Spatial | 400 | 16.7 / 16.7 | 0.9 / 1.4 | 0.1 / 0.2 | 0 / 60 |
| Spatial | 1,000 | 16.7 / 16.7 | 2.8 / 3.1 | 0.2 / 0.3 | 0 / 60 |
| Spatial | 5,000 | 28.5 / 30.9 | 20.2 / 22.2 | 1.0 / 1.3 | 1 / 60 |
| Spatial | 10,000 | 62.6 / 64.4 | 45.6 / 47.2 | 5.7 / 5.9 | 60 / 60 |
| Exact | 400 | 16.7 / 16.8 | 0.7 / 1.0 | 0.1 / 0.2 | 0 / 60 |
| Exact | 1,000 | 16.7 / 16.8 | 3.4 / 3.7 | 0.2 / 0.3 | 0 / 60 |
| Spatial + overlay | 1,000 | 16.7 / 16.8 | 3.0 / 3.2 | 0.3 / 0.4 | 0 / 60 |
| Spatial | 1,000 + 1,000 particles | 16.7 / 16.8 | 11.5 / 12.5 | 0.8 / 0.8 | 0 / 60 |

At 10,000 bodies the candidate set was only 72,522 pairs. Rendering consumed
about 6 ms; Barnes-Hut gravity, with roughly 2.93 million applied sources, was
the dominant cost.

## Gameplay Stress Correction

The sparse fixture above is a control, not a representative capacity claim.
The first browser benchmark did not cover the explosion-heavy workload later
observed in the app: 6,600 balls plus 10,000 particles in dense clusters, with
objects straddling the canvas boundary.

The new `--stress` case reproduces that shape. On the same machine, its first
run measured about 877 ms of physics per frame:

| Stage | Median time |
|---|---:|
| Tree construction | 6.2 ms |
| Gravity | 274.3 ms |
| Collision handling | 597.6 ms |
| Rendering | 21.0 ms |

Fifty rejected particles exposed a fallback bug. The cross-tree collision
fallback needed 330,000 checks involving those rejected particles, but it
scanned all 66 million ball-particle combinations to find them. Restricting the
scan to pairs that actually contain a rejected object reduced collision time
to about 5.5 ms and total physics to about 267 ms.

A specialized allocation-light Barnes-Hut accumulator then reduced gravity
from about 257 ms to roughly 170–175 ms without changing the accepted source
nodes or force model. The remaining split in a representative frame was:

| Stage | Approximate time |
|---|---:|
| Ball-only gravity | 46 ms |
| Ball-particle gravity | 123 ms |
| All indexed collision handling | 5–11 ms |
| Tree construction | 4–5 ms |
| Rendering | 20–21 ms |

The cross-gravity work applied roughly 5.7 million sources: about 2.5 million
to balls from particles and 3.2 million to particles from balls. This is now
the dominant scaling decision.

That evidence led to two explicit production modes. A 10-sample comparison
after three warmup frames on the identical fixture measured:

| Production mode | Theta | Frame interval | Physics | Gravity | Render |
|---|---:|---:|---:|---:|---:|
| Fast | 0.7 | 60.6 / 79.1 | 31.7 / 50.3 | 22.7 / 23.2 | 19.5 / 21.4 |
| Full | 0.5 | 223.2 / 231.7 | 193.3 / 202.4 | 181.4 / 187.4 | 21.3 / 22.0 |

Fast remains the default. It retains ball gravity, particle motion, lifetime,
rendering, and indexed ball-particle collisions, but disables mutual
ball-particle gravity. Full restores that coupling and the tighter opening
parameter. The UI exposes the choice instead of silently changing behavior at
a population threshold.

The current Fast-mode sparse control, using the same 10-sample/3-warmup quick
run, measured:

| Population | Frame interval | Physics | Render |
|---:|---:|---:|---:|
| 400 | 16.7 | 0.6 | 0.1 |
| 1,000 | 16.7 | 1.6 | 0.3 |
| 5,000 | 18.2 | 9.5 | 1.1 |
| 10,000 | 36.9 | 20.1 | 5.7 |

## Accuracy and Throughput Presets

Full mode uses the accuracy-oriented `theta = 0.5`. Against exact gravity on
the deterministic 1,000-body oracle it measured:

- Normalized RMS force error below 0.1%.
- p95 per-body relative force error below 5%.
- Fewer than one quarter of the exact directed source interactions.

Fast mode uses `theta = 0.7` and trades some accuracy for throughput:

| Population | Frame interval | Physics | Render |
|---:|---:|---:|---:|
| 5,000 | 20.9 / 23.1 | 12.5 / 14.2 | 1.0 / 1.2 |
| 10,000 | 45.0 / 47.2 | 27.6 / 29.6 | 5.8 / 6.1 |

On the same 1,000-body force oracle, theta 0.7 had about 0.04% normalized RMS
error and 8.7% p95 per-body relative error. Full mode remains available when
the tighter approximation and particle coupling matter more than throughput.

For context, exact 5,000-body physics measured about 81.5 ms per frame in the
focused comparison, versus 20.9 ms for spatial physics at theta 0.7.

## Supported Scale Statement

On this reference desktop and deterministic sparse fixture:

- Fast mode demonstrates 60 FPS at 1,000 bodies.
- Fast mode measures roughly 55 FPS at 5,000 bodies.
- Fast mode measures roughly 27 FPS at 10,000 bodies.
- A 1,000-body/1,000-particle Fast workload remains near 60 FPS.
- Full mode remains available for lower-scale fidelity comparisons.

The configured 10,000-ball and 25,000-particle capacities remain safety
ceilings, not performance guarantees. Clustered scenes with many genuine
overlaps can still require quadratic collision response. With the particle
model now explicit, Canvas rendering and ball-only Barnes-Hut traversal are the
next measured high-scale targets.

## Live Busy-Scene Rejection Capture

A later Firefox capture at 10,000 balls and 10,325 particles measured a
642 ms frame interval, including 552 ms of physics and 47 ms of rendering.
The tree rejected 918 balls and 2,575 particles. Those bodies triggered:

- 8,758,179 fallback ball-pair checks.
- 32,601,034 fallback ball-particle checks.
- 10,332,410 exact gravity interactions, mostly accepted targets applying
  every rejected ball as an exact source.

The resulting stage times were 158 ms for gravity, 89 ms for ball collisions,
and 274 ms for ball-particle collisions. Lifecycle processing was 10 ms, so
the removal path itself was not the primary sustained cost. This telemetry
does not directly attribute garbage-collector pauses, which can occur inside
any measured stage or between frames.

The world now contains moved balls before building the tree and expands tree
bounds to index every finite off-canvas body. The fixed-root fallback remains
covered as a defensive path, but normal frames no longer enter it merely
because a body crosses the canvas boundary.

The original paused stress command subsequently reported zero rejected bodies
and zero fallback pairs. A new active `--busy` fixture adds mixed radii,
movement, and off-canvas particles. Quick 10-sample measurements after three
warmup frames were:

| Population | Frame interval | Physics | Render | Fallback pairs |
|---:|---:|---:|---:|---:|
| 4,000 balls + 10,600 particles | 43.2 / 52.5 ms | 18.6 / 28.7 ms | 22.0 / 23.9 ms | 0 |
| 10,000 balls + 10,000 particles | 80.4 / 82.9 ms | 45.3 / 47.3 ms | 23.7 / 25.7 ms | 0 |

These are headless Chromium reference measurements, not Firefox guarantees.
They isolate the rejection fix and establish a repeatable active workload for
the next gravity, rendering, and allocation passes.

## Explosion-Wave Capture and Churn Fixture

A 10-second live Firefox capture after the rejection correction found
synchronized replacement waves. A representative worst frame removed 7,925
balls and 8,596 particles, then added 7,441 balls and 8,749 particles. Across
the captured worst frames, roughly 7,000–8,000 balls and 8,000–9,000 particles
were being replaced per frame.

The worst measured frame took 285 ms:

| Stage | Time |
|---|---:|
| Tree construction | 16 ms |
| Ball gravity | 57 ms |
| Ball collisions | 89 ms |
| Ball-particle collisions | 32 ms |
| Lifecycle | 10 ms |
| Particle advance | 28 ms |
| Rendering | 52 ms |

That frame contained 2.7 million ball candidates and 164,119 real ball
collisions. It also corrected 2,506 balls before indexing and 6,396 after
collision response. The actual dense collision work—not quadtree rejection—
had become the dominant physics cost.

Three changes now target the wave:

- Dead balls and particles are removed with linear array compaction instead
  of repeated `splice()` calls.
- Explosion processing adds replacements as it goes and stops at capacity,
  avoiding fragments for thousands of dead parents that cannot contribute a
  replacement.
- The animation loop caps the simulation delta at 33.3 ms. A slow frame no
  longer advances movement by 200–300 ms and creates a positive feedback loop.

Collision and fragment math no longer allocate temporary vectors in their hot
paths. The collision normal also uses deterministic handling only for truly
coincident centers; the legacy code randomly kicked every nearly vertical
fragment pair.

The new repeated `--churn` benchmark replaces 75% of balls and 50% of
particles per cycle. A 10-sample/3-warmup reference run ended at 10,000 balls
plus 14,112 particles and measured:

| Stage | Median / p95 |
|---|---:|
| Full measured frame | 90.4 / 99.9 ms |
| Physics | 47.3 / 56.4 ms |
| Rendering | 42.7 / 48.4 ms |
| Gravity | 22.5 / 24.0 ms |
| Collisions | 13.5 / 25.0 ms |
| Lifecycle | 1.0 / 8.0 ms |

This fixture generated about 12,000 fragments and removed about 12,000 bodies
per measured cycle with no rejected bodies or fallback pairs. At this point,
Canvas rendering and ball gravity set the steady high-population floor; dense
real collision count still determines the worst evolved scenes.
