# Benchmark result

## Environment
- Browser: Chromium 156.0.8078.4
- OS: Windows_NT 10.0.26300
- GPU: ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver) [Software Renderer] (driver SwiftShader)
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
| webgl2 | 100 | 1.5790304752881659 (1.5001500150015035–1.6217969510217551, n=100) | n/a |
| webgpu | n/a | n/a | n/a |

## Limitations
- Compute on WebGL2 runs through transform feedback, not a native compute shader.
- WebGL2 is measured before WebGPU in the same page; backend order is not counterbalanced.
- navigator.gpu.requestAdapter() returned null; no WebGPU adapter was available to this run. Physical WebGPU execution is BLOCKED.
