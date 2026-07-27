# Quadtree Benchmarks

The quadtree benchmark provides deterministic correctness checks and
informational performance measurements. It runs directly in Node and does not
start Vite or a browser.

## Commands

Run the legacy baseline through 800 objects:

```bash
npm run bench:quadtree
```

Include the extended current-implementation case:

```bash
npm run bench:quadtree:full
```

Exercise the high-scale tiers from 1,000 through 100,000 objects:

```bash
npm run bench:quadtree:scale
```

Measure the production animation loop in isolated headless Chromium:

```bash
npm run bench:browser
```

Select the Canvas2D reference renderer or the WebGL2 prototype explicitly:

```bash
npm run bench:browser -- --busy --renderer canvas2d
npm run bench:browser -- --busy --renderer webgl2
```

Headless machines without GPU access can opt into Chromium's software WebGL
implementation:

```bash
npm run bench:browser -- \
  --busy \
  --renderer webgl2 \
  --software-webgl
```

Software-WebGL results are useful for functional and architectural comparisons,
but they are not measurements of hardware-GPU throughput. The report prints the
actual graphics implementation so captured results retain that distinction.

The benchmark starts a temporary Vite server in `headless` mode and closes it
afterward. It does not open the benchmark URL in your system browser; fixtures
are injected only into the Playwright-controlled Chromium page.

The browser benchmark covers spatial physics at 400, 1,000, 5,000, and 10,000
bodies; exact physics at 400 and 1,000; overlay cost at 1,000; and a
1,000-body plus 1,000-particle scene. It records 60 frames after 20 warmup
frames by default.

The browser benchmark uses the production Fast gravity mode by default:
ball-only Barnes-Hut gravity at theta 0.7, with particle collisions retained
and mutual ball-particle gravity disabled. Use the exploratory 25,000-body case,
select Full gravity, or override theta explicitly:

```bash
npm run bench:browser -- --full
npm run bench:browser -- --full-gravity
npm run bench:browser -- --theta 0.6
```

Select the production optimized gravity traversal or its retained reference
implementation explicitly:

```bash
npm run bench:browser -- --busy --gravity-implementation optimized
npm run bench:browser -- --busy --gravity-implementation reference
```

The full-frame report separates quadtree construction, mass aggregation, and
gravity traversal. Its JSON output also contains a per-frame workload trace and
a final position/velocity checksum. Those values should match across an A/B
pair before treating a timing difference as a valid optimization.

Measure gravity without rendering, collisions, lifecycle work, or the
production animation loop:

```bash
npm run bench:gravity
```

The gravity benchmark uses seeded, stationary fixtures and runs the reference
and optimized implementations as adjacent pairs with balanced ordering. Every
recorded iteration resets velocity outside the timed region, rebuilds the
production quadtree, aggregates its mass, and applies gravity to every body.
It reports build, mass-aggregation, traversal, and combined times separately,
along with applied sources and nanoseconds per source.

Exercise the explosion-shaped distribution beyond the app's current 10,000
ball cap:

```bash
npm run bench:gravity -- \
  --scenario busy \
  --sizes 10000,25000,50000 \
  --samples 30 \
  --warmup 10
```

Structural diagnostics sample tree visits outside the timed region. An exact
force oracle also runs outside the timed region through 1,000 bodies by
default. Select one implementation, change the oracle limit, or emit JSON with:

```bash
npm run bench:gravity -- --implementation reference
npm run bench:gravity -- --oracle-limit 2000
npm run bench:gravity -- --json > /tmp/gravity-results.json
```

Allocation sampling is deliberately a separate diagnostic mode because the V8
profiler perturbs timings:

```bash
npm run bench:gravity -- \
  --scenario busy \
  --sizes 10000 \
  --samples 10 \
  --warmup 3 \
  --profile-allocations
```

Reproduce an explosion-heavy frame shaped like the live 6,600-ball plus
10,000-particle workload:

```bash
npm run bench:browser -- --stress
```

The stress fixture is clustered and deliberately keeps some particles
straddling the canvas boundary. This exercises the rejected-body fallback that
the sparse grid does not. Use fewer samples for a quick local diagnosis:

```bash
npm run bench:browser -- --stress --samples 10 --warmup 3
```

Run the active busy-scene fixture:

```bash
npm run bench:browser -- --busy
```

Unlike `--stress`, which is a paused and stable regression fixture, `--busy`
keeps bodies moving and combines clustered positions, mixed ball radii, and a
large off-canvas particle population. It defaults to 10,000 balls and 10,000
particles in a 1536 × 1280 viewport. Active benchmark fixtures use a seeded
random stream and a fixed 16.67 ms simulation step, so renderer comparisons
evolve the same physics state even when their real frame rates differ. Override
the simulation step with `--simulation-frame-ms`. Match a captured live
population with:

