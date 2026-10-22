# WebGL2 simulation strategy — evidence

Status: **evidence only.** The decision belongs to TV2 + TV3
([`05-management/team-ownership.md`](../05-management/team-ownership.md) §7,
item 1). Nothing here is implemented.

Question: the particle simulation must run on the GPU. Given the one-adapter,
`forceWebGL` decision ([`architecture.md`](../architecture.md) §4), what runs
the particle step on the WebGL2 backend?

## 1. What `three@0.186.1` actually does

Read from the published build `three@0.186.1/build/three.webgpu.js` (the
package is not a dependency of this repository; the file was inspected directly
from the npm tarball):

- `WebGLBackend.createComputePipeline()` compiles the TSL compute node as a
  **vertex shader**, attaches a no-op fragment shader, and declares its outputs
  with `gl.transformFeedbackVaryings(..., SEPARATE_ATTRIBS)` — lines
  75732–75775.
- `WebGLBackend.compute()` enables `gl.RASTERIZER_DISCARD`, binds a
  transform-feedback object and calls `gl.beginTransformFeedback(gl.POINTS)` —
  line 74913 onward.
- `WebGLBackend.beginCompute()` opens a `TimestampQuery.COMPUTE` query, so
  compute timing has a WebGL2 path as well.

Consequence: a TSL `Fn(...).compute(count)` runs natively on WebGPU and through
transform feedback on WebGL2, from **one** source. No second copy of the
simulation rules is required.

## 2. Constraints visible in the same file

- Indirect dispatch is unsupported: `count` must be a single number. An array
  hits `warnOnce('WebGLBackend.compute(): The count parameter must be a single
  number, not an array.')` inside `compute()`.
- Transform feedback writes one varying per invocation. Element-wise update
  (`storageBuffer.element(i).assign(...)`) maps directly onto it; scatter writes
  to arbitrary indices and atomics do not.
- "Compute" on WebGL2 is vertex-stage work with fragment output discarded, not
  a native compute shader. Reports must say so.

## 3. Options

| Option | Fits the one-adapter decision | Duplicates the rules | Verdict |
|---|---|---|---|
| TSL compute node, same source for both backends | Yes | No | Preferred: three already maps it to transform feedback |
| Ping-pong render targets + fragment shader (`GPUComputationRenderer` pattern) | Only with a separate material tree | Yes | Fallback if the state update needs scatter or atomics |
| Raw WebGL2 transform feedback outside three | No — bypasses the adapter | Yes | Rejected |
| CPU stepping | No — the premise is GPU simulation | Yes | Rejected |

## 4. What TV2 and TV3 must confirm

1. Particle state is updated element-wise — no scatter writes, no atomics. If it
   is not, the TSL compute path is insufficient and option 2 returns.
2. `count` is the fixed particle count per step, never indirect.
3. `gpuTimingAvailable` on WebGL2: whether `TimestampQuery.COMPUTE` works under
   `EXT_disjoint_timer_query_webgl2`, or must be reported as false.

Until 1–3 are answered, do not write a second stepping path.
