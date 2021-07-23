extern int main(void);

__attribute__((export_name("_start")))
void _start(void) {
  main();
}
