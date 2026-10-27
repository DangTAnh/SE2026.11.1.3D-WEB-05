# Benchmark result

## Environment
- Browser: Chromium 156.0.8078.4
- OS: Windows 10 Home (NT 10.0.26300)
- GPU: NVIDIA GeForce GTX 1650 (driver 32.0.16.1088)
- Commit: 7fc03c9
- Same host for both backends: yes

## Configuration
- configHash: 2a8003e259733173be6147385046b28a0a9d124bfe2a16ad63412e2348305a33
- Preset JSON: `{"mode":"attractor","backendPreference":"auto","particleCount":20000,"speed":1.2,"spawnRadius":10,"lifetime":6,"particleSize":2.5,"particleColor":"#6ce6ff","strength":1.5,"vortexDamping":0.99}`
- warm-up: 3
- sample count: 100
- duration: 10

## Runs
| actual backend | samples | fps median (min–max) | gpuTimeMs median (min–max) |
|---|---|---|---|
| webgl2 | 100 | 4.285714285714286 (3.999200159968018–4.391100702576107, n=100) | n/a |

## Limitations
- Compute on WebGL2 runs through transform feedback, not a native compute shader.
- WebGPU is unavailable in this Chromium environment (navigator.gpu.requestAdapter() returned null). Physical WebGPU execution is BLOCKED; the requested webgpu run fell back to webgl2 and was not substituted.
