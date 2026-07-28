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

## Renderer Prototype Follow-up

Captured on 2026-07-26 from the dirty `optimize-more` worktree at commit
`1055432ae5c9dc86632a99482a4f6785a9695811`. The prototype adds an
instanced-circle WebGL2 renderer while keeping Canvas2D as the reference and
default backend.

The render-only benchmark used 10 recorded frames after three warmup frames in
headless Chromium. WebGL2 ran through ANGLE's SwiftShader software device, so
these are architecture and main-thread submission measurements—not
hardware-GPU throughput:

| Backend | Visible bodies | Static submission | Mutating submission |
|---|---:|---:|---:|
| Canvas2D | 10,000 | 4.4 / 4.8 ms | 7.0 / 8.3 ms |
| Canvas2D | 25,000 | 18.0 / 23.9 ms | 27.1 / 33.7 ms |
| Canvas2D | 50,000 | 42.7 / 50.3 ms | 58.7 / 74.3 ms |
| Canvas2D | 100,000 | 418.1 / 892.8 ms | 446.0 / 924.9 ms |
| WebGL2 (SwiftShader) | 10,000 | 0.6 / 0.8 ms | 0.4 / 0.7 ms |
| WebGL2 (SwiftShader) | 25,000 | 0.6 / 0.7 ms | 0.6 / 0.9 ms |
| WebGL2 (SwiftShader) | 50,000 | 0.8 / 1.1 ms | 0.8 / 1.3 ms |
| WebGL2 (SwiftShader) | 100,000 | 1.8 / 2.0 ms | 1.6 / 3.2 ms |

The WebGL2 path packs circle position/radius, color, and outline flags into
reused typed arrays and submits all visible particles, planets, and balls in
one instanced draw. At 100,000 bodies, packing accounted for about 1.6 ms of
the 1.8 ms static median. The next power-of-two capacity is 131,072 instances;
the position/radius, color, and outline arrays occupy about 2.13 MiB on the CPU
and another 2.13 MiB in explicitly allocated GPU buffers, excluding driver
overhead. A separate `gl.finish()` measurement did not expose material
additional wait on SwiftShader; real GPU timing still needs a hardware-browser
capture.

The active browser benchmark now pins both random generation and the simulation
step. This makes backend comparisons evolve the same body state instead of
letting renderer speed alter subsequent physics. Thirty recorded frames after
ten warmups produced:

| Fixture/backend | Physics | Render | Measured frame |
|---|---:|---:|---:|
| Busy Canvas2D | 65.4 / 77.0 ms | 3.8 / 4.0 ms | 69.3 / 80.9 ms |
| Busy WebGL2 (SwiftShader) | 63.4 / 77.9 ms | 0.3 / 0.5 ms | 63.8 / 78.3 ms |
| Churn Canvas2D | 66.2 / 100.8 ms | 14.4 / 25.8 ms | 83.4 / 119.2 ms |
| Churn WebGL2 (SwiftShader) | 67.7 / 95.8 ms | 0.5 / 1.0 ms | 68.3 / 96.2 ms |

The paired runs had identical candidates, cross-pairs, collision hits, gravity
sources, lifecycle counts, culling, and final populations. This confirms the
largest gain in the explosion-heavy workload: the render wave is almost
removed, reducing its median measured frame by about 15 ms. It also confirms
the next limit. Even with WebGL2 submission below 1 ms, Barnes-Hut traversal,
tree construction, and dense collision work leave the busy and churn fixtures
well above a 33.3 ms frame budget.

At this prototype checkpoint, WebGL2 covered core ordered circles and adaptive
outlines only. Animated backgrounds, pizza textures, debug drawing, purple
mode, and the quadtree overlay were still disabled. The later feature-parity
work documented below closed those gaps before making WebGL2 the automatic
default.

## Gravity Traversal Follow-up

Captured on 2026-07-26 from the dirty `optimize-more` worktree at commit
`1055432ae5c9dc86632a99482a4f6785a9695811`. The dedicated gravity benchmark
measures production quadtree construction, mass aggregation, and all-body
Barnes-Hut traversal independently. It resets velocity outside the timed
region, uses 30 samples after ten warmups, and keeps exact-force and structural
diagnostics outside the timed region.

