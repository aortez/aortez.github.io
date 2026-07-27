# Quadtree Completion Plan

## Objective

Turn the current visualization-only quadtree into a tested spatial index used
for ball collision broad-phase detection, while preserving the existing
simulation behavior and creating a path to populations far beyond the legacy
300–400 ball range.

This branch should leave behind:

- A deterministic, repeatable benchmark.
- A pure quadtree implementation with an explicit behavioral contract.
- Unit tests that prove collision candidates match brute force.
- Quadtree-backed ball collision detection.
- A reusable debug visualization that does not affect normal rendering.
- Browser-level performance and behavior coverage.

## Scale Goal

The current 300–400 ball limit is a compatibility and regression baseline, not
the target architecture.

The benchmark and implementation should examine distinct scale tiers:

```text
Legacy:       100–400 bodies
Near term:    1,000–5,000 bodies
High scale:   10,000–50,000 bodies
Exploratory:  100,000+ bodies
```

These tiers are workloads to measure, not promises that every dense scene will
run at the same rate. A scene in which every body overlaps every other body has
an inherently quadratic number of real collisions; no broad-phase structure
can optimize away interactions that actually need to be resolved.

Phase 1 should give us enough evidence to set an explicit product target that
includes:

- Body and particle counts.
- Typical and worst-supported spatial density.
- Gravity and collision semantics.
- Reference device class.
- Desired 60 FPS (16.7 ms) or 30 FPS (33.3 ms) frame budget.

No implementation decision should assume that 400 bodies is the eventual
ceiling.

## Starting State

- `World.advance()` checked every ball pair for collision and gravity.
- `World.draw()` rebuilt the quadtree only when its visualization was enabled.
- The tree had no query or candidate-pair API.
- `remove()` is incomplete and throws when it finds its target.
- There was no maximum depth or minimum node size.
- Debug messages and full tree strings are constructed even when debugging is
  disabled, making the current tree build unusually expensive.
- The tree owned rendering behavior and imported `Ball` and `vec3`.
- Existing Playwright coverage only verified that the quadtree button existed.
- An abandoned 2017 branch contains a useful pair-traversal concept, but its
  gravity behavior is incomplete and its code is too old to cherry-pick.

## Branch Progress

Phases 1 through 4 now have working implementations:

- The deterministic Node benchmark covers legacy through 100,000-body tiers.
- The pure tree contract has unit coverage across four seeds and every
  benchmark distribution.
- Bodies are indexed into leaves by center. Each node tracks its subtree's
  largest radius, allowing traversal to prune leaf pairs that cannot contain
  an overlap.
- Quadtree collision broad phase is integrated into `World`; exact
  ball-to-ball gravity remains separate.
- Rejected bodies take an explicit brute-force collision fallback.
- Debug drawing reuses the physics tree and has browser coverage across wide
  and tall viewports.
- Barnes-Hut gravity shares the collision tree, keeps exact gravity as an
  oracle, and has bounded-error tests for both `theta = 0.5` and `theta = 0.7`.
- Ball-particle collisions and gravity use cross-tree traversal in spatial
  mode instead of an unconditional Cartesian scan.
- The legacy FPS governor no longer forces capacity back toward 300 bodies.
- The headless-browser benchmark measures the real animation loop through
  10,000 bodies and includes particles and overlay cost.

The first refactor stored split-crossing circles in parent nodes. Scale
measurements rejected that design: at 100,000 uniformly distributed bodies it
produced 33.5 million candidates. Center indexing plus radius-aware leaf-pair
pruning reduces the same deterministic fixture to about 602,000 candidates.

The original accuracy-oriented reference-machine target was:

- 1,000 sparse bodies at 60 FPS with `theta = 0.5`.
- 5,000 sparse bodies at 30 FPS with `theta = 0.5`.
- 10,000 sparse bodies as an experimental tier at roughly 16 FPS.
- 1,000 bodies plus 1,000 particles near 60 FPS.

The 10,000-ball and 25,000-particle runtime capacities are not frame-rate
guarantees. Fast mode now uses `theta = 0.7`; Full uses `theta = 0.5`. Captured
measurements for both are recorded in `benchmarks/BROWSER_BASELINE.md`.

