/**
 * Composition root contract, driven by the reusable fake port.
 *
 * #15 requires the renderer to be initialized before the UI reads its status,
 * and requires an unavailable or failing init to reach the UI as the
 * unsupported screen instead of an exception.
 */
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { composeLab } from '../../src/composition.ts';
import type { RendererPort, RendererTarget } from '../../src/core/renderer/RendererPort.ts';
import type { ActualBackend } from '../../src/core/types/backend.ts';
import { FakeRenderer } from '../support/fakeRenderer.ts';

const TARGET: RendererTarget = { width: 800, height: 600, pixelRatio: 1 };

class FailingInitRenderer extends FakeRenderer {
  override async init(): Promise<ActualBackend> {
    throw new Error('no backend adapter');
  }
}

test('composition: init runs with the target before the UI mounts', async () => {
  const port = new FakeRenderer({ actual: 'webgpu' });
  let callsAtMount: string[] = [];

  const dispose = await composeLab({
    createPort: () => port,
    createTarget: () => TARGET,
    mountUI: (mounted) => {
      assert.equal(mounted, port);
      callsAtMount = mounted.calls.map((call) => call.type);
      return () => {};
    },
  });

  assert.deepEqual(callsAtMount, ['init']);
  assert.deepEqual(port.calls[0], { type: 'init', target: TARGET });
  assert.equal(typeof dispose, 'function');
});

test('composition: an unavailable backend still mounts the UI', async () => {
  const port = new FakeRenderer({ actual: 'unavailable' });
  let mounted = false;

  await composeLab({
    createPort: () => port,
    createTarget: () => TARGET,
    mountUI: () => {
      mounted = true;
      return () => {};
    },
  });

  assert.equal(mounted, true);
});

test('composition: a rejecting init does not reject or skip mounting', async () => {
  const port = new FailingInitRenderer({ actual: 'unavailable' });
  let mounted = false;

  await composeLab({
    createPort: () => port,
    createTarget: () => TARGET,
    mountUI: () => {
      mounted = true;
      return () => {};
    },
  });

  assert.equal(mounted, true);
});

test('composition: returned disposer tears down UI and port exactly once', async () => {
  const fake = new FakeRenderer({ actual: 'unavailable' });
  const port: RendererPort = fake;
  let uiDisposals = 0;
  const uiDispose = (): void => {
    uiDisposals += 1;
  };

  const dispose = await composeLab({
    createPort: () => port,
    createTarget: () => TARGET,
    mountUI: () => uiDispose,
  });

  assert.notEqual(dispose, uiDispose);
  dispose();
  dispose();
  assert.equal(uiDisposals, 1);
  assert.equal(fake.calls.filter((call) => call.type === 'dispose').length, 1);
});
