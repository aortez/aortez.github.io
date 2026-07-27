# Legacy Quadtree Baseline

Captured on 2026-07-25 before modifying `src/scripts/quadtree.js`.

## Environment

- Git commit: `052e4e179bb8d7da3c1482d989a359d949fe4c92`
- Branch: `quadtree-complete`
- Node: `v24.11.1`
- CPU: AMD Ryzen 7 9800X3D 8-Core Processor
- Command: `npm run bench:quadtree`

The worktree was dirty because the benchmark harness and pre-existing local
changes were present. The quadtree implementation itself still matched the
commit above.

## Construction Results

Median build time in milliseconds:

| Scenario | 400 bodies | 800 bodies |
|---|---:|---:|
| Grid | 15.830 | 48.496 |
| Uniform | 12.135 | 53.377 |
| Clustered | 15.023 | 72.548 |
| Boundary straddlers | 0.100 | 0.204 |
| Mixed radii | 13.632 | 61.403 |
| Coincident centers | 16.353 | 62.397 |
| Moving snapshots | 13.102 | 52.843 |

For comparison, the exact brute-force intersection scan at 800 bodies took
roughly 0.3–0.5 ms in these synthetic scenarios. The current tree therefore
cost substantially more to construct than the brute-force collision predicate
cost at the legacy population.

The main known cause is eager debug work: insertion and splitting construct
messages and serialize subtrees before the disabled debug function returns.

## Correctness Finding

The benchmark exited unsuccessfully for the moving 800-body scenario:

```text
1 object(s) were rejected by the root bounds
stored 799 object(s), expected 800
missing object IDs: 142
```

The body had bounced to a position exactly tangent to a right or bottom root
edge. The current `fitsInside()` implementation accepts minimum edges but uses
strict comparisons for maximum edges, silently dropping the tangent body from
the tree.

This is intentionally retained as a hard benchmark failure until the boundary
contract is corrected.

## High-Scale Probe

Command:

```bash
npm run bench:quadtree:scale -- \
  --scenario grid,boundary \
  --samples 3 \
  --sample-ms 5 \
  --max-case-ms 200
```

Results:

- A 1,000-body grid took 145.933 ms to build.
- Larger grid cases were predictively skipped.
- The boundary scenario reached 100,000 bodies in 41.858 ms because every
  body stayed in the root after the first split.
- That boundary tree had 100,000 local objects and would still expose nearly
  five billion possible pairs. Cheap construction alone is not evidence of an
  effective broad phase.

## Missing Baseline Metrics

The legacy tree has no candidate-pair traversal. Candidate count, exact-filter
time, reduction ratio, duplicate detection, and brute-force pair equivalence
will become available after that API is implemented.

## Post-Refactor Comparison

The final center-indexed, radius-aware tree was measured on the same machine.
At legacy sizes, median construction fell from roughly 12–16 ms at 400 bodies
to 0.030–0.052 ms, depending on the scenario. At 800 bodies it fell from
48–72 ms to 0.073–0.117 ms.

The first candidate implementation retained split-crossing bodies in parent
nodes. High-scale measurement showed that construction alone was not enough:

| Deterministic fixture | Parent-straddler candidates | Center-indexed candidates |
|---|---:|---:|
| Uniform, 50,000 | 13,191,448 | 311,130 |
| Uniform, 100,000 | 33,525,612 | 601,772 |
| Regular grid, 100,000 | 74,713,824 | 554,903 |

That evidence caused the implementation to switch to center-indexed leaves.
Each subtree records its maximum body radius, and traversal only visits leaf
pairs whose bounds can be close enough to overlap. The exact intersection set
continues to match brute force in the correctness oracle.

The boundary and coincident fixtures intentionally remain quadratic at high
counts. One third of the boundary fixture is concentrated around the crossing
of both main split lines, so many of those bodies genuinely overlap. This is a
collision-density limit, not false-positive amplification by the index.