The first sparse browser baseline was subsequently challenged with a real
explosion-heavy frame containing roughly 6,600 balls and 10,000 particles. A
new `--stress` browser case now preserves that workload shape. It exposed and
fixed an avoidable full Cartesian scan in the rejected-particle collision
fallback, and stage telemetry now separates tree construction, ball gravity,
cross gravity, collision handling, lifecycle work, and rendering.

After the fallback fix and an allocation-light Barnes-Hut accumulator, full
ball-particle gravity remained the representative workload's dominant cost.
That decision is now explicit in the app: Fast is the default and treats
short-lived particles as visual effects with indexed collisions, while Full
restores mutual ball-particle gravity. The mode never changes automatically at
a population threshold. On the reference desktop, the current Fast sparse
control measured about 55 FPS at 5,000 balls and 27 FPS at 10,000 balls; the
6,600-ball/10,000-particle stress case measured about 16.5 FPS versus 4.5 FPS
in Full mode.

A second live capture at the 10,000-ball ceiling exposed a different
pathology: slow-frame movement and off-canvas particles caused 918 balls and
2,575 particles to miss the fixed canvas roots. Correctness fallback then
performed more than 41 million pair checks and applied every rejected ball as
an exact gravity source. Balls are now wall-contained before indexing and
world trees expand to retain finite off-canvas bodies. The fallback remains
tested as a defensive path rather than a normal high-scale execution mode.

The browser harness also has an active `--busy` case with mixed radii,
movement, off-canvas particles, and a 1536 × 1280 viewport. It complements the
paused `--stress` regression and can match a live count using
`--busy-balls` and `--busy-particles`.

A subsequent worst-frame capture showed a synchronized cascade replacing
roughly 7,000–8,000 balls and 8,000–9,000 particles per frame. Lifecycle
processing now uses linear compaction, stops fragment generation once
replacement capacity is filled, and reports generated/skipped fragment
counts. Collision and explosion hot paths avoid temporary vectors, and aligned
fragment pairs no longer receive artificial random jitter. The main loop caps
the simulation delta at 33.3 ms to prevent slow frames from causing
proportionally larger movement and still slower follow-up frames.

The browser harness now includes `--churn`, which repeatedly replaces 75% of
a saturated busy scene. It measures the burst path separately from the stable
`--stress` and active-but-invincible `--busy` controls.

## Scope Decisions

These decisions keep the first implementation focused and testable:

- Rebuild the tree once per physics frame. Do not incrementally update moving
  objects.
- Use the tree for ball collision broad-phase detection first.
- Keep ball-to-ball gravity exact and brute force initially as a correctness
  oracle, not as the final high-scale implementation.
- Keep particles and planets outside the first tree-integration patch, then
  remove unconditional ball-by-particle work before declaring the scaling work
  complete.
- Do not mutate body positions while inserting or querying the tree.
- Allow nodes at maximum depth to exceed their preferred capacity.
- Use a maximum depth or minimum extent instead of jittering coincident
  elements.
- Reuse the physics tree for debug drawing instead of rebuilding it in
  `World.draw()`.
- Remove the unused, broken `remove()` API unless a concrete caller requires
  it.
- Avoid fixed-size assumptions and per-pair allocation patterns in new APIs.

Incremental tree maintenance and a general collision-response rewrite are
deferred. Subquadratic gravity, particle indexing, rendering throughput, data
layout, and worker-thread options are explicit scaling decision points in this
plan.

## Phase 1: Deterministic Benchmark Harness

Add a Node-based benchmark that runs without a browser or development server.

Proposed files:

```text
benchmarks/
  quadtree-benchmark.js
  scenarios.js
```

Proposed commands:

```bash
npm run bench:quadtree
npm run bench:quadtree -- --full
npm run bench:quadtree -- --json
```

The benchmark should:

- Use a seeded pseudo-random number generator.
- Warm up the JavaScript runtime before recording results.
- Batch fast operations to avoid timer-resolution errors.
- Report median and p95 durations.
- Keep fixture creation and output outside timed regions.
- Record runtime, CPU, Git commit, and dirty-worktree metadata.
- Print human-readable tables by default and structured JSON on request.

Scenarios:

