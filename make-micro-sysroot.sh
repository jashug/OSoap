#!/usr/bin/env bash
TARGET="wasm32"
SYSROOT="../sysroot"
SYSROOT_INCLUDE="${SYSROOT}/include"
SYSROOT_LIB="${SYSROOT}/lib"
LIBC_ROOT="microlibc"
LIBC_INCLUDE="${LIBC_ROOT}/include"
OBJDIR="tmp/build/microlibc"

CFLAGS="-O2 -DNDEBUG --target=${TARGET} -fno-trapping-math -Wall -mthread-model single --sysroot='${SYSROOT}'"

if [ -d "${SYSROOT}" ]; then rm -r "${SYSROOT}"; fi

# Populate include directories
mkdir -p "${SYSROOT_INCLUDE}"
cp -r "${LIBC_INCLUDE}" "${SYSROOT}"

mkdir -p "${OBJDIR}"
clang ${CFLAGS} -c microlibc/src/crt/crt1.c -o "${OBJDIR}/crt1.o" -MD -MP
mkdir -p "${SYSROOT_LIB}"
mv "${OBJDIR}"/*.o "${SYSROOT_LIB}"
clang ${CFLAGS} -c microlibc/src/stdio/putc.c -o "${OBJDIR}/putc.o" -MD -MP
llvm-ar crs "${SYSROOT_LIB}/libc.a" "${OBJDIR}/putc.o"
llvm-ar crs "${SYSROOT_LIB}/libpthread.a"