At 10,000 bodies and theta 0.7, the optimized traversal retained the exact same
source counts and velocity checksums as the reference:

| Fixture | Applied sources | Reference traversal | Optimized traversal | Reduction |
|---|---:|---:|---:|---:|
| Jittered | 1,058,709 | 11.0 ms | 10.2 ms | 7% |
| Clustered | 1,328,134 | 23.4 ms | 21.0 ms | 10% |
| Busy mixed-radius | 1,321,701 | 23.8 ms | 20.8 ms | 13% |

Mass aggregation was only 0.2–0.4 ms at this size. The dominant gravity cost is
therefore walking roughly 110 nodes per target in the jittered fixture and 158
nodes per target in the clustered and busy fixtures—not aggregating the tree or
cleaning up removed bodies.

The busy fixture also scales beyond the app's current cap:

| Bodies | Applied sources | Reference traversal | Optimized traversal | Optimized build + gravity |
|---:|---:|---:|---:|---:|
| 25,000 | 3,713,767 | 72.3 ms | 62.5 ms | 74.9 ms |
| 50,000 | 8,104,797 | 163.5 ms | 141.5 ms | 165.4 ms |

Production-loop A/B runs used 30 recorded frames after ten warmups. Every
recorded workload trace—body counts, gravity interactions, collision candidates,
collision hits, and lifecycle counts—matched, as did the final weighted
position/velocity checksums:

| Fixture | Stage | Reference | Optimized | Reduction |
|---|---|---:|---:|---:|
| Busy, 10k balls + 10k particles | Gravity | 30.6 ms | 26.5 ms | 13% |
|  | Physics | 48.5 ms | 42.7 ms | 12% |
|  | Measured frame | 51.2 ms | 45.3 ms | 12% |
| Churn, 10k balls + 16k particles initially | Gravity | 21.8 ms | 18.7 ms | 14% |
|  | Physics | 47.1 ms | 43.4 ms | 8% |
|  | Measured frame | 56.3 ms | 53.5 ms | 5% |

Full gravity, which adds both directions of ball-particle traversal, benefited
more: at 1,000 balls plus 1,000 particles, median gravity fell from 6.9 to
4.7 ms while its workload trace and state checksum remained identical.

The optimized path specializes the hot loop for simulation bodies, reuses its
traversal stack, avoids per-target result objects and callback dispatch, caches
target coordinates, and updates velocity directly. A separate V8 sampling run
at 1,000 busy bodies attributed about 8.8 MiB of sampled allocations to three
reference iterations versus 6.5 MiB to the optimized path. Allocation profiling
perturbs timings, so these values diagnose allocation sources rather than
measure throughput.

These results motivated evaluating a contiguous view of the retained
object-node quadtree against the same reference implementation and fixtures.

## Flattened Gravity View

Captured on 2026-07-26 from the dirty `optimize-more` worktree after commit
`f1ee19b8802ca35aaad50db9c52ed2c4a3144913`. The flat implementation copies
the current quadtree's node structure and leaf body references into reusable
typed arrays. Barnes–Hut then walks integer node IDs instead of object
references. Collision indexing remains on the established object tree, making
this a deliberately isolated gravity change.

The benchmark times the copy rather than hiding it. At 10,000 bodies it costs
roughly 0.2–0.3 ms, and mass aggregation costs another 0.2–0.3 ms. Thirty
samples after ten warmups measured:

| Fixture | Optimized object build + gravity | Flat build + copy + gravity | Change |
|---|---:|---:|---:|
| Clustered | 24.1 ms | 21.6 ms | 10% lower |
| Busy mixed-radius | 23.9 ms | 21.7–21.9 ms | 8–9% lower |
| Jittered | 11.9 ms | 13.1 ms | 10% higher |

The regular jittered layout is an important counterexample: contiguous storage
is not intrinsically faster when the object traversal is shallow and
predictable. Broader 10,000-body checks were favorable for application-shaped
layouts: uniform, mixed-radius, moving, boundary, clustered, and busy fixtures
improved the complete pipeline by roughly 7–18%; a perfect grid regressed about
4%.