- A regular sparse grid that exposes recursive split-line alignment.
- A seeded jittered-grid control for representative sparse scaling.
- Seeded uniform random distribution.
- Clustered objects resembling explosion fragments.
- Objects crossing quadrant boundaries.
- Mixed radii with a few large circles.
- Coincident centers and maximum-depth overflow.
- Deterministically moving objects rebuilt over multiple frames.

The legacy baseline should cover 50, 100, 200, 400, and 800 objects without
making the current implementation take unreasonably long. After eager debug
formatting is removed, the default suite should add 1,000, 5,000, and 10,000
objects. Full mode should exercise 25,000, 50,000, and 100,000 objects using
adaptive iteration counts and explicit per-scenario time limits.

Metrics:

- Brute-force collision scan duration.
- Tree construction duration.
- Candidate enumeration duration.
- Exact intersection-filter duration.
- Total broad-phase duration.
- Total possible pairs, candidate pairs, and true intersections.
- Node count, maximum depth, and maximum local occupancy.
- Objects processed per second and candidate-reduction ratio.
- Scaling ratio as the population doubles.
- Heap usage and garbage-collection pressure where it can be measured without
  distorting the timed region.

The initial benchmark can record current construction and retrieval behavior.
Candidate metrics should become mandatory when the pair API is introduced.

Acceptance criteria:

- Repeated runs use identical fixtures and pair counts.
- JSON output is machine-readable and contains no timing output from inside the
  measured region.
- Benchmark result files are not committed by default.
- The current implementation's baseline is captured for the branch/PR notes.

## Phase 2: Define the Quadtree Contract with Unit Tests

Use Node's built-in test runner so the core suite has no browser or new test
dependency.

Proposed location and command:

```text
unit/quadtree.test.js
npm run test:unit
```

Contract to encode:

- Every accepted object is stored exactly once.
- Root bounds include objects tangent to every outer edge.
- Every object descends according to its center, including an object whose
  radius crosses a split.
- Subtree maximum radii prevent center-based indexing from pruning a genuine
  cross-boundary circle overlap.
- Capacity triggers subdivision but is not a hard limit at maximum depth.
- Coincident and zero-radius elements terminate safely.
- Invalid bounds, capacity, depth, radius, and coordinates are rejected
  consistently.
- Out-of-bounds insertion has an explicit result and is never silently lost.
- Potential pairs contain every true circle intersection.
- Each unordered candidate pair is emitted at most once.
- Tree construction and queries never mutate indexed objects.

The primary correctness test should compare quadtree pairs with a brute-force
oracle across many seeded layouts. After exact circle filtering, both sets must
be identical.

Acceptance criteria:

- The suite covers all benchmark scenarios at smaller sizes.
- A missed or duplicate pair produces a useful failure containing the seed and
  object IDs.
- Degenerate input cannot recurse indefinitely or overflow the call stack.
- Tests run independently from Playwright and Vite.

## Phase 3: Refactor into a Pure Spatial Index

Refactor `src/scripts/quadtree.js` around the tested contract.

The tree should:

- Contain no canvas, image, color, `Ball`, or `vec3` behavior.
- Validate constructor options and insertion inputs.
- Track depth and enforce `maxDepth` or a minimum extent.
- Avoid building log messages when debug output is disabled.
- Expose lightweight structural statistics for tests and benchmarks.
- Expose a candidate-pair traversal such as
  `forEachPotentialPair(callback)`.
- Throw `Error` objects rather than strings.
- Avoid returning mutable internal arrays.

Pair traversal should cover:

- Pairs among objects stored in the same leaf.
- Cartesian pairs between distinct leaves whose bounds are close enough for
  their maximum circle radii to overlap.
- Recursive same-subtree and cross-subtree paths without duplicate leaf pairs.

An earlier parent-straddler traversal covered parent/descendant pairs, but its
false-positive growth was unacceptable at high scale. The center-indexed
leaf-pair contract supersedes that intermediate design.

Acceptance criteria:

- All unit tests pass.
- All benchmark scenarios pass the brute-force correctness oracle.
- No eager debug serialization appears in production timing paths.
- On the same reference machine, a 400-object construction should improve
  materially from the current approximately 13 ms baseline; a sub-1 ms local
  target is reasonable but should not be a CI timing gate.
- Sparse and representative mixed-radius construction should exhibit a
  subquadratic scaling curve through the agreed high-scale target.
