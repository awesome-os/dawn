# `@awesome-os/dawn`

Standalone **Google Dawn WebGPU** shared library shard (`libwebgpu_dawn`, BSD-3-Clause) wired to **`awesome-os/b8g-ghost @ cas-v1`** for:

- **Skia Graphite** GPU canvas rasterization
- **Sectium Browser** hardware-accelerated WebGPU & compositor surfaces (`libsectium_display`)
- **`B8G_ARENA_V1` 3D** zero-copy compute and rendering pipelines

## Quick Install & Usage

### Install via `pnpm` (or release tarball)

```powershell
pnpm add github:awesome-os/dawn
```

Or download the latest SHA-256 verified archive from [`Releases`](https://github.com/awesome-os/dawn/releases/latest).

### Usage & Verification

```ts
import { resolveDawnPlan } from '@awesome-os/dawn';

const plan = await resolveDawnPlan();
console.log(plan.status, plan.ghostAbi.entry?.sha256);
```

```powershell
# Verify locally (Node.js 22+)
node --test
```

## Why Standalone Dawn Sharding over `cas-v1`?

Instead of bundling or recompiling Chromium's `third_party/dawn` inside every downstream repository, `@awesome-os/dawn` isolates `libwebgpu_dawn` as a single content-addressed shared library shard in `awesome-os/b8g-ghost @ cas-v1`:

| Layer | `cas-v1` Artifact | Purpose |
| :--- | :--- | :--- |
| Host ABI bridge | `b8g-ghost-abi-<os>.node` | Zero-copy N-API / `B8G_ARENA_V1` host bridge |
| Display surface | `libsectium_display-<os>` | Pure-art Sectium window/surface provider (zero GLFW) |
| WebGPU runtime | `libwebgpu_dawn-<os>` | Standalone `BUILD_SHARED_LIBS=ON` Dawn + Tint shared library |

Until `libwebgpu_dawn` is built and published into `cas-v1` by `.github/workflows/build-dawn-cas.yml`, `resolveDawnPlan()` resolves the live `b8g-ghost-abi` and `libsectium_display` artifacts and gracefully reports `status: 'pending'` for `webgpuDawn`.

## Usage

```ts
import { resolveDawnPlan } from '@awesome-os/dawn';

const plan = await resolveDawnPlan();
console.log(plan.status); // 'pending' until libwebgpu_dawn is published, then 'ready'
console.log(plan.ghostAbi.entry?.sha256);
console.log(plan.sectiumDisplay.entry?.sha256);
```

Pin a specific historical Dawn shard SHA-256 via `DAWN_GHOST_SHA256` (Keep-Last-5 CAS history).

## Standalone CMake Build

```bash
cmake -S <dawn-src> -B build/dawn-cas -G Ninja -C config/dawn-cas.cmake
cmake --build build/dawn-cas --target webgpu_dawn
```

Key flags in `config/dawn-cas.cmake`:

- `BUILD_SHARED_LIBS=ON`
- `DAWN_BUILD_SAMPLES=OFF`
- `TINT_BUILD_TESTS=OFF`
- `DAWN_FETCH_DEPENDENCIES=ON`

## Testing

```bash
node --test test/dawn-cas.test.mts
```

## License

BSD-3-Clause — see [`LICENSE`](LICENSE).

## Quick Install & Run (Windows / Linux / macOS)

```sh
# Install / hydrate from v11 CAS via holo-pm
holo-pm install repository://github.com/awesome-os/dawn@main

# Or project & run directly via holo-project (0-byte hardlink)
holo-project "project://node/dawn?from=repository://github.com/awesome-os/dawn@main"
```
