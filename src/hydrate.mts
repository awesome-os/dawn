/**
 * @file src/hydrate.mts
 * @description Resolves and hydrates the Awesome-OS standalone Google Dawn WebGPU
 *   shared library shard alongside `b8g-ghost-abi-<os>.node` and
 *   `libsectium_display` from `awesome-os/b8g-ghost @ cas-v1`.
 *
 *   Until `libwebgpu_dawn` is published into `cas-v1` by `build-dawn-cas.yml`,
 *   `resolveDawnPlan()` gracefully reports `status: 'pending'` for the Dawn
 *   shard while resolving the live `b8g-ghost-abi` and `libsectium_display`
 *   entries.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const DAWN_PACKAGE_VERSION = '0.1.0';

export const GHOST_INDEX_URL =
  process.env.B8G_GHOST_INDEX_URL ??
  'https://raw.githubusercontent.com/awesome-os/b8g-ghost/main/manifests/index.json';

export const GHOST_CAS_BASE_URL =
  process.env.B8G_GHOST_CAS_URL ??
  'https://github.com/awesome-os/b8g-ghost/releases/download/cas-v1';

export interface GhostCasHistoryItem {
  sha256: string;
  bytes?: number;
  version?: string;
  retired_at?: string;
}

export interface GhostCasEntry {
  filename: string;
  sha256: string;
  bytes: number;
  raw_bytes?: number;
  version?: string;
  category?: string;
  download_url: string;
  history?: Array<GhostCasHistoryItem | string>;
}

export interface GhostIndex {
  schema: string;
  cas_base_url: string;
  baseline_tag?: string;
  updated_at: string;
  total_entries: number;
  entries: Record<string, GhostCasEntry>;
}

export type DawnShardStatus = 'ready' | 'pending';

export interface ResolvedCasArtifact {
  assetKey: string;
  status: DawnShardStatus;
  entry: GhostCasEntry | null;
}

export interface DawnShardPlan {
  platform: NodeJS.Platform;
  arch: string;
  indexUrl: string;
  casBaseUrl: string;
  indexUpdatedAt: string;
  ghostAbi: ResolvedCasArtifact;
  sectiumDisplay: ResolvedCasArtifact;
  webgpuDawn: ResolvedCasArtifact;
  status: DawnShardStatus;
  readyCount: number;
  pendingKeys: string[];
}

export interface ResolveDawnPlanOptions {
  platform?: NodeJS.Platform;
  arch?: string;
  index?: GhostIndex;
  indexUrl?: string;
  casBaseUrl?: string;
  pinnedDawnSha256?: string;
  forceRefresh?: boolean;
}

export interface HydrateArtifactResult {
  assetKey: string;
  entry: GhostCasEntry;
  filePath: string;
  cacheHit: boolean;
}

let cachedIndex: GhostIndex | null = null;

export function getGhostCacheDir(overrideDir?: string): string {
  const dir = overrideDir ?? process.env.B8G_GHOST_CACHE_DIR ?? join(homedir(), '.b8g', 'cas');
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function getGhostAbiAssetKey(
  platform: NodeJS.Platform = process.platform,
  arch: string = process.arch,
): string {
  if (platform === 'win32') return 'b8g-ghost-abi-win64.node';
  if (platform === 'darwin') return 'b8g-ghost-abi-macos-arm64.node';
  return arch === 'arm64' ? 'b8g-ghost-abi-linux-arm64.node' : 'b8g-ghost-abi-linux-x64.node';
}

export function getSectiumDisplayAssetKey(
  platform: NodeJS.Platform = process.platform,
  arch: string = process.arch,
): string {
  if (platform === 'win32') return 'libsectium_display.dll';
  if (platform === 'darwin') return 'libsectium_display-macos-arm64.dylib';
  return arch === 'arm64'
    ? 'libsectium_display-linux-arm64.so'
    : 'libsectium_display-linux-x64.so';
}

export function getWebGpuDawnAssetKeys(
  platform: NodeJS.Platform = process.platform,
  arch: string = process.arch,
): string[] {
  if (platform === 'win32') {
    return ['libwebgpu_dawn-win64.dll', 'libwebgpu_dawn-shared-win64.tar.zst', 'webgpu_dawn.dll'];
  }
  if (platform === 'darwin') {
    return [
      'libwebgpu_dawn-macos-arm64.dylib',
      'libwebgpu_dawn-shared-macos-arm64.tar.zst',
      'libwebgpu_dawn.dylib',
    ];
  }
  const linuxArch = arch === 'arm64' ? 'linux-arm64' : 'linux-x64';
  return [
    `libwebgpu_dawn-${linuxArch}.so`,
    `libwebgpu_dawn-shared-${linuxArch}.tar.zst`,
    'libwebgpu_dawn.so',
  ];
}

export function getWebGpuDawnAssetKey(
  platform: NodeJS.Platform = process.platform,
  arch: string = process.arch,
): string {
  return getWebGpuDawnAssetKeys(platform, arch)[0];
}

export async function fetchGhostIndex(
  options: { indexUrl?: string; forceRefresh?: boolean; cacheDir?: string } = {},
): Promise<GhostIndex> {
  const indexUrl = options.indexUrl ?? GHOST_INDEX_URL;
  if (cachedIndex && !options.forceRefresh && indexUrl === GHOST_INDEX_URL) {
    return cachedIndex;
  }

  const cacheFile = join(getGhostCacheDir(options.cacheDir), 'index.json');
  try {
    const res = await fetch(indexUrl, {
      headers: { 'User-Agent': `awesome-os-dawn/${DAWN_PACKAGE_VERSION}` },
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} fetching ${indexUrl}`);
    }
    const json = (await res.json()) as GhostIndex;
    try {
      const tmp = `${cacheFile}.${process.pid}.tmp`;
      writeFileSync(tmp, JSON.stringify(json, null, 2), 'utf8');
      renameSync(tmp, cacheFile);
    } catch {
      // Non-fatal if cache write races
    }
    if (indexUrl === GHOST_INDEX_URL) {
      cachedIndex = json;
    }
    return json;
  } catch (err) {
    if (existsSync(cacheFile)) {
      const fallback = JSON.parse(readFileSync(cacheFile, 'utf8')) as GhostIndex;
      if (indexUrl === GHOST_INDEX_URL) {
        cachedIndex = fallback;
      }
      return fallback;
    }
    throw err;
  }
}

export function applyPinnedSha(
  entry: GhostCasEntry,
  pinnedShaRaw?: string,
  casBaseUrl: string = GHOST_CAS_BASE_URL,
): GhostCasEntry {
  const pinnedSha = pinnedShaRaw?.trim().toLowerCase();
  if (!pinnedSha || pinnedSha === entry.sha256.toLowerCase()) {
    return entry;
  }

  for (const item of entry.history ?? []) {
    if (typeof item === 'string') {
      if (item.toLowerCase() === pinnedSha) {
        return {
          ...entry,
          sha256: pinnedSha,
          download_url: `${casBaseUrl}/${pinnedSha}`,
        };
      }
      continue;
    }
    if (item && typeof item === 'object' && item.sha256?.toLowerCase() === pinnedSha) {
      return {
        ...entry,
        sha256: item.sha256.toLowerCase(),
        bytes: item.bytes ?? entry.bytes,
        version: item.version ?? entry.version,
        download_url: `${casBaseUrl}/${item.sha256.toLowerCase()}`,
      };
    }
  }

  if (/^[a-f0-9]{64}$/.test(pinnedSha)) {
    return {
      ...entry,
      sha256: pinnedSha,
      download_url: `${casBaseUrl}/${pinnedSha}`,
    };
  }

  return entry;
}

function resolveSingleArtifact(
  assetKeys: string[],
  index: GhostIndex,
  pinnedSha?: string,
  casBaseUrl: string = GHOST_CAS_BASE_URL,
): ResolvedCasArtifact {
  for (const key of assetKeys) {
    const raw = index.entries[key];
    if (raw) {
      const entry = pinnedSha ? applyPinnedSha(raw, pinnedSha, casBaseUrl) : raw;
      return {
        assetKey: key,
        status: 'ready',
        entry,
      };
    }
  }
  return {
    assetKey: assetKeys[0],
    status: 'pending',
    entry: null,
  };
}

export async function resolveDawnPlan(
  options: ResolveDawnPlanOptions = {},
): Promise<DawnShardPlan> {
  const platform = options.platform ?? process.platform;
  const arch = options.arch ?? process.arch;
  const indexUrl = options.indexUrl ?? GHOST_INDEX_URL;
  const casBaseUrl = options.casBaseUrl ?? GHOST_CAS_BASE_URL;

  const index =
    options.index ??
    (await fetchGhostIndex({
      indexUrl,
      forceRefresh: options.forceRefresh,
    }));

  const ghostAbi = resolveSingleArtifact(
    [getGhostAbiAssetKey(platform, arch)],
    index,
    undefined,
    casBaseUrl,
  );
  const sectiumDisplay = resolveSingleArtifact(
    [getSectiumDisplayAssetKey(platform, arch)],
    index,
    undefined,
    casBaseUrl,
  );
  const webgpuDawn = resolveSingleArtifact(
    getWebGpuDawnAssetKeys(platform, arch),
    index,
    options.pinnedDawnSha256 ?? process.env.DAWN_GHOST_SHA256,
    casBaseUrl,
  );

  const artifacts = [ghostAbi, sectiumDisplay, webgpuDawn];
  const pendingKeys = artifacts.filter((a) => a.status === 'pending').map((a) => a.assetKey);
  const readyCount = artifacts.length - pendingKeys.length;
  const status: DawnShardStatus = pendingKeys.length === 0 ? 'ready' : 'pending';

  return {
    platform,
    arch,
    indexUrl,
    casBaseUrl: index.cas_base_url || casBaseUrl,
    indexUpdatedAt: index.updated_at,
    ghostAbi,
    sectiumDisplay,
    webgpuDawn,
    status,
    readyCount,
    pendingKeys,
  };
}

export async function hydrateCasArtifact(
  entry: GhostCasEntry,
  options: { cacheDir?: string; subdir?: string } = {},
): Promise<HydrateArtifactResult> {
  const baseDir = join(getGhostCacheDir(options.cacheDir), options.subdir ?? 'dawn', entry.sha256);
  mkdirSync(baseDir, { recursive: true });
  const filePath = join(baseDir, entry.filename);

  if (existsSync(filePath)) {
    const existingHash = createHash('sha256').update(readFileSync(filePath)).digest('hex');
    if (existingHash === entry.sha256.toLowerCase()) {
      return {
        assetKey: entry.filename,
        entry,
        filePath,
        cacheHit: true,
      };
    }
  }

  const res = await fetch(entry.download_url, {
    headers: { 'User-Agent': `awesome-os-dawn/${DAWN_PACKAGE_VERSION}` },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} downloading ${entry.filename} from ${entry.download_url}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const actualHash = createHash('sha256').update(buf).digest('hex');
  if (actualHash !== entry.sha256.toLowerCase()) {
    throw new Error(
      `SHA-256 mismatch for ${entry.filename}: expected ${entry.sha256}, got ${actualHash}`,
    );
  }

  const tmp = `${filePath}.${process.pid}.tmp`;
  writeFileSync(tmp, buf);
  renameSync(tmp, filePath);

  return {
    assetKey: entry.filename,
    entry,
    filePath,
    cacheHit: false,
  };
}
