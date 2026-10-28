# Benchmark result

## Environment
- Browser: Chromium 156.0.8078.4
- OS: Windows_NT 10.0.26300
- GPU: ANGLE (AMD, AMD Radeon(TM) Graphics (0x00001681) Direct3D11 vs_5_0 ps_5_0, D3D11) [WebGPU adapter: amd rdna-2] (driver Google Inc. (AMD); exact driver version not exposed by the browser)
- Commit: 6d8f304
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
| webgl2 | 100 | 59.91611743559009 (59.89219405070877–59.92808629644444, n=100) | n/a |
| webgpu | 100 | 59.904153354632676 (59.89219405070899–59.92808629644444, n=100) | n/a |

## Limitations
- Headed Chromium is refresh-bound at the host's ~59.9 Hz display cadence; this run shows both backends sustaining ~60 FPS at 20,000 particles, not peak throughput.
- GPU timing was unavailable on both backends; only FPS is reported.
- Compute on WebGL2 runs through transform feedback, not a native compute shader.
