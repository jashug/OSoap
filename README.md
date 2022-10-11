# OSoap

> Operating System on a page

A Linux like operating system written in Javascript and WebAssembly that can be served as an entirely static website, allowing
users to access a fully-featured computer from anything that has a web browser.

Currently only half-finished, contributions welcome.

Unfortunately, there is currently no instructions on how to set up a development environment, nor is there a publicly viewable demo.
Sorry. I may add these if I feel like it.

## OSoap use cases development is aimed at

* Want to write code but you are not allowed to install programs? Do it in an OSoap instance.
* Working from a public computer but want to use Python as an advanced calculator? OSoap supports that.
* Want a highly reproducible but slow build process? OSoap can do that too.
* Want VMs but don't have hypervisor capabilities? OSoap works like a VM.

Most console applications if compiled for WebAssembly and linked against osoap-libc, should just work.
As with any operating system, there may be room for improved usability and/or performance if the code is changed to be OSoap aware.
