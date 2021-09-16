GEN_JS = src/syscall/linux/errno.js src/syscall/linux/syscall.js

.PHONY: all
all: $(GEN_JS) \
  tmp/just_math.wasm \
  tmp/puts.wasm \
  tmp/argc.wasm \
  tmp/fork.wasm \
  tmp/opt/fork.wasm

.PHONY: clean
clean:
	rm -rf tmp
	rm -f $(GEN_JS)

SYSROOT_PREREQS ::= ../sysroot ../sysroot/include ../sysroot/lib $(wildcard ../sysroot/include/*) $(wildcard ../sysroot/lib/*)

CC ::= clang
CFLAGS ::= \
  --target=wasm32 \
  --sysroot=../sysroot \
  -pthread \
  -g \
  -O0 \
  -Wl,--import-memory \
  -Wl,--shared-memory \
  -Wl,--max-memory=4294967296
ifdef VERBOSE
  CFLAGS += -v
endif
TARGET_CFLAGS ::=
TARGET_WASM_OPT_FLAGS ::=

src/syscall/linux/errno.js: ../sysroot/include/bits/errno.h tools/generateErrnoJS | tmp
	tools/generateErrnoJS

src/syscall/linux/syscall.js: ../sysroot/include/bits/errno.h tools/generateSyscallJs
	tools/generateSyscallJS

tmp:
	mkdir -p tmp

tmp/%.wasm: c_test_programs/%.c $(SYSROOT_PREREQS) Makefile | tmp
	$(CC) $(CFLAGS) $(TARGET_CFLAGS) -o $@ $<

tmp/opt:
	mkdir -p tmp/opt

tmp/opt/%.wasm: tmp/%.wasm $(SYSROOT_PREREQS) Makefile | tmp/opt
	wasm-opt -all $(TARGET_WASM_OPT_FLAGS) -O -o $@ $<

tmp/just_math.wasm: private TARGET_CFLAGS ::= -nostdlib -Wl,--no-entry -Wl,--export-all

tmp/puts.wasm: private TARGET_CFLAGS ::=

tmp/argc.wasm: private TARGET_CFLAGS ::=

tmp/opt/fork.wasm: private TARGET_WASM_OPT_FLAGS ::= --asyncify --pass-arg=asyncify-imports@env.fork

# setjmp is not yet translated to wasm exceptions in llvm
# aheejin is one likely person to add them
tmp/setjmp.wasm: private TARGET_CFLAGS ::= -fwasm-exceptions
