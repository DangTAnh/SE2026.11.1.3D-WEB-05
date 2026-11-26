# Benchmark result

## Environment
- Browser: Chromium 156.0.8078.4
- OS: Microsoft Windows 11 Home Single Language (10.0.26300, build 26300)
- GPU: ANGLE (AMD, AMD Radeon(TM) Graphics (0x00001681) Direct3D11 vs_5_0 ps_5_0, D3D11); WebGPU adapter amd/rdna-2 (driver AMD Radeon(TM) Graphics 31.0.21024.2004 (Win32_VideoController))
- Commit: d22de971f8d058d1a020b3558f9467696078a974
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
| webgl2 | 100 | 59.91013539511138 (59.880239520958085–59.94005994005994, n=100) | 0.11836 (0.10352–0.4984, n=100) |
| webgpu | 100 | 59.91611743559009 (59.880239520958085–59.94005994005994, n=100) | 0.131072 (0.065536–0.196608, n=100) |

## Limitations
- Observed pair execution order: webgl2 then webgpu; each backend uses a new canvas/adapter and explicit reset.
- Paired campaign also records the reverse order on the same host/build; this file is one pair, not pooled results.
- WebGL2 compute uses transform feedback; WebGPU uses the same shared kernels.
- Only backendPreference changes to force each actual backend; workload, rendering, camera, viewport and protocol are otherwise identical.
- Refresh-bound FPS and one paired campaign establish no backend speed advantage or general hardware capacity.
- GPU timing is adapter-reported; query-error tests, numerical parity, device-loss acceptance and deployment are separate evidence.
