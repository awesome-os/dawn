# Awesome-OS Standalone Google Dawn WebGPU Shared Library Shard (cas-v1)
# Usage:
#   cmake -S <dawn-src> -B build/dawn-cas -G Ninja -C config/dawn-cas.cmake
#   cmake --build build/dawn-cas --target webgpu_dawn

set(CMAKE_BUILD_TYPE "Release" CACHE STRING "Build type for Dawn CAS shard")
set(BUILD_SHARED_LIBS OFF CACHE BOOL "Build internal Dawn sub-libraries statically for monolithic libwebgpu_dawn")
set(DAWN_BUILD_MONOLITHIC_LIBRARY "SHARED" CACHE STRING "Build libwebgpu_dawn as a standalone monolithic shared library")
set(CMAKE_POSITION_INDEPENDENT_CODE ON CACHE BOOL "Enable PIC for shared library consumers")

# Disable samples, tests, benchmarks, and docs to keep the shard lean
set(DAWN_BUILD_SAMPLES OFF CACHE BOOL "Disable Dawn sample executables")
set(DAWN_BUILD_TESTS OFF CACHE BOOL "Disable Dawn unit and end2end tests")
set(DAWN_BUILD_BENCHMARKS OFF CACHE BOOL "Disable Dawn benchmarks")
set(TINT_BUILD_TESTS OFF CACHE BOOL "Disable Tint compiler tests")
set(TINT_BUILD_BENCHMARKS OFF CACHE BOOL "Disable Tint benchmarks")
set(TINT_BUILD_CMD_TOOLS OFF CACHE BOOL "Disable standalone Tint CLI tools")
set(TINT_BUILD_DOCS OFF CACHE BOOL "Disable Tint documentation")

# Standalone dependency fetch (zero depot_tools / gclient required)
set(DAWN_FETCH_DEPENDENCIES ON CACHE BOOL "Fetch Dawn CMake dependencies automatically")
set(DAWN_USE_GLFW OFF CACHE BOOL "Disable GLFW; surfaces come from libsectium_display")
set(DAWN_ENABLE_INSTALL ON CACHE BOOL "Enable install rules for cas-v1 packaging")

# Enable modern GPU backends appropriate for Skia Graphite, Sectium Browser, and B8G_ARENA_V1 3D
if(WIN32)
  set(DAWN_ENABLE_D3D12 ON CACHE BOOL "Enable D3D12 backend on Windows")
  set(DAWN_ENABLE_VULKAN ON CACHE BOOL "Enable Vulkan backend on Windows")
  set(DAWN_ENABLE_D3D11 OFF CACHE BOOL "Disable legacy D3D11 backend")
  set(DAWN_ENABLE_OPENGL OFF CACHE BOOL "Disable legacy OpenGL backend")
  set(DAWN_ENABLE_OPENGLES OFF CACHE BOOL "Disable legacy OpenGLES backend")
elseif(APPLE)
  set(DAWN_ENABLE_METAL ON CACHE BOOL "Enable Metal backend on macOS")
  set(DAWN_ENABLE_VULKAN OFF CACHE BOOL "Disable Vulkan on macOS")
else()
  set(DAWN_ENABLE_VULKAN ON CACHE BOOL "Enable Vulkan backend on Linux")
  set(DAWN_ENABLE_DESKTOP_GL OFF CACHE BOOL "Disable legacy Desktop GL on Linux")
  set(DAWN_ENABLE_OPENGLES OFF CACHE BOOL "Disable legacy OpenGLES on Linux")
  set(DAWN_USE_X11 ON CACHE BOOL "Allow X11 surface interop when available")
  set(DAWN_USE_WAYLAND ON CACHE BOOL "Allow Wayland surface interop when available")
endif()
