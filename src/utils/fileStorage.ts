/**
 * Persistent IndexedDB storage for video buffers
 * Prevents mobile browser standby/timeout disconnects
 */

const DB_NAME = 'PlayVear_VideoCache_DB';
const STORE_NAME = 'video_buffers';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not supported'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveBufferToCache(key: string, buffer: ArrayBuffer | Blob): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const putRequest = store.put(buffer, key);

      putRequest.onsuccess = () => resolve();
      putRequest.onerror = () => reject(putRequest.error);
      transaction.oncomplete = () => db.close();
    });
  } catch (err) {
    console.warn('Failed to save to IndexedDB cache:', err);
  }
}

export async function getBufferFromCache(key: string): Promise<ArrayBuffer | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const getRequest = store.get(key);

      getRequest.onsuccess = async () => {
        const result = getRequest.result;
        if (!result) {
          resolve(null);
          return;
        }

        if (result instanceof ArrayBuffer) {
          resolve(result);
        } else if (result instanceof Blob) {
          try {
            const buf = await result.arrayBuffer();
            resolve(buf);
          } catch {
            resolve(null);
          }
        } else {
          resolve(null);
        }
      };

      getRequest.onerror = () => reject(getRequest.error);
      transaction.oncomplete = () => db.close();
    });
  } catch (err) {
    console.warn('Failed to retrieve from IndexedDB cache:', err);
    return null;
  }
}

export async function clearAllCachedBuffers(): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const clearRequest = store.clear();

      clearRequest.onsuccess = () => resolve();
      clearRequest.onerror = () => reject(clearRequest.error);
      transaction.oncomplete = () => db.close();
    });
  } catch {
    // Ignore clear errors
  }
}

/**
 * Screen WakeLock Helper to prevent mobile screen sleep during conversion / standby
 */
let wakeLockSentinel: unknown = null;

export async function requestScreenWakeLock(): Promise<void> {
  try {
    if ('wakeLock' in navigator) {
      const nav = navigator as unknown as { wakeLock: { request: (type: string) => Promise<unknown> } };
      wakeLockSentinel = await nav.wakeLock.request('screen');
    }
  } catch {
    // Wake lock might be rejected on low battery or non-secure contexts
  }
}

export function releaseScreenWakeLock(): void {
  try {
    if (wakeLockSentinel && typeof (wakeLockSentinel as { release?: () => Promise<void> }).release === 'function') {
      (wakeLockSentinel as { release: () => Promise<void> }).release().catch(() => {});
      wakeLockSentinel = null;
    }
  } catch {
    // Ignore release error
  }
}
