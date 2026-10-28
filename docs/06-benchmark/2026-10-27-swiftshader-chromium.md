# Benchmark result

## Environment
- Browser: Chromium 156.0.8078.4
- OS: Windows_NT 10.0.26300
- GPU: ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver) [Software Renderer] (driver SwiftShader)
- Commit: 6ec98a3
- Same host for both backends: yes

## Configuration
- configHash: 2a8003e259733173be6147385046b28a0a9d124bfe2a16ad63412e2348305a33
- Preset JSON: `{"mode":"attractor","backendPreference":"auto","particleCount":20000,"speed":1.2,"spawnRadius":10,"lifetime":6,"particleSize":2.5,"particleColor":"#6ce6ff","strength":1.5,"vortexDamping":0.99}`
- Mode / particleCount: attractor / 20000
- warm-up: 3
- sample count: 100
- duration: 10

## Runs
| actual backend | samples | fps median (min–max) | gpuTimeMs median (min–max) |
|---|---|---|---|
| webgl2 | 100 | 3.5830953374193797 (3.000300030003007–4.186435947530001, n=100) | n/a |
| webgpu | n/a | n/a | n/a |

## Limitations
- This session ran in headless Chromium. In that context `navigator.gpu.requestAdapter()` returned null, so no WebGPU adapter was available; physical WebGPU execution is BLOCKED for headless runs.
- Headed Chromium on the same host does expose a WebGPU adapter; the two-backend headed run is recorded in `2026-10-28-amd-radeon-chromium-headed.md`.
- Compute on WebGL2 runs through transform feedback, not a native compute shader.
