# Benchmark result

## Environment
- Browser: Chromium 156.0.8078.4
- OS: Windows_NT 10.0.26300
- GPU: ANGLE (AMD, AMD Radeon(TM) Graphics (0x00001681) Direct3D11 vs_5_0 ps_5_0, D3D11) [WebGPU adapter: amd rdna-2] (driver Google Inc. (AMD); exact driver version not exposed by the browser)
- Commit: d6ee6e3
- Same host for both backends: yes

## Configuration
- configHash: 0f917cd0a56e3d7b63f53c7f1e7bb5f2cdfb70d6191454733baf204f0fc907fa
- Preset JSON: `{"mode":"attractor","backendPreference":"auto","simulation":{"particleCount":65536,"spawnRadius":10,"particleSize":2.5,"lifetime":6,"speed":1.2},"modes":{"attractor":{"attractorStrength":1.5,"attractorRadius":6,"attractorDamping":0.98},"vortex":{"vortexStrength":1.5,"vortexDamping":0.99}},"rendering":{"backgroundColor":"#07111f","particleColor":"#6ce6ff","opacity":1,"additiveBlend":false},"camera":{"enabled":true,"autoRotate":false,"distance":30}}`
- Mode / particleCount: attractor / 65536
- warm-up: 3
- sample count: 100
- duration: 10

## Runs
| actual backend | samples | fps median (min–max) | gpuTimeMs median (min–max) |
|---|---|---|---|
| webgl2 | 100 | 59.91611743559009 (59.904153354632456–59.928086296444334, n=100) | 0.13916 (0.10448–0.49956, n=100) |
| webgpu | 100 | 59.91611743559009 (59.880239520958085–59.92808629644444, n=100) | 0.131072 (0.131072–0.262144, n=100) |

## Limitations
- Compute on WebGL2 runs through transform feedback, not a native compute shader.
- WebGL2 is measured before WebGPU in the same page; backend order is not counterbalanced.
