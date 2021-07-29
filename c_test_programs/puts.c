#include <stdio.h>

__attribute__((import_name("get")))
int get(void);

int main() {
  puts("Hello, world!");
  return get();
}
