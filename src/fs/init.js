import {Mount} from './fs.js';
import {RamFS} from './ramfs.js';
import {ReadOnlyHttpFS, ROOT_ID as HttpFS_ROOT_ID} from './httpfs.js';
import {DirectoryLocation} from './FileLocation.js';

const rootfs = new RamFS();
const usrDirId = rootfs.mkdirString(rootfs.rootId, "usr");
const rootMount = new Mount(rootfs, rootfs.rootId, null, 0);

const usrfs = new ReadOnlyHttpFS('/filesystem');
const usrMount = new Mount(usrfs, HttpFS_ROOT_ID, rootMount, usrDirId);
void usrMount;

const absoluteRootLocation = new DirectoryLocation(rootMount, rootfs.rootId);

export {absoluteRootLocation};
