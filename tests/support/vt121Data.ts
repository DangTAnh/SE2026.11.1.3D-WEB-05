import { cloneConfig, DEFAULT_CONFIG, type PresetDocument } from '../../src/presets/preset.ts';
export const makeDocument = (name?: string): PresetDocument => ({ schemaVersion: 2, app: '3D-WEB-05', ...(name === undefined ? {} : {name}), config: cloneConfig(DEFAULT_CONFIG) });
export const A = makeDocument('A'); A.config.mode = 'vortex'; A.config.simulation.speed = 2.2; A.config.camera.distance = 45;
export const B = makeDocument('B'); B.config.simulation.speed = 3; B.config.rendering.particleColor = '#abcdef'; B.config.modes.vortex.vortexStrength = 4;
export const json = (value: unknown): string => JSON.stringify(value);
export function candidate(path: string, value: unknown): PresetDocument {
  const doc = makeDocument(); let node = doc as unknown as Record<string, unknown>;
  const keys = path.split('.'); const last = keys.pop()!;
  for (const key of keys) node = node[key] as Record<string, unknown>;
  node[last] = value; return doc;
}
// Explicit expected values from preset-schema-v2.schema.json, not controller logic.
export const boundaries: Array<[string, string, number, boolean]> = [];
function cases(id: string, path: string, data: Array<[number,boolean]>) { for (const [value, accepted] of data) boundaries.push([id,path,value,accepted]); }
cases('B1','config.simulation.particleCount',[[999,false],[1000,true],[1001,true],[1500,true],[65536,true],[499999,true],[500000,true],[500001,false],[1000.5,false]]);
cases('B2','config.simulation.speed',[[.099,false],[.1,true],[.101,true],[2.999,true],[3,true],[3.001,false],[1.0001,false]]);
cases('B3','config.simulation.particleSize',[[.999,false],[1,true],[1.001,true],[7.999,true],[8,true],[8.001,false],[2.5001,false]]);
for(const [id,path] of [['B4','config.modes.attractor.attractorStrength'],['B5','config.modes.vortex.vortexStrength']]) cases(id,path,[[.199,false],[.2,true],[.201,true],[3.999,true],[4,true],[4.001,false],[1.5001,false]]);
