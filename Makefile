GEN_JS ::= src/syscall/linux/errno.js src/syscall/linux/syscall.js
TMP_PROGS ::= \
  tmp/just_math.wasm \
  tmp/puts.wasm \
  tmp/argc.wasm \
  tmp/fork.wasm \
  tmp/opt/fork.wasm \
  tmp/fork_setjmp.wasm \
  tmp/opt/fork_setjmp.wasm \
  tmp/setjmp.wasm
SYSROOT_DEPS ::= $(shell find ../sysroot -type d,f)

.PHONY: all
all: $(GEN_JS) $(TMP_PROGS) filesystem

.PHONY: clean
clean:
	rm -rf tmp
	rm -f $(GEN_JS)
	rm -rf filesystem

CC ::= clang
CFLAGS ::= \
  --target=wasm32 \
  --sysroot=../sysroot \
  -pthread \
  -g \
  -O0 \
  -fuse-ld="/mnt/c/Users/Jasper Hugunin/Documents/OSoap/OSoap/tools/osoap-ld"
ifdef VERBOSE
  CFLAGS += -v
endif
WASM_OPT_FLAGS ::= -all -O -g
TARGET_CFLAGS ::=
TARGET_WASM_OPT_FLAGS ::=

FORK_CFLAGS ::= -Wl,--export=__stack_pointer -Wl,--export=__tls_base -lasyncify
FORK_WASM_OPT_FLAGS ::= --asyncify --pass-arg=asyncify-imports@env.fork,env.setjmp,env.longjmp

NATIVE_SJLJ_CFLAGS ::= -fwasm-exceptions -mllvm -wasm-enable-sjlj

src/syscall/linux/errno.js: ../sysroot/include/bits/errno.h tools/generateErrnoJS | tmp
	tools/generateErrnoJS

src/syscall/linux/syscall.js: ../sysroot/include/bits/syscall.h tools/generateSyscallJS | tmp
	tools/generateSyscallJS

filesystem: $(SYSROOT_DEPS) tools/build_filesystem.py
	tools/build_filesystem.py

tmp:
	mkdir -p tmp

tmp/%.wasm: c_test_programs/%.c $(SYSROOT_DEPS) Makefile | tmp
	$(CC) $(CFLAGS) $(TARGET_CFLAGS) -o $@ $<

tmp/opt:
	mkdir -p tmp/opt

tmp/opt/%.wasm: tmp/%.wasm $(SYSROOT_DEPS) Makefile | tmp/opt
	wasm-opt $(WASM_OPT_FLAGS) $(TARGET_WASM_OPT_FLAGS) -o $@ $<

tmp/just_math.wasm: private TARGET_CFLAGS ::= -nostdlib -Wl,--no-entry -Wl,--export-all

tmp/puts.wasm: private TARGET_CFLAGS ::=

tmp/argc.wasm: private TARGET_CFLAGS ::=

tmp/fork.wasm: private TARGET_CFLAGS ::= $(FORK_CFLAGS)
tmp/opt/fork.wasm: private TARGET_WASM_OPT_FLAGS ::= $(FORK_WASM_OPT_FLAGS)

tmp/setjmp.wasm: private TARGET_CFLAGS ::= $(NATIVE_SJLJ_CFLAGS)

tmp/fork_setjmp.wasm: private TARGET_CFLAGS ::= $(FORK_CFLAGS)
tmp/opt/fork_setjmp.wasm: private TARGET_WASM_OPT_FLAGS ::= $(FORK_WASM_OPT_FLAGS)
