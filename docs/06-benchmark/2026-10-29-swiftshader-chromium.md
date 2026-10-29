# Benchmark result

## Environment
- Browser: Chromium 156.0.8078.4
- OS: Windows_NT 10.0.26300
- GPU: ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver) [Software Renderer] (driver SwiftShader)
- Commit: 07f217d
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
| webgl2 | 100 | 2.553300140431498 (1.9357336430507217–2.727768685215491, n=100) | n/a |
| webgpu | n/a | n/a | n/a |

## Limitations
- Compute on WebGL2 runs through transform feedback, not a native compute shader.
- WebGL2 is measured before WebGPU in the same page; backend order is not counterbalanced.
- navigator.gpu.requestAdapter() returned null; no WebGPU adapter was available to this run. Physical WebGPU execution is BLOCKED.
