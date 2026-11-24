import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import {
  DAWN_CMAKE_PRESET_PATH,
  fetchGhostIndex,
  getGhostAbiAssetKey,
  getSectiumDisplayAssetKey,
  getWebGpuDawnAssetKey,
  resolveDawnPlan,
  type GhostIndex,
} from '../src/index.mts';

describe('@awesome-os/dawn cas-v1 shard integration', () => {
  it('validates config/dawn-cas.cmake standalone shared-library preset flags', () => {
    const cmake = readFileSync(DAWN_CMAKE_PRESET_PATH, 'utf8');
    assert.match(cmake, /set\(BUILD_SHARED_LIBS\s+OFF\b/);
    assert.match(cmake, /set\(DAWN_BUILD_MONOLITHIC_LIBRARY\s+"SHARED"/);
    assert.match(cmake, /set\(DAWN_BUILD_SAMPLES\s+OFF\b/);
    assert.match(cmake, /set\(TINT_BUILD_TESTS\s+OFF\b/);
    assert.match(cmake, /set\(DAWN_FETCH_DEPENDENCIES\s+ON\b/);
  });

  it('computes canonical platform asset keys across win32, linux, and darwin', () => {
    assert.equal(getGhostAbiAssetKey('win32', 'x64'), 'b8g-ghost-abi-win64.node');
    assert.equal(getGhostAbiAssetKey('linux', 'x64'), 'b8g-ghost-abi-linux-x64.node');
    assert.equal(getGhostAbiAssetKey('linux', 'arm64'), 'b8g-ghost-abi-linux-arm64.node');
    assert.equal(getGhostAbiAssetKey('darwin', 'arm64'), 'b8g-ghost-abi-macos-arm64.node');

    assert.equal(getSectiumDisplayAssetKey('win32', 'x64'), 'libsectium_display.dll');
    assert.equal(getSectiumDisplayAssetKey('linux', 'x64'), 'libsectium_display-linux-x64.so');
    assert.equal(getSectiumDisplayAssetKey('linux', 'arm64'), 'libsectium_display-linux-arm64.so');
    assert.equal(
      getSectiumDisplayAssetKey('darwin', 'arm64'),
      'libsectium_display-macos-arm64.dylib',
    );

    assert.equal(getWebGpuDawnAssetKey('win32', 'x64'), 'libwebgpu_dawn-win64.dll');
    assert.equal(getWebGpuDawnAssetKey('linux', 'x64'), 'libwebgpu_dawn-linux-x64.so');
    assert.equal(getWebGpuDawnAssetKey('darwin', 'arm64'), 'libwebgpu_dawn-macos-arm64.dylib');
  });

  it('resolves live cas-v1 index entries for b8g-ghost-abi and libsectium_display', async () => {
    const index = await fetchGhostIndex({ forceRefresh: true });
    assert.equal(index.schema, 'b8g-ghost-cas-index-v1');
    assert.ok(index.total_entries > 0, 'expected non-empty cas-v1 index');

    const abiKey = getGhostAbiAssetKey();
    const displayKey = getSectiumDisplayAssetKey();
    const abiEntry = index.entries[abiKey];
    const displayEntry = index.entries[displayKey];

    assert.ok(abiEntry, `expected ${abiKey} in live cas-v1 index`);
    assert.match(abiEntry.sha256, /^[0-9a-f]{64}$/);
    assert.ok(abiEntry.bytes > 0);

    assert.ok(displayEntry, `expected ${displayKey} in live cas-v1 index`);
    assert.match(displayEntry.sha256, /^[0-9a-f]{64}$/);
    assert.ok(displayEntry.bytes > 0);
  });

  it('resolveDawnPlan() resolves live abi + display and gracefully reports pending or ready for libwebgpu_dawn', async () => {
    const plan = await resolveDawnPlan();

    assert.equal(plan.ghostAbi.status, 'ready');
    assert.ok(plan.ghostAbi.entry);
    assert.equal(plan.sectiumDisplay.status, 'ready');
    assert.ok(plan.sectiumDisplay.entry);

    if (plan.webgpuDawn.entry) {
      assert.equal(plan.webgpuDawn.status, 'ready');
      assert.equal(plan.status, 'ready');
      assert.equal(plan.readyCount, 3);
      assert.deepEqual(plan.pendingKeys, []);
    } else {
      assert.equal(plan.webgpuDawn.status, 'pending');
      assert.equal(plan.status, 'pending');
      assert.equal(plan.readyCount, 2);
      assert.deepEqual(plan.pendingKeys, [getWebGpuDawnAssetKey()]);
    }
  });

  it('resolveDawnPlan() transitions to status=ready when libwebgpu_dawn is present in index', async () => {
    const syntheticIndex: GhostIndex = {
      schema: 'b8g-ghost-cas-index-v1',
      cas_base_url: 'https://github.com/awesome-os/b8g-ghost/releases/download/cas-v1',
      updated_at: '2026-11-24T00:00:00.000Z',
      total_entries: 3,
      entries: {
        'b8g-ghost-abi-linux-x64.node': {
          filename: 'b8g-ghost-abi-linux-x64.node',
          sha256: 'a'.repeat(64),
          bytes: 12616,
          download_url: `https://github.com/awesome-os/b8g-ghost/releases/download/cas-v1/${'a'.repeat(64)}`,
        },
        'libsectium_display-linux-x64.so': {
          filename: 'libsectium_display-linux-x64.so',
          sha256: 'b'.repeat(64),
          bytes: 22952,
          download_url: `https://github.com/awesome-os/b8g-ghost/releases/download/cas-v1/${'b'.repeat(64)}`,
        },
        'libwebgpu_dawn-linux-x64.so': {
          filename: 'libwebgpu_dawn-linux-x64.so',
          sha256: 'c'.repeat(64),
          bytes: 18432000,
          download_url: `https://github.com/awesome-os/b8g-ghost/releases/download/cas-v1/${'c'.repeat(64)}`,
        },
      },
    };

    const plan = await resolveDawnPlan({
      platform: 'linux',
      arch: 'x64',
      index: syntheticIndex,
    });

    assert.equal(plan.status, 'ready');
    assert.equal(plan.readyCount, 3);
    assert.deepEqual(plan.pendingKeys, []);
    assert.equal(plan.webgpuDawn.status, 'ready');
    assert.equal(plan.webgpuDawn.entry?.sha256, 'c'.repeat(64));
  });
});
