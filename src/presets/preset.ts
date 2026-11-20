import Ajv2020 from 'ajv/dist/2020.js';
import type { ErrorObject } from 'ajv';
import presetSchema from '../../docs/02-design/preset-schema-v2.schema.json' with { type: 'json' };

export type SimulationMode = 'attractor' | 'vortex';
export type BackendPreference = 'auto' | 'webgpu' | 'webgl2';
export interface LabConfig {
  mode: SimulationMode;
  backendPreference: BackendPreference;
  simulation: { particleCount: number; spawnRadius: number; particleSize: number; lifetime: number; speed: number };
  modes: {
    attractor: { attractorStrength: number; attractorRadius: number; attractorDamping: number };
    vortex: { vortexStrength: number; vortexDamping: number };
  };
  rendering: { backgroundColor: string; particleColor: string; opacity: number; additiveBlend: boolean };
  camera: { enabled: boolean; autoRotate: boolean; distance: number };
}
/** Metadata belongs to the document, never to RendererPort or configHash. */
export interface PresetDocument {
  schemaVersion: 2;
  app: '3D-WEB-05';
  name?: string;
  config: LabConfig;
}
export type LabPreset = PresetDocument;

/** Frozen at every level; cloneConfig returns independent mutable defaults. */
export const DEFAULT_CONFIG: Readonly<LabConfig> = Object.freeze({
  mode: 'attractor', backendPreference: 'auto',
  simulation: Object.freeze({ particleCount: 65536, spawnRadius: 10, particleSize: 2.5, lifetime: 6, speed: 1.2 }),
  modes: Object.freeze({
    attractor: Object.freeze({ attractorStrength: 1.5, attractorRadius: 6, attractorDamping: 0.98 }),
    vortex: Object.freeze({ vortexStrength: 1.5, vortexDamping: 0.99 }),
  }),
  rendering: Object.freeze({ backgroundColor: '#07111f', particleColor: '#6ce6ff', opacity: 1, additiveBlend: false }),
  camera: Object.freeze({ enabled: true, autoRotate: false, distance: 30 }),
});
export function cloneConfig(config: Readonly<LabConfig>): LabConfig { return structuredClone(config); }

const validatePreset = new Ajv2020({ allErrors: true, strict: true, multipleOfPrecision: 8 })
  .compile<PresetDocument>(presetSchema);
function errorPath(error: ErrorObject): string {
  if (error.keyword === 'required') return `${error.instancePath}/${String(error.params.missingProperty)}`;
  if (error.keyword === 'additionalProperties') return `${error.instancePath}/${String(error.params.additionalProperty)}`;
  return error.instancePath;
}
function validationError(errors: ErrorObject[] | null | undefined): string {
  if (errors?.some(e => e.keyword === 'required' || e.keyword === 'additionalProperties')) {
    return 'Preset chứa trường không được hỗ trợ hoặc thiếu trường bắt buộc.';
  }
  const paths = errors?.map(errorPath) ?? [];
  if (paths.includes('/config/mode')) return 'Simulation mode không hợp lệ.';
  if (paths.includes('/config/backendPreference')) return 'Tùy chọn backend không hợp lệ.';
  if (paths.includes('/config/simulation/particleCount')) return 'Số particle phải là số nguyên từ 1.000 đến 500.000.';
  if (paths.includes('/config/simulation/speed')) return 'Tốc độ nằm ngoài khoảng 0.1–3 hoặc vượt precision 0.001.';
  if (paths.includes('/config/simulation/particleSize')) return 'Kích thước particle nằm ngoài khoảng 1–8 hoặc vượt precision 0.001.';
  if (paths.some(p => /Strength$/.test(p))) return 'Cường độ nằm ngoài khoảng 0.2–4 hoặc vượt precision 0.001.';
  if (paths.some(p => /Color$/.test(p))) return 'Màu phải ở dạng #RRGGBB.';
  return `Sai định dạng preset v2: ${paths.join(', ')} (kiểm tra range và precision 0.001).`;
}
function assertDocument(value: unknown): asserts value is PresetDocument {
  if (typeof value === 'object' && value !== null && 'schemaVersion' in value && value.schemaVersion === 1) {
    throw new Error('Preset v1 không được hỗ trợ. Vui lòng cung cấp preset schemaVersion: 2; không tự động chuyển đổi.');
  }
  if (!validatePreset(value)) throw new Error(validationError(validatePreset.errors));
}
export function parsePresetDocument(text: string): PresetDocument {
  let value: unknown;
  try { value = JSON.parse(text) as unknown; }
  catch { throw new Error('Tệp không phải JSON hợp lệ.'); }
  assertDocument(value);
  return structuredClone(value);
}
/** Config-only helper for engine callers; UI uses the document API to retain name. */
export function parsePreset(text: string): LabConfig { return parsePresetDocument(text).config; }

/** Explicit ordering at every level, independent of input object insertion order. */
export function serializePresetDocument(document: PresetDocument): string {
  assertDocument(document);
  const c = document.config;
  const preset: PresetDocument = {
    schemaVersion: 2, app: '3D-WEB-05',
    ...(document.name === undefined ? {} : { name: document.name }),
    config: {
      mode: c.mode, backendPreference: c.backendPreference,
      simulation: { particleCount: c.simulation.particleCount, spawnRadius: c.simulation.spawnRadius,
        particleSize: c.simulation.particleSize, lifetime: c.simulation.lifetime, speed: c.simulation.speed },
      modes: {
        attractor: { attractorStrength: c.modes.attractor.attractorStrength,
          attractorRadius: c.modes.attractor.attractorRadius, attractorDamping: c.modes.attractor.attractorDamping },
        vortex: { vortexStrength: c.modes.vortex.vortexStrength, vortexDamping: c.modes.vortex.vortexDamping },
      },
      rendering: { backgroundColor: c.rendering.backgroundColor, particleColor: c.rendering.particleColor,
        opacity: c.rendering.opacity, additiveBlend: c.rendering.additiveBlend },
      camera: { enabled: c.camera.enabled, autoRotate: c.camera.autoRotate, distance: c.camera.distance },
    },
  };
  return `${JSON.stringify(preset, null, 2)}\n`;
}
export function serializePreset(config: LabConfig): string {
  return serializePresetDocument({ schemaVersion: 2, app: '3D-WEB-05', config });
}
export function downloadPresetDocument(preset: PresetDocument): void {
  const blob = new Blob([serializePresetDocument(preset)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `particle-lab-${preset.config.mode}-preset.json`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function downloadPreset(config: LabConfig): void {
  downloadPresetDocument({ schemaVersion: 2, app: '3D-WEB-05', config });
}
