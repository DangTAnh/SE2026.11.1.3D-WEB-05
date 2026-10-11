import Ajv2020 from 'ajv/dist/2020.js';
import type { ErrorObject } from 'ajv';
import presetSchema from '../../docs/02-design/preset-schema-v1.schema.json';

/** Hợp đồng cấu hình đề xuất bởi TV4; cần TV1/TV2/TV3 review trước khi tích hợp engine. */
export type SimulationMode = 'attractor' | 'vortex';
export type BackendPreference = 'auto' | 'webgpu' | 'webgl2';

export interface LabConfig {
  mode: SimulationMode;
  backendPreference: BackendPreference;
  particleCount: number;
  speed: number;
  particleSize: number;
  particleColor: string;
  strength: number;
}

export interface LabPreset {
  schemaVersion: 1;
  app: '3D-WEB-05';
  config: LabConfig;
}

export const DEFAULT_CONFIG: Readonly<LabConfig> = Object.freeze({
  mode: 'attractor',
  backendPreference: 'auto',
  particleCount: 20000,
  speed: 1.2,
  particleSize: 2.5,
  particleColor: '#6ce6ff',
  strength: 1.5,
});

const validatePreset = new Ajv2020({ allErrors: true, strict: true }).compile<LabPreset>(presetSchema);

function errorPath(error: ErrorObject): string {
  if (error.keyword === 'required') {
    return `${error.instancePath}/${String(error.params.missingProperty)}`;
  }
  if (error.keyword === 'additionalProperties') {
    return `${error.instancePath}/${String(error.params.additionalProperty)}`;
  }
  return error.instancePath;
}

/** Giữ thông báo thân thiện trong UI, trong khi JSON Schema là nguồn validation duy nhất. */
function formatValidationError(errors: ErrorObject[] | null | undefined): string {
  if (!errors?.length) return 'Sai định dạng preset hoặc phiên bản chưa được hỗ trợ.';

  if (errors.some(error => error.keyword === 'required' || error.keyword === 'additionalProperties')) {
    return 'Preset chứa trường không được hỗ trợ hoặc thiếu trường bắt buộc.';
  }

  const paths = new Set(errors.map(errorPath));
  if (paths.has('/config/mode')) return 'Simulation mode không hợp lệ.';
  if (paths.has('/config/backendPreference')) return 'Tùy chọn backend không hợp lệ.';
  if (paths.has('/config/particleCount')) return 'Số particle phải từ 1.000 đến 50.000, theo bước 1.000.';
  if (paths.has('/config/speed')) return 'Tốc độ nằm ngoài khoảng 0.1–3.';
  if (paths.has('/config/particleSize')) return 'Kích thước particle nằm ngoài khoảng 1–8.';
  if (paths.has('/config/strength')) return 'Cường độ nằm ngoài khoảng 0.2–4.';
  if (paths.has('/config/particleColor')) return 'Màu phải ở dạng #RRGGBB.';

  return 'Sai định dạng preset hoặc phiên bản chưa được hỗ trợ.';
}

/** Chỉ nhận cấu hình hợp lệ, không tự động tin tưởng dữ liệu JSON do người dùng tải lên. */
export function parsePreset(text: string): LabConfig {
  let value: unknown;
  try {
    value = JSON.parse(text) as unknown;
  } catch {
    throw new Error('Tệp không phải JSON hợp lệ.');
  }

  if (!validatePreset(value)) throw new Error(formatValidationError(validatePreset.errors));

  return {
    mode: value.config.mode,
    backendPreference: value.config.backendPreference,
    particleCount: value.config.particleCount,
    speed: value.config.speed,
    particleSize: value.config.particleSize,
    particleColor: value.config.particleColor,
    strength: value.config.strength,
  };
}

export function serializePreset(config: LabConfig): string {
  const preset: LabPreset = { schemaVersion: 1, app: '3D-WEB-05', config: { ...config } };
  // Validate chính dữ liệu xuất ra để tránh preset hỏng khi state thay đổi ở tương lai.
  parsePreset(JSON.stringify(preset));
  return `${JSON.stringify(preset, null, 2)}\n`;
}

export function downloadPreset(config: LabConfig): void {
  const blob = new Blob([serializePreset(config)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `particle-lab-${config.mode}-preset.json`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
