#!/usr/bin/env bash
ROOT_DIR="$(pwd)"
mkdir -p tmp/build/compiler-rt
cd tmp/build/compiler-rt
# This is copied from wasi-sdk; I don't really understand it.
BUILD_PREFIX="/usr/lib/llvm-14"
# DEBUG_PREFIX_MAP="-fdebug-prefix-map=${ROOT_DIR}=wasisdk://v0.1"
cmake -G Ninja \
  -DCMAKE_C_COMPILER_WORKS=ON \
  -DCMAKE_CXX_COMPILER_WORKS=ON \
  -DCMAKE_AR="${BUILD_PREFIX}/bin/llvm-ar" \
  -DCMAKE_MODULE_PATH="${ROOT_DIR}/cmake" \
  -DCMAKE_BUILD_TYPE=RelWithDebInfo \
  -DCMAKE_TOOLCHAIN_FILE="${ROOT_DIR}/wasm.cmake" \
  -DCOMPILER_RT_BAREMETAL_BUILD=On \
  -DCOMPILER_RT_BUILD_XRAY=OFF \
  -DCOMPILER_RT_INCLUDE_TESTS=OFF \
  -DCOMPILER_RT_HAS_FPIC_FLAG=OFF \
  -DCOMPILER_RT_ENABLE_IOS=OFF \
  -DCOMPILER_RT_DEFAULT_TARGET_ONLY=On \
  -DOSOAP_SDK_PREFIX="${BUILD_PREFIX}" \
  -DCMAKE_C_FLAGS="--sysroot='${ROOT_DIR}/../sysroot'" \
  -DLLVM_CONFIG_PATH="${BUILD_PREFIX}/bin/llvm-config" \
  -DCOMPILER_RT_OS_DIR=osoap \
  -DCMAKE_VERBOSE_MAKEFILE:BOOL=ON \
  "${ROOT_DIR}/../llvm-project/compiler-rt/lib/builtins"
ninja -v -C .
# Produces tmp/build/compiler-rt/lib/osoap/libclang_rt.builtins-wasm32.a
