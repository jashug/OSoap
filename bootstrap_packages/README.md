These are packages to be cross-compiled for OSoap.
The exact local requirements are not fully enumerated, but include
- Python 3
- Python 3.10 (hardcoded in the shebang for osoap-ld)
- Clang >= 14
- Web Assembly Binary Toolkit
- Binaryen

# Package Specification

A package consists of a directory in this folder, containing a script named `compile`, a script named `install`, and a file named `dependencies`.
The package name is the name of the directory, and should include no whitespace and no forward slash characters, and should not be the reserved name `all`.

The `compile` script is run with the current working directory set to the package directory.
`compile SYSROOT WORKSPACE`: The listed dependencies have been installed in `SYSROOT`.
Create the directory `WORKSPACE`, copy the package source into it, and compile the package.
If anything goes wrong, exit with a non-zero exit code.
The driver program will handle deleting the directory `WORKSPACE`.

The `install` script is run with the current working directory set to the package directory. `install SYSROOT WORKSPACE`: Install the package compiled in `WORKSPACE` into `SYSROOT`. If anything goes wrong, exit with a non-zero exit code. `SYSROOT` will be the same path as when `compile` was run to create `WORKSPACE`.

The `dependencies` file contains one package name per line.

Packages MUST respect the licenses of the installed code: In particular, if a GPL'd binary is installed the source code should be installed as well, with `SYSROOT/src` being the preferred location.


## Alternative Thoughts

Could download to and compile in a temporary directory, save just the installed files in their hierarchy under /usr, merge together
those files as needed.
