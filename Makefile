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
