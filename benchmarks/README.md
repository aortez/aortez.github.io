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
particles in a 1536 × 1280 viewport. Match a captured live population with:

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

The benchmark reports separate tree-build, gravity, collision, lifecycle, and
render timings. It also reports spatial candidates, fallback candidates, true
collision hits, rejected bodies, Barnes-Hut source counts, removed bodies,
and generated fragments.

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
