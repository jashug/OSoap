#!/usr/bin/env python3.9
import sys
import os
import os.path
from pathlib import Path, PurePath
import shutil
import stat
import json
import time

def clear_fs_directory(fs_path):
    if fs_path.exists() and fs_path.is_dir():
        shutil.rmtree(fs_path, ignore_errors=True)
    os.mkdir(fs_path)
    fs_fd = os.open(fs_path, os.O_RDONLY | os.O_DIRECTORY)
    return fs_fd, PurePath('.')

def create_subdirectories(root_fd, root_path):
    meta_path = root_path / 'meta'
    data_path = root_path / 'data'
    os.mkdir(meta_path, dir_fd=root_fd)
    os.mkdir(data_path, dir_fd=root_fd)
    return meta_path, data_path

# everybody may read and execute, no one may write
# (since this is a read-only filesystem)
PERMISSIONS = (
    stat.S_IRUSR | stat.S_IXUSR |
    stat.S_IRGRP | stat.S_IXGRP |
    stat.S_IROTH | stat.S_IXOTH
)
WRITE_FLAGS = os.O_WRONLY | os.O_CREAT
uid = 0
gid = 0

FMT_REGULAR = 1
FMT_DIRECTORY = 2
FMT_SYMLINK = 3

def walk_src(src_path, root_fd, meta_path, data_path):
    inode_counter = 1
    identity_map = {}

    current_time = int(time.time())

    def open_root_file(path, binary=True):
        fd = os.open(path, WRITE_FLAGS, dir_fd=root_fd)
        return os.fdopen(fd, 'wb' if binary else 'w')

    def visit(cur_path, parent_inode):
        nonlocal inode_counter
        cur_stat = os.stat(cur_path, follow_symlinks=False)

        # Assign inode
        assert cur_stat.st_ino != 0
        identity = (cur_stat.st_dev, cur_stat.st_ino)
        if identity in identity_map:
            inode, fmt = identity_map[identity]
            assert fmt != FMT_DIRECTORY
            return inode, fmt
        else:
            inode = inode_counter
            inode_counter += 1
        meta_file_path = meta_path / str(inode)
        data_file_path = data_path / str(inode)

        cur_mode = cur_stat.st_mode
        if stat.S_ISDIR(cur_mode):
            fmt = FMT_DIRECTORY
            print(f"{os.fspath(cur_path)} = {inode}: Directory")
            if parent_inode is None: parent_inode = inode
            with os.scandir(cur_path) as children:
                dentries = [
                    (child, visit(child, inode))
                    for child in children
                ]
            listing = [
                {'name': child.name, 'inode': child_inode, 'fmt': child_fmt}
                for child, (child_inode, child_fmt) in dentries
            ]
            contents = {
                'children': listing,
                'parent': parent_inode,
            }
            with open_root_file(data_file_path, binary=False) as fout:
                json.dump(contents, fout)
        elif stat.S_ISREG(cur_mode):
            fmt = FMT_REGULAR
            print(f"{os.fspath(cur_path)} = {inode}: Regular File")
            with open(cur_path, 'rb') as fin, open_root_file(data_file_path) as fout:
                shutil.copyfileobj(fin, fout)
        elif stat.S_ISLNK(cur_mode):
            fmt = FMT_SYMLINK
            contents = os.readlink(cur_path)
            print(f"{os.fspath(cur_path)} = {inode}: Symlink -> {contents}")
            with open_root_file(data_file_path, binary=False) as fout:
                fout.write(contents)
        else:
            raise Exception("Unknown file type")
        identity_map[identity] = inode, fmt
        metadata = {
            'mode': PERMISSIONS,
            'fmt': fmt,
            'nlinks': cur_stat.st_nlink, # doesn't seem accurate in WSL
            'uid': uid, # should probably be numberic uids
            'gid': gid, # maybe not needed at all
            'size': cur_stat.st_size,
            'timestamp': current_time,
        }
        with open_root_file(meta_file_path, binary=False) as fout:
            json.dump(metadata, fout)
        return inode, fmt
    visit(src_path, None)

if __name__ == "__main__":
    root_fd, root_path = clear_fs_directory(Path('filesystem'))
    meta_path, data_path = create_subdirectories(root_fd, root_path)
    walk_src(Path('../sysroot'), root_fd, meta_path, data_path)