The advantage persists above the app's current cap:

| Busy bodies | Optimized traversal | Flat traversal | Optimized total | Flat total |
|---:|---:|---:|---:|---:|
| 25,000 | 62.3 ms | 52.8 ms | 72.9 ms | 63.0 ms |
| 50,000 | 145.5 ms | 125.3 ms | 170.6 ms | 149.8 ms |

The flat and object paths applied exactly 3,713,767 sources at 25,000 bodies and
8,104,797 at 50,000. The harness now treats equal source counts and velocity
checksums as a requirement and fails a comparison if they differ.

In the active 10,000-ball plus 10,000-particle Fast fixture, flat storage
reduced median gravity from 26.3 to 23.5 ms and total physics from 41.3 to
39.4 ms. The complete measured frame fell from 43.6 to 41.8 ms. Full gravity
uses flat views for both trees: at 5,000 balls plus 5,000 particles, gravity
fell from 51.2 to 43.5 ms and physics from 58.0 to 49.7 ms. Paired workload
traces and final state checksums were identical.

The flat implementation is therefore the production default, while
`optimized` and `reference` remain selectable in the benchmarks. It uses
`Float64Array` for physical values to preserve JavaScript's existing numerical
precision, integer arrays for topology and traversal state, geometrically grown
capacities, and reusable body/node stacks.

This view improves locality but does not yet remove construction of the
collision tree. A five-iteration V8 sampling profile at 10,000 busy bodies
attributed roughly 28 MiB to both flat and optimized runs; object `Quadtree`
construction and `split` dominated both profiles. The profiler perturbs timing,
so the absolute byte count is diagnostic rather than a throughput measurement.
The result nevertheless makes the next architectural boundary clear: replacing
the canonical object collision tree is required to eliminate its per-frame
node allocation rather than merely accelerating gravity traversal.

## WebGL2 Feature Parity

Captured on 2026-07-26 from the dirty `optimize-more` worktree after commit
`563775a417c4012ec79b611d9636cf8915628f2d`. WebGL2 now implements every
rendering control exposed by Canvas2D:

- The animated background is generated by a full-screen fragment shader.
- Pizza Time lazily uploads the existing image and repeats it in canvas
  coordinates, matching the Canvas pattern.
- Quadtree bounds are packed into a reusable line buffer and drawn after the
  bodies.
- Debug drawing routes through the active renderer.
- Purple mode advances background-derived body colors without redrawing the
  background once per body.

The app now requests WebGL2 when no renderer query is present and automatically
falls back to Canvas2D when WebGL2 is unavailable. `?renderer=canvas2d` remains
the explicit reference path, and the Renderer button switches between the two.

Cross-backend browser tests read rendered pixels for ordinary body colors,
Pizza Time, and the animated/background-off states. They also build and render
a real quadtree overlay under each backend, exercise Purple and Debug, and
simulate WebGL2 unavailability to verify startup fallback.

A ten-sample render-only check after three warmups retained the accelerated
submission profile under ANGLE SwiftShader:

| Backend | Visible bodies | Submission median / p95 |
|---|---:|---:|
| Canvas2D | 10,000 | 4.2 / 6.7 ms |
| Canvas2D | 50,000 | 42.8 / 49.8 ms |
| Canvas2D | 100,000 | 80.0 / 89.8 ms |
| WebGL2 (SwiftShader) | 10,000 | 0.3 / 1.2 ms |
| WebGL2 (SwiftShader) | 50,000 | 1.1 / 1.8 ms |
| WebGL2 (SwiftShader) | 100,000 | 2.5 / 4.1 ms |

The 1,000-body spatial overlay case submitted a 1,000-body frame and its tree
in a 0.2 ms median render interval. A 10,000-ball plus 10,000-particle active
scene retained a 0.8 ms median WebGL2 render interval; its 76.4 ms median
physics time again confirms that rendering is no longer the busy-scene limit.
These measurements use software WebGL to make headless validation possible and
do not estimate hardware-GPU throughput.
