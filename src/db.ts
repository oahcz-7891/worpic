import { openDB } from 'idb';
import type { LibraryImage } from './types';

const DB_NAME = 'worpic-db';
const STORE = 'images';

const dbPromise = openDB(DB_NAME, 1, {
  upgrade(db) {
    if (!db.objectStoreNames.contains(STORE)) {
      const store = db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
      store.createIndex('addedAt', 'addedAt');
    }
  },
});

/** 读取图片文件尺寸 */
function readImageSize(blob: Blob): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('无法读取图片'));
    };
    img.src = url;
  });
}

/** 批量导入图片文件到图片库 */
export async function addImageFiles(files: File[]): Promise<void> {
  const db = await dbPromise;
  // 先并行解析所有图片尺寸（耗时操作），再一次性写入同一事务，
  // 避免事务在等待期间被浏览器自动提交导致后续写入失败
  const records = await Promise.all(
    files.map(async (file): Promise<Omit<LibraryImage, 'id'> | null> => {
      try {
        const { width, height } = await readImageSize(file);
        return { name: file.name, blob: file, width, height, addedAt: Date.now() };
      } catch {
        return null; // 跳过无法解析的图片
      }
    }),
  );
  const valid = records.filter((r): r is Omit<LibraryImage, 'id'> => r !== null);
  if (!valid.length) return;
  const tx = db.transaction(STORE, 'readwrite');
  await Promise.all(valid.map((r) => tx.store.add(r)));
  await tx.done;
}

export async function getAllImages(): Promise<LibraryImage[]> {
  const db = await dbPromise;
  const list = await db.getAllFromIndex(STORE, 'addedAt');
  // 按文件名排序（数字感知、忽略大小写）
  return list.sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }),
  );
}

export async function deleteImage(id: number): Promise<void> {
  const db = await dbPromise;
  await db.delete(STORE, id);
}

export async function clearImages(): Promise<void> {
  const db = await dbPromise;
  await db.clear(STORE);
}