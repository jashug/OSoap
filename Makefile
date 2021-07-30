.PHONY: all
all: tmp/just_math.wasm tmp/puts.wasm tmp/argc.wasm

.PHONY: clean
clean:
	rm -rf tmp

SYSROOT_PREREQS ::= ../sysroot ../sysroot/include ../sysroot/lib $(wildcard ../sysroot/include/*) $(wildcard ../sysroot/lib/*)

CC ::= clang
CFLAGS ::= \
  --target=wasm32 \
  --sysroot=../sysroot \
  -O3 \
  -pthread \
  -Wl,--import-memory \
  -Wl,--shared-memory
ifdef VERBOSE
  CFLAGS += -v
endif
TARGET_CFLAGS ::=

tmp:
	mkdir tmp

tmp/%.wasm: c_test_programs/%.c $(SYSROOT_PREREQS) | tmp
	$(CC) $(CFLAGS) $(TARGET_CFLAGS) -o $@ $<

tmp/just_math.wasm: private TARGET_CFLAGS ::= -nostdlib -Wl,--no-entry -Wl,--export-all

tmp/puts.wasm: private TARGET_CFLAGS ::=

tmp/argc.wasm: private TARGET_CFLAGS ::=

# setjmp is not yet translated to wasm exceptions in llvm
# aheejin is one likely person to add them
tmp/setjmp.wasm: private TARGET_CFLAGS ::= -fwasm-exceptions