```bash
npm run bench:browser -- \
  --busy \
  --busy-balls 4000 \
  --busy-particles 10600 \
  --samples 10 \
  --warmup 3
```

Busy bodies are invincible and particles have long lifetimes. That keeps the
fixture deterministic enough for comparisons while retaining movement,
collision response, mixed-radius density, and off-canvas indexing. Explosion
creation/removal churn is reported separately by the per-frame lifecycle
telemetry and remains a distinct workload to profile.

Exercise a repeated explosion/removal wave:

```bash
npm run bench:browser -- --churn --samples 10 --warmup 3
```

The churn fixture starts from the busy layout, then repeatedly marks 75% of
the balls and 50% of the particles for replacement. This deliberately
measures capacity-limited fragment generation, bulk removal, particle
compaction, dense collision response, and the resulting rendering load.
`--busy-balls` and `--busy-particles` also override its starting population.

The benchmark reports separate tree-build, gravity mass-aggregation, gravity
traversal, collision, lifecycle, and render timings. WebGL2 results additionally
break rendering into body packing, buffer upload, and draw submission. It also
reports spatial candidates, fallback candidates, true collision hits, rejected
bodies, Barnes-Hut source counts, removed bodies, and generated fragments.

Measure renderer scaling without physics or the production animation loop:

```bash
npm run bench:render
```

This frozen-scene benchmark runs both backends at 10,000, 25,000, 50,000, and
100,000 visible bodies by default. It measures main-thread renderer submission
and, for WebGL2, a separate synchronized result that waits for `gl.finish()`.
Exercise per-frame position and color changes with:

```bash
npm run bench:render -- --churn
```

Select sizes, a backend, or software WebGL explicitly:

```bash
npm run bench:render -- \
  --renderer webgl2 \
  --sizes 10000,50000,100000 \
  --software-webgl
```

Compare the production Fast and Full modes on the identical fixture:

```bash
npm run bench:browser -- --stress
npm run bench:browser -- --stress --full-gravity
```

Fast matches the app's default `Gravity: Fast` button state. Full enables
mutual ball-particle gravity and uses theta 0.5 unless `--theta` explicitly
overrides it.

The scale command predicts a conservative quadratic upper bound from the
previous completed build size. It skips a larger case when that prediction
exceeds the per-case time budget. Candidate traversal is independently skipped
when its structural pair count exceeds 20 million by default. These controls
prevent pathological cases from turning the benchmark harness into the
bottleneck while still reporting tree structure and candidate counts.

Use `--force` to disable skipping:

```bash
npm run bench:quadtree:scale -- --force
```

Change the candidate traversal limit independently:

```bash
npm run bench:quadtree:scale -- --max-candidates 1000000
```

Show every option:

```bash
npm run bench:quadtree -- --help
```

## Scenarios

- `grid`: a perfectly regular sparse grid that deliberately exposes alignment
  with recursive split boundaries.
- `jittered`: a seeded, slightly irregular sparse grid used as a representative
  sparse control.
- `uniform`: seeded random positions and radii.
- `clustered`: explosion-like spatial hotspots.
- `boundary`: circles crossing the main subdivision lines.
- `mixed`: small circles plus a small population of much larger circles.
- `coincident`: many circles at the same center.
- `moving`: deterministic snapshots of moving and wall-bouncing circles.

Select scenarios or sizes explicitly:

```bash
npm run bench:quadtree -- --scenario uniform,clustered --sizes 400,1000,5000
```

## Output

Human-readable timings are printed as `median/p95` milliseconds. The report
includes:

- Brute-force exact-intersection time where the oracle size permits it.
- Tree construction and recursive retrieval time.
- Candidate enumeration and exact-filter time.
- Structural statistics such as node count, depth, and maximum local objects.
- Correctness status for object storage and candidate pairs.

The benchmark compares the candidate traversal's exact intersection set with
brute force through the configured oracle limit and exits unsuccessfully on
missed or duplicate pairs.

Structured output is available for before/after comparisons:

```bash
npm run bench:quadtree -- --json > /tmp/quadtree-baseline.json
```

JSON metadata includes the Git commit, dirty-worktree state, Node version,
platform, and CPU model.

## Interpreting Results

- Correctness failures are hard failures.
- Timings are informational and should be compared on the same machine.
- Fixture generation, reporting, and structural validation occur outside the
  timed region.
- Fast operations are automatically batched to reduce timer-resolution noise.
- The runtime is warmed before samples are recorded.
- Brute force and pair-set materialization are intentionally skipped above the
  configured oracle limit.
- Above the candidate timing limit, the implementation reports the structural
  candidate count without invoking every callback.
- Sparse scaling results do not imply that fully overlapping scenes are cheap;
  resolving a genuinely quadratic number of collisions remains quadratic.

Do not add universal timing thresholds to CI. The browser benchmark measures
full-frame behavior separately from this algorithm benchmark. The captured
reference-machine results are documented in `BROWSER_BASELINE.md`.