- The implementation should complete bounded 10,000+ object scenarios without
  recursion failure or pathological debug/allocation overhead.

## Phase 4: Integrate the Tree into Ball Collisions

Separate the ball interaction responsibilities in `World.advance()` enough to
select a collision broad phase without changing unrelated interactions.

Integration approach:

1. Advance ball positions.
2. Ensure the tree bounds match the current canvas/world bounds.
3. Rebuild the tree from the current ball positions.
4. Enumerate candidate pairs and perform the exact circle intersection test.
5. Apply existing collision response only to intersecting pairs.
6. Apply exact ball-to-ball gravity separately as the initial reference path.
7. Continue particle, planet, wall, death, and explosion processing.

The precise ordering should be locked down with controlled integration tests
before changing it, because `Ball.collide()` mutates both bodies.

Required safeguards:

- A body rejected by the tree must use an explicit fallback path or fail
  loudly; it must not disappear from collision processing.
- Collision candidates must not be processed twice.
- The tree may become stale as collision response separates bodies, but it
  must not miss pairs overlapping at broad-phase construction time.
- Quadtree mode and brute-force mode should remain selectable for differential
  testing until integration is proven.

Acceptance criteria:

- Controlled two-ball and boundary-crossing collisions match brute force.
- Seeded initial layouts produce the same set of initial intersecting pairs.
- Positions and velocities remain finite.
- Existing collision, explosion, dragging, and gravity behavior remains
  available.
- `World.draw()` does not rebuild the tree.

## Phase 5: Separate and Repair Debug Visualization

Move tree drawing into `World` or a dedicated visualization helper.

The visualization should:

- Draw the bounds of the tree built during the latest physics frame.
- Use the actual world-to-canvas scale on both axes.
- Avoid constructing marker `Ball` objects or loading images.
- Preserve normal ball colors and Pizza Time rendering.
- Avoid changing collision or gravity behavior merely because the overlay is
  visible.
- Make the distinction between "use quadtree collisions" and "show quadtree
  overlay" explicit in code, even if one UI control initially toggles both.

Acceptance criteria:

- Enabling the overlay does not change ball count, physics mode, or ball
  rendering.
- Wide and tall canvas layouts show correct, unclipped tree bounds.
- Repeated overlay drawing performs no network requests.

## Phase 6: High-Scale Physics and Data Path

Once collision broad-phase behavior is correct, profile the complete frame at
the scale tiers above. Address the next limiting subsystem based on evidence
rather than assuming collision lookup is the only bottleneck.

### Gravity

Exact all-pairs gravity is useful as an oracle on small deterministic scenes,
but it remains quadratic even after collision broad-phase optimization.

Evaluate Barnes–Hut or another hierarchical approximation:

- Store aggregate mass and center of mass per tree node.
- Expose an explicit approximation parameter and accuracy benchmark.
- Compare approximate accelerations against exact gravity on seeded scenes.
- Define acceptable force error before using the approximation by default.
- Handle zero distance and gravitational softening deliberately.

### Particles

Remove the unconditional `balls × particles` interaction path at scale:

- Determine whether particles share the main spatial index or use a simpler
  dedicated index.
- Query only nearby particles for collision work.
- Decide whether particle gravity is required at high scale or can use a
  reduced/approximate model.
- Benchmark particle populations proportional to the body population rather
  than treating 300 particles as a permanent maximum.

### Data layout and allocation

Profile before changing representation, then consider:

- Eliminating temporary vector allocation inside pair loops.
- Reusing candidate buffers and node storage.
- Object pooling or structure-of-arrays/typed-array storage.
- Separating stable identity/rendering metadata from hot physics state.

Do not perform a data-oriented rewrite unless profiling shows object and
garbage-collection overhead is material.

### Rendering

At high scale, drawing may dominate physics:

- Measure Canvas 2D submission and rasterization independently.
- Add viewport culling and size-based level of detail where visually
  acceptable.
- Evaluate batched Canvas drawing versus WebGL only when measurements justify
  the complexity.
- Ensure benchmark claims include rendering rather than reporting physics-only
  throughput as full-frame performance.

### Threading

