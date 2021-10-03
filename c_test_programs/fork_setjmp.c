#include <stdio.h>
#include <sys/types.h>
#include <unistd.h>
#include <setjmp.h>

void example()
{
  jmp_buf env;
  int val;

  val = setjmp(env);
  printf("val is %d\n", val);
  if (!val) {
    pid_t child_pid = fork();
    longjmp(env, child_pid ? 5 : 6);
  }
}

int main()
{
  example();
  return 0;
}
