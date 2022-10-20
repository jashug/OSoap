#!/usr/bin/env python3.10

import argparse
from pathlib import Path
import shutil
import subprocess
import tempfile

WORKSPACE = 'workspace'


def parse_dependencies(package_dir):
    with open(package_dir / 'packages', 'r') as f:
        lines = f.readlines()

    dependencies = {}
    for line in lines:
        name = line.strip()
        if not name:
            continue
        assert '/' not in name
        with open(package_dir / name / 'dependencies', 'r') as f:
            dep_lines = f.readlines()

        deps = set()
        for dep_line in dep_lines:
            dependency = dep_line.strip()
            if not dependency:
                continue
            deps.add(dependency)
        dependencies[name] = sorted(deps)

    return dependencies


class Repository:
    # We expect that if a package is compiled then
    # all of its dependencies are also compiled
    def __init__(self, package_dir):
        self.package_dir = package_dir.resolve()
        self.dependencies = parse_dependencies(package_dir)
        self.reverse_dependencies = {}
        for name in self.dependencies.keys():
            self.reverse_dependencies[name] = set()
        for name, deps in self.dependencies.items():
            for dep in deps:
                self.reverse_dependencies[dep].add(name)

    def validate(self):
        current_status = {}
        for name in self.packages:
            current_status[name] = \
                (self.package_dir / name / WORKSPACE).is_dir()
        for name in self.packages:
            if current_status[name] and not all(
                    current_status[dep] for dep in self.dependencies[name]):
                print(f"Cleaning {name} because dependencies are not compiled")
                self.clean(name)

    @property
    def packages(self):
        return self.dependencies.keys()

    def clean(self, package):
        package_workspace = self.package_dir / package / WORKSPACE
        if not package_workspace.is_dir():
            return False
        for rev_dep in self.reverse_dependencies[package]:
            self.clean(rev_dep)
        shutil.rmtree(package_workspace)
        return True

    def _install(self, package, sysroot, seen):
        if package in seen:
            return
        for dep in self.dependencies[package]:
            self._install(dep, sysroot, seen)
        package_workspace = self.package_dir / package / WORKSPACE
        assert package_workspace.is_dir()
        subprocess.run(
            [
                self.package_dir / package / 'install',
                sysroot,
                package_workspace,
            ],
            cwd=self.package_dir / package,
            check=True)
        seen.add(package)

    def build(self, packages):
        """Must ensure all packages are compiled beforehand."""
        sysroot = None
        try:
            sysroot = tempfile.TemporaryDirectory(
                    prefix='sysroot', ignore_cleanup_errors=True)
            seen = set()
            for package in packages:
                self._install(package, sysroot, seen)
        except BaseException:
            if sysroot is not None:
                sysroot.cleanup()
            raise
        return sysroot

    def compile(self, package):
        package_workspace = self.package_dir / package / WORKSPACE
        if package_workspace.is_dir():
            return False
        for dep in self.dependencies[package]:
            self.compile(dep)

        with self.build(self.dependencies[package]) as sysroot:
            try:
                subprocess.run(
                    [
                        self.package_dir / package / 'compile',
                        sysroot,
                        package_workspace,
                    ],
                    cwd=self.package_dir / package,
                    check=True)
            except BaseException:
                if package_workspace.exists():
                    shutil.rmtree(package_workspace)
                raise
            assert package_workspace.is_dir()
        return True


def friendly_clean(pkg, repository):
    if pkg in repository.packages:
        print(f"Cleaning {pkg}...")
        if repository.clean(pkg):
            print(f"{pkg} has been cleaned.")
        else:
            print(f"{pkg} was already clean.")
    else:
        print(f"Package {pkg} not recognized, skipping.")


def friendly_compile(pkg, repository):
    if pkg in repository.packages:
        print(f"Compiling {pkg}...")
        if repository.compile(pkg):
            print(f"{pkg} has been compiled.")
        else:
            print(f"{pkg} was already compiled.")
    else:
        print(f"Package {pkg} not recognized, skipping.")


def main_clean(args, repository):
    if 'all' in args.package:
        args.package = list(repository.packages)
    for pkg in args.package:
        friendly_clean(pkg, repository)


def main_compile(args, repository):
    if 'all' in args.package:
        args.package = list(repository.packages)
    if args.recompile:
        for pkg in args.package:
            friendly_clean(pkg, repository)
    for pkg in args.package:
        friendly_compile(pkg, repository)


def main_build(args, repository):
    if 'all' in args.package:
        args.package = list(repository.packages)
    for pkg in args.package:
        friendly_compile(pkg, repository)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(
        description="Manage packages")

    parser.add_argument(
        '--repository',
        default=Path('bootstrap_packages'),
        type=Path,
        help="Defaults to 'bootstrap_packages'",
    )

    subparsers = parser.add_subparsers(required=True)

    parser_clean = subparsers.add_parser(
        'clean', help="Remove a compiled package")
    parser_clean.add_argument('package', nargs='+')
    parser_clean.set_defaults(func=main_clean)

    parser_compile = subparsers.add_parser('compile', help="Compile a package")
    parser_compile.add_argument('--recompile', action='store_true',
                                help="Recompile even if already compiled")
    parser_compile.add_argument('package', nargs='+')
    parser_compile.set_defaults(func=main_compile)

    parser_build = subparsers.add_parser(
        'build', help="Build a collection of packages")
    parser_build.add_argument(
        '--format', choices={'targz', 'dir'}, default='dir',
        help="What format the resulting collection should be output in.")
    parser_build.add_argument('destination', type=Path,
                              help="Where to put the result")
    parser_build.add_argument('package', nargs='*')
    parser_build.set_defaults(func=main_build)

    args = parser.parse_args()

    repository = Repository(args.repository)
    repository.validate()

    try:
        args.func(args, repository)
    except KeyboardInterrupt:
        print("Recieved a KeyboardInterrupt, cleanup attempted.")
