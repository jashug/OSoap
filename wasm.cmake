# Cmake toolchain description file for the Makefile
# Largely copied from wasi-sdk

# This is arbitrary, AFAIK, for now.
cmake_minimum_required(VERSION 3.4.0)

set(CMAKE_SYSTEM_NAME OSOAP)
set(CMAKE_SYSTEM_VERSION 1)
set(CMAKE_SYSTEM_PROCESSOR wasm32)
set(triple wasm32)

if(WIN32)
  set(OSOAP_HOST_EXE_SUFFIX ".exe")
else()
  set(OSOAP_HOST_EXE_SUFFIX "")
endif()

set(CMAKE_C_COMPILER ${OSOAP_SDK_PREFIX}/bin/clang${OSOAP_HOST_EXE_SUFFIX})
set(CMAKE_CXX_COMPILER ${OSOAP_SDK_PREFIX}/bin/clang++${OSOAP_HOST_EXE_SUFFIX})
set(CMAKE_AR ${OSOAP_SDK_PREFIX}/bin/llvm-ar${OSOAP_HOST_EXE_SUFFIX})
set(CMAKE_RANLIB ${OSOAP_SDK_PREFIX}/bin/llvm-ranlib${OSOAP_HOST_EXE_SUFFIX})
set(CMAKE_C_COMPILER_TARGET ${triple})
set(CMAKE_CXX_COMPILER_TARGET ${triple})

# Don't look in the sysroot for executables to run during the build
set(CMAKE_FIND_ROOT_PATH_MODE_PROGRAM NEVER)
# Only look in the sysroot (not in the host paths) for the rest
set(CMAKE_FIND_ROOT_PATH_MODE_LIBRARY ONLY)
set(CMAKE_FIND_ROOT_PATH_MODE_INCLUDE ONLY)
set(CMAKE_FIND_ROOT_PATH_MODE_PACKAGE ONLY)