If the physics path meets its CPU budget but blocks input or rendering,
evaluate a Web Worker with a clear state-transfer strategy. Prefer transferable
or shared buffers and double-buffered snapshots over cloning thousands of
objects every frame.

Acceptance criteria:

- An explicit target count, density, device class, and frame budget is recorded
  from benchmark results.
- Production high-scale paths contain no unconditional all-pairs gravity or
  ball-by-particle loop.
- Approximate gravity has measured and documented error bounds.
- Physics, rendering, and transfer/allocation costs each fit their assigned
  portion of the target frame budget.
- The legacy 300–400 body scene remains behaviorally correct.

## Phase 7: Browser Benchmark and End-to-End Coverage

Add an optional Playwright-driven benchmark after physics integration.

Proposed command:

```bash
npm run bench:browser
```

Use deterministic, configurable frame samples (60 recorded frames after 20
warmup frames by default, with 300-frame runs available for longer profiling)
and report:

- Median and p95 frame duration.
- Frames exceeding 16.7 ms and 33.3 ms.
- Physics, tree build/query, and rendering durations where measurable.
- Ball, particle, candidate-pair, and true-collision counts.

Representative loads:

- 400 balls as the legacy regression scene.
- 1,000, 5,000, and 10,000 balls.
- The agreed higher target tier where the reference browser can complete it.
- Particle populations at fixed and proportional ratios.
- A clustered explosion-style scene.
- Brute-force versus quadtree collision modes.
- Exact versus approximate gravity modes where supported.
- Overlay disabled versus enabled.

Extend Playwright behavior tests to:

- Create balls through the UI.
- Toggle quadtree collision mode and its overlay.
- Assert that the page produces no runtime errors.
- Verify that balls remain present after toggling.
- Exercise wide and tall viewport sizes.

Timing results should be informational rather than hard CI gates. Correctness
failures should remain hard failures.

## Phase 8: Relevant Adjacent Hardening

Handle these separately so they do not obscure quadtree correctness:

- Restrict collision jitter to truly coincident centers and make the fallback
  deterministic where practical.
- Restore the missing particle/planet intersection guard.
- Replace or correct the legacy adaptive population governor so it does not
  silently force the simulation back toward the old 300/400 range.
- Decide whether the quadtree button should remain an A/B physics switch after
  the implementation is proven.

Each adjacent fix should have a focused test and its own commit.

## Validation Matrix

Before the branch is considered complete:

```bash
npm run test:unit
npm test
npm run build
npm run bench:quadtree
npm run bench:browser
```

Manual validation:

- Create, drag, release, and collide balls.
- Generate explosion fragments and allow the population to grow.
- Compare brute-force and quadtree modes.
- Toggle the overlay repeatedly.
- Test wide, tall, and resized windows.
- Exercise Pause, Reset, Pizza Time, Planet, Ball, Purple, and Debug controls.
- Watch for browser console errors, `NaN` state, missing bodies, and long-frame
  spikes.

## Suggested Commit Sequence

Keep every commit buildable and testable:

1. `Add deterministic quadtree benchmark harness`
2. `Define quadtree behavior with unit tests`
3. `Refactor quadtree into a pure spatial index`
4. `Use quadtree for ball collision broad phase`
5. `Separate quadtree debug visualization`
6. `Add scalable hierarchical gravity`
7. `Index high-scale particle interactions`
8. Evidence-driven rendering, allocation, or worker changes
9. `Add browser performance benchmark and coverage`
10. Focused adjacent fixes, each in its own commit
11. `Document completed quadtree behavior and benchmarks`

## Completion Criteria

The branch is complete when:

- Quadtree and brute-force collision detection agree on all deterministic
  correctness scenarios.
- No indexed body is missing or duplicated.
- Degenerate inputs terminate safely.
- The tree is rebuilt once per physics frame and reused for visualization.
- Gravity remains behaviorally correct.
- Existing automated tests and the production build pass.
- The benchmark demonstrates a clear improvement over the recorded current
  tree baseline on the same machine.
- The supported population, density, device class, and frame-rate target are
  explicit and demonstrated by the browser benchmark.
- The production path is not capped by an avoidable quadratic gravity or
  particle loop.
- Physics-only scaling claims are not presented as full-frame limits without
  rendering measurements.
- The UI no longer needs to label the completed collision implementation as
  WIP.
