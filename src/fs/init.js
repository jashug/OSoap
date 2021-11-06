import {Mount, makeRootMount} from './fs.js';
import {RamFS} from './ramfs.js';
import {ReadOnlyHttpFS, ROOT_ID as HttpFS_ROOT_ID} from './httpfs.js';
import {DirectoryLocation, DeviceLocation} from './FileLocation.js';

import '../devices/altttydev.js';

const rootDirs = ['bin', 'boot', 'dev', 'etc', 'home', 'lib', 'media', 'mnt', 'opt', 'proc', 'root', 'run', 'sbin', 'srv', 'sys', 'tmp', 'usr', 'var'];

// consider symlinking /lib to /usr/lib and /bin, /sbin, /usr/sbin to /usr/bin

const rootfs = new RamFS();
const rootDirIds = new Map();
for (const dirName of rootDirs) {
  rootDirIds.set(dirName, rootfs.mkdirString(rootfs.rootId, dirName));
}
const rootMount = makeRootMount(rootfs, rootfs.rootId);

const usrfs = new ReadOnlyHttpFS('/filesystem');
const usrMount = new Mount(usrfs, HttpFS_ROOT_ID, rootMount, rootDirIds.get('usr'));
void usrMount;

const devfs = new RamFS();
devfs.makeDevFileString(devfs.rootId, 'null', {major: 1, minor: 3});
devfs.makeDevFileString(devfs.rootId, 'zero', {major: 1, minor: 5});
devfs.makeDevFileString(devfs.rootId, 'full', {major: 1, minor: 7});
devfs.makeDevFileString(devfs.rootId, 'random', {major: 1, minor: 8});
devfs.makeDevFileString(devfs.rootId, 'urandom', {major: 1, minor: 9});
const devttyId = devfs.makeDevFileString(devfs.rootId, 'tty', {major: 5, minor: 0});
devfs.makeDevFileString(devfs.rootId, 'ptmx', {major: 5, minor: 2});
const devMount = new Mount(devfs, devfs.rootId, rootMount, rootDirIds.get('dev'));
void devMount;

const absoluteRootLocation = new DirectoryLocation(rootMount, rootfs.rootId);
const ttyLocation = new DeviceLocation(devMount, devttyId);

export {absoluteRootLocation, ttyLocation};
