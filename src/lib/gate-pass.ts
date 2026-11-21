export type GatePass = { orderId: string; eventTitle: string; section: string; seats: string; startsAt: string; quantity: number; mime: string; ticket: Blob; savedAt: string };
const dbName = "passon-offline-gate";
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve,reject) => { const request = indexedDB.open(dbName,1); request.onupgradeneeded = () => request.result.createObjectStore("passes"); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
}
export async function saveGatePass(pass: GatePass) {
  const db = await openDb();
  await new Promise<void>((resolve,reject) => { const tx = db.transaction("passes","readwrite"); tx.objectStore("passes").put(pass,pass.orderId); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); });
  db.close();
}
export async function readGatePass(orderId: string): Promise<GatePass | null> {
  const db = await openDb();
  const value = await new Promise<GatePass | null>((resolve,reject) => { const request = db.transaction("passes","readonly").objectStore("passes").get(orderId); request.onsuccess = () => resolve((request.result as GatePass | undefined) ?? null); request.onerror = () => reject(request.error); });
  db.close(); return value;
}
