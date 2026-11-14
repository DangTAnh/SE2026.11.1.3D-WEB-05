import type { ActualBackend, BackendPreference } from '../../core/types/backend.ts';

export interface BackendFactories<T> {
  readonly webgpu: () => Promise<InitializedBackend<T>>;
  readonly webgl2: () => Promise<InitializedBackend<T>>;
}

export interface InitializedBackend<T> {
  readonly actual: Exclude<ActualBackend, 'unavailable'>;
  readonly instance: T;
}

export type StartedBackend<T> = InitializedBackend<T> | { readonly actual: 'unavailable'; readonly instance: null };

/** Expected failure to initialize a backend; programming errors should propagate. */
export class BackendUnavailableError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'BackendUnavailableError';
  }
}

/** Start the requested backend, falling back to WebGL2 without losing the user's preference. */
export async function startBackend<T>(
  preference: BackendPreference,
  factories: BackendFactories<T>,
): Promise<StartedBackend<T>> {
  if (preference !== 'webgl2') {
    try {
      return await factories.webgpu();
    } catch (error) {
      if (!(error instanceof BackendUnavailableError)) throw error;
      // A failed device/renderer initialization is a normal fallback path.
    }
  }

  try {
    return await factories.webgl2();
  } catch (error) {
    if (!(error instanceof BackendUnavailableError)) throw error;
    return { actual: 'unavailable', instance: null };
  }
}
