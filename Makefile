.PHONY: all
all: tmp/just_math.wasm tmp/puts.wasm

tmp/just_math.wasm: c_test_programs/just_math.c
	clang \
	  --target=wasm32 \
	  -O3 \
	  -nostdlib \
	  -pthread \
	  -Wl,--import-memory \
	  -Wl,--shared-memory \
	  -Wl,--no-entry \
	  -Wl,--export-all \
	  -o tmp/just_math.wasm \
	  c_test_programs/just_math.c

tmp/puts.wasm: c_test_programs/puts.c
	clang \
	  -v \
	  --sysroot=../sysroot \
	  --target=wasm32 \
	  -O3 \
	  -pthread \
	  -Wl,--import-memory \
	  -Wl,--shared-memory \
	  -o tmp/puts.wasm \
	  c_test_programs/puts.c

tmp/argc.wasm: c_test_programs/argc.c
	clang \
	  -v \
	  --sysroot=../sysroot \
	  --target=wasm32 \
	  -O3 \
	  -pthread \
	  -Wl,--import-memory \
	  -Wl,--shared-memory \
	  -o tmp/argc.wasm \
	  c_test_programs/argc.c
