/**
 * @file src/index.mts
 * @description Public entrypoint for `@awesome-os/dawn` — standalone Google Dawn
 *   WebGPU shared library shard wired to `awesome-os/b8g-ghost @ cas-v1` for
 *   Skia Graphite, Sectium Browser, and `B8G_ARENA_V1` 3D workloads.
 */

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export {
  DAWN_PACKAGE_VERSION,
  GHOST_CAS_BASE_URL,
  GHOST_INDEX_URL,
  applyPinnedSha,
  fetchGhostIndex,
  getGhostAbiAssetKey,
  getGhostCacheDir,
  getSectiumDisplayAssetKey,
  getWebGpuDawnAssetKey,
  getWebGpuDawnAssetKeys,
  hydrateCasArtifact,
  resolveDawnPlan,
  type DawnShardPlan,
  type DawnShardStatus,
  type GhostCasEntry,
  type GhostCasHistoryItem,
  type GhostIndex,
  type HydrateArtifactResult,
  type ResolveDawnPlanOptions,
  type ResolvedCasArtifact,
} from './hydrate.mts';

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));

/** Absolute path to the standalone Dawn CMake preset file (`config/dawn-cas.cmake`). */
export const DAWN_CMAKE_PRESET_PATH = resolve(MODULE_DIR, '..', 'config', 'dawn-cas.cmake');
