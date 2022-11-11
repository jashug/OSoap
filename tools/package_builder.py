#!/usr/bin/env python3.10

import argparse
import os
from pathlib import Path
import shutil
import subprocess

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
    def __init__(self, package_dir, ld_path=Path('tools/osoap-ld').resolve()):
        self.package_dir = package_dir.resolve()
        self.dependencies = parse_dependencies(package_dir)
        self.reverse_dependencies = {}
        for name in self.dependencies.keys():
            self.reverse_dependencies[name] = set()
        for name, deps in self.dependencies.items():
            for dep in deps:
                self.reverse_dependencies[dep].add(name)

        self.compile_env = os.environ.copy()
        assert ld_path.exists() and ld_path.is_absolute(), ld_path
        self.compile_env['LD'] = str(ld_path)

        self.sysroot = self.package_dir / 'sysroot'

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
        return sorted(self.dependencies.keys())

    def clean(self, package, rev_recursive=False):
        package_workspace = self.package_dir / package / WORKSPACE
        if not package_workspace.is_dir():
            return False
        if rev_recursive:
            for rev_dep in self.reverse_dependencies[package]:
                self.clean(rev_dep, True)
        shutil.rmtree(package_workspace)
        return True

    def _install(self, package, seen):
        if package in seen:
            return
        for dep in self.dependencies[package]:
            self._install(dep, seen)
        package_workspace = self.package_dir / package / WORKSPACE
        assert package_workspace.is_dir()
        subprocess.run(
            [
                self.package_dir / package / 'install',
                self.sysroot,
                package_workspace,
            ],
            cwd=self.package_dir / package,
            check=True)
        seen.add(package)

    def build(self, packages):
        """Must ensure all packages are compiled beforehand."""
        try:
            shutil.rmtree(self.sysroot)
        except FileNotFoundError:
            pass

        self.sysroot.mkdir()

        seen = set()
        for package in packages:
            self._install(package, seen)

        return self.sysroot

    def compile(self, package, cleanup_on_failure=True):
        package_workspace = self.package_dir / package / WORKSPACE
        for dep in self.dependencies[package]:
            self.compile(dep)
        if package_workspace.is_dir():
            return False

        self.build(self.dependencies[package])
        try:
            subprocess.run(
                [
                    self.package_dir / package / 'compile',
                    self.sysroot,
                    package_workspace,
                ],
                cwd=self.package_dir / package,
                env=self.compile_env,
                check=True)
        except BaseException:
            if cleanup_on_failure and package_workspace.exists():
                shutil.rmtree(package_workspace)
            raise
        assert package_workspace.is_dir()
        return True


def friendly_clean(pkg, repository, rev_recursive=False):
    if pkg in repository.packages:
        print(f"Cleaning {pkg}...")
        if repository.clean(pkg, rev_recursive):
            print(f"{pkg} has been cleaned.")
        else:
            print(f"{pkg} was already clean.")
    else:
        print(f"Package {pkg} not recognized, skipping.")


def friendly_compile(pkg, repository, cleanup_on_failure=True):
    if pkg in repository.packages:
        print(f"Compiling {pkg}...")
        if repository.compile(pkg, cleanup_on_failure):
            print(f"{pkg} has been compiled.")
        else:
            print(f"{pkg} was already compiled.")
    else:
        print(f"Package {pkg} not recognized, skipping.")


def main_clean(args, repository):
    if 'all' in args.package:
        args.package = list(repository.packages)
    for pkg in args.package:
        friendly_clean(pkg, repository, args.rev_recursive)


def main_compile(args, repository):
    if 'all' in args.package:
        args.package = list(repository.packages)
    if args.recompile:
        for pkg in args.package:
            friendly_clean(pkg, repository)
    for pkg in args.package:
        friendly_compile(pkg, repository, not args.nocleanup)


def main_build(args, repository):
    if 'all' in args.package:
        args.package = list(repository.packages)
    for pkg in args.package:
        friendly_compile(pkg, repository)

    repository.build(args.package)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(
        description="Manage packages")

    parser.add_argument(
        '--repository',
        default='bootstrap_packages',
        type=Path,
        help="Defaults to 'bootstrap_packages'",
    )
    parser.add_argument(
        '--ld-path',
        dest='ld_path',
        default='tools/osoap-ld',
        type=Path,
        help="Defaults to 'tools/osoap-ld'",
    )

    subparsers = parser.add_subparsers(required=True)

    parser_clean = subparsers.add_parser(
        'clean', help="Remove a compiled package")
    parser_clean.add_argument(
        '--rev_recursive', action='store_true',
        help="Clean packages that depend on this one too")
    parser_clean.add_argument('package', nargs='+')
    parser_clean.set_defaults(func=main_clean)

    parser_compile = subparsers.add_parser('compile', help="Compile a package")
    parser_compile.add_argument('--recompile', action='store_true',
                                help="Recompile even if already compiled")
    parser_compile.add_argument(
        '--nocleanup', action='store_true',
        help="<Advanced> Skip cleaning up the workspace on failure")
    parser_compile.add_argument('package', nargs='+')
    parser_compile.set_defaults(func=main_compile)

    parser_build = subparsers.add_parser(
        'build', help="Build a collection of packages")
    parser_build.add_argument('package', nargs='*')
    parser_build.set_defaults(func=main_build)

    args = parser.parse_args()

    repository = Repository(args.repository, args.ld_path.resolve())
    repository.validate()

    try:
        args.func(args, repository)
    except KeyboardInterrupt:
        print("Recieved a KeyboardInterrupt, cleanup attempted.")
