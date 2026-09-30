const db = new Promise((resolve, reject) => {
  const request = indexedDB.open('sealed-keyring', 1);
  request.onupgradeneeded = () => request.result.createObjectStore('keys', { keyPath: 'id' });
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(new Error('Local key storage is unavailable. Check browser storage permissions.'));
});
async function transact(mode, action) {
  const database = await db;
  return new Promise((resolve, reject) => {
    const tx = database.transaction('keys', mode);
    const request = action(tx.objectStore('keys'));
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = tx.onabort = () => reject(tx.error || new Error('Could not save keys. Export a backup and check available storage.'));
  });
}
export const listKeys = () => transact('readonly', store => store.getAll());
export async function saveKey(record) {
  const existing = await transact('readonly', store => store.get(record.id));
  return transact('readwrite', store => store.put({ ...record, title: (record.title ?? existing?.title ?? '').trim().slice(0, 120), privateKey: record.privateKey || existing?.privateKey || null }));
}
export const deleteKey = id => transact('readwrite', store => store.delete(id));
