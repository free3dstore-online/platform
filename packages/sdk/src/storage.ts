const DB_NAME = 'free3dstore';
const DB_VERSION = 1;
const STORE_NAME = 'files';

export interface StoredFile {
  id: string;
  name: string;
  size: number;
  format: string;
  data: ArrayBuffer;
  thumbnail?: string;
  createdAt: number;
  accessedAt: number;
}

export type StoredFileMeta = Omit<StoredFile, 'data'>;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('accessedAt', 'accessedAt');
        store.createIndex('format', 'format');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(
  db: IDBDatabase,
  mode: IDBTransactionMode,
): IDBObjectStore {
  return db.transaction(STORE_NAME, mode).objectStore(STORE_NAME);
}

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export async function saveFile(
  file: File,
  options?: { thumbnail?: string },
): Promise<StoredFile> {
  const db = await openDB();
  const now = Date.now();
  const entry: StoredFile = {
    id: `${now}-${file.name}`,
    name: file.name,
    size: file.size,
    format: file.name.split('.').pop()?.toLowerCase() ?? 'unknown',
    data: await file.arrayBuffer(),
    thumbnail: options?.thumbnail,
    createdAt: now,
    accessedAt: now,
  };
  await req(tx(db, 'readwrite').put(entry));
  db.close();
  return entry;
}

export async function loadFile(id: string): Promise<StoredFile | undefined> {
  const db = await openDB();
  const entry = await req<StoredFile | undefined>(tx(db, 'readonly').get(id));
  if (entry) {
    // Update last accessed time
    entry.accessedAt = Date.now();
    await req(tx(db, 'readwrite').put(entry));
  }
  db.close();
  return entry;
}

export async function listFiles(limit = 50): Promise<StoredFileMeta[]> {
  const db = await openDB();
  const store = tx(db, 'readonly');
  const index = store.index('accessedAt');

  return new Promise((resolve, reject) => {
    const results: StoredFileMeta[] = [];
    const cursor = index.openCursor(null, 'prev'); // newest first

    cursor.onsuccess = () => {
      const c = cursor.result;
      if (c && results.length < limit) {
        const { data: _, ...meta } = c.value as StoredFile;
        results.push(meta);
        c.continue();
      } else {
        db.close();
        resolve(results);
      }
    };
    cursor.onerror = () => { db.close(); reject(cursor.error); };
  });
}

export async function removeFile(id: string): Promise<void> {
  const db = await openDB();
  await req(tx(db, 'readwrite').delete(id));
  db.close();
}

export async function clearFiles(): Promise<void> {
  const db = await openDB();
  await req(tx(db, 'readwrite').clear());
  db.close();
}

export async function storageUsage(): Promise<{ count: number; totalBytes: number }> {
  const db = await openDB();
  const store = tx(db, 'readonly');

  return new Promise((resolve, reject) => {
    let count = 0;
    let totalBytes = 0;
    const cursor = store.openCursor();

    cursor.onsuccess = () => {
      const c = cursor.result;
      if (c) {
        count++;
        totalBytes += (c.value as StoredFile).size;
        c.continue();
      } else {
        db.close();
        resolve({ count, totalBytes });
      }
    };
    cursor.onerror = () => { db.close(); reject(cursor.error); };
  });
}

export function captureThumbnail(
  canvas: HTMLCanvasElement,
  size = 128,
): string {
  const thumb = document.createElement('canvas');
  thumb.width = size;
  thumb.height = size;
  const ctx = thumb.getContext('2d')!;
  ctx.drawImage(canvas, 0, 0, size, size);
  return thumb.toDataURL('image/webp', 0.7);
}

// ---------------------------------------------------------------------------
// File System Access API — read/write real files on disk
// Chromium 86+, Safari 15.2+. Firefox: not supported (falls back to download).
// ---------------------------------------------------------------------------

const DIR_HANDLE_STORE = 'dir_handles';

function openHandleDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open('free3dstore-handles', 1);
    r.onupgradeneeded = () => {
      if (!r.result.objectStoreNames.contains(DIR_HANDLE_STORE)) {
        r.result.createObjectStore(DIR_HANDLE_STORE);
      }
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export function supportsFileSystemAccess(): boolean {
  return typeof window !== 'undefined' && 'showOpenFilePicker' in window;
}

export async function openFromDisk(
  accept?: Record<string, string[]>,
): Promise<File | null> {
  if (!supportsFileSystemAccess()) {
    // Fallback: <input type="file">
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      if (accept) {
        input.accept = Object.values(accept).flat().join(',');
      }
      input.onchange = () => resolve(input.files?.[0] ?? null);
      input.click();
    });
  }

  const [handle] = await (window as any).showOpenFilePicker({
    types: accept
      ? [{ description: '3D Models', accept }]
      : [{ description: '3D Models', accept: { 'model/*': ['.glb', '.gltf', '.obj', '.stl', '.fbx'] } }],
    multiple: false,
  });
  return handle.getFile();
}

export async function saveToDisk(
  blob: Blob,
  suggestedName: string,
): Promise<void> {
  if (!supportsFileSystemAccess()) {
    // Fallback: download link
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = suggestedName;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }

  const handle = await (window as any).showSaveFilePicker({
    suggestedName,
    types: [
      { description: '3D Model', accept: { 'model/gltf-binary': ['.glb'] } },
      { description: 'STL File', accept: { 'model/stl': ['.stl'] } },
      { description: 'OBJ File', accept: { 'text/plain': ['.obj'] } },
    ],
  });
  const writable = await handle.createWritable();
  await writable.write(blob);
  await writable.close();
}

export async function openProjectDirectory(): Promise<FileSystemDirectoryHandle | null> {
  if (!supportsFileSystemAccess()) return null;

  const handle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
  // Persist the handle in IndexedDB so we can reopen next session
  const db = await openHandleDB();
  const store = db.transaction(DIR_HANDLE_STORE, 'readwrite').objectStore(DIR_HANDLE_STORE);
  await req(store.put(handle, 'projectDir'));
  db.close();
  return handle;
}

export async function getProjectDirectory(): Promise<FileSystemDirectoryHandle | null> {
  if (!supportsFileSystemAccess()) return null;

  try {
    const db = await openHandleDB();
    const store = db.transaction(DIR_HANDLE_STORE, 'readonly').objectStore(DIR_HANDLE_STORE);
    const handle = await req<FileSystemDirectoryHandle | undefined>(store.get('projectDir'));
    db.close();
    if (!handle) return null;
    // Re-request permission (required after page reload)
    const perm = await (handle as any).requestPermission({ mode: 'readwrite' });
    return perm === 'granted' ? handle : null;
  } catch {
    return null;
  }
}

export async function listDirectoryFiles(
  dir: FileSystemDirectoryHandle,
  extensions?: string[],
): Promise<{ name: string; handle: FileSystemFileHandle }[]> {
  const files: { name: string; handle: FileSystemFileHandle }[] = [];
  for await (const [name, handle] of (dir as any).entries()) {
    if (handle.kind !== 'file') continue;
    if (extensions && !extensions.some((ext) => name.endsWith(ext))) continue;
    files.push({ name, handle });
  }
  return files.sort((a, b) => a.name.localeCompare(b.name));
}

export async function saveToDirectory(
  dir: FileSystemDirectoryHandle,
  name: string,
  blob: Blob,
): Promise<void> {
  const fileHandle = await dir.getFileHandle(name, { create: true });
  const writable = await (fileHandle as any).createWritable();
  await writable.write(blob);
  await writable.close();
}

export async function readFromDirectory(
  dir: FileSystemDirectoryHandle,
  name: string,
): Promise<File | null> {
  try {
    const fileHandle = await dir.getFileHandle(name);
    return fileHandle.getFile();
  } catch {
    return null;
  }
}
