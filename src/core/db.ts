import Dexie, { type Table } from 'dexie';
import type { StoredRecord, RecordData } from './types';

/**
 * Base local (IndexedDB). Es la fuente de verdad en el dispositivo:
 * todo se guarda aquí primero y luego se sincroniza si hay conexión.
 */
class SisvanDB extends Dexie {
  records!: Table<StoredRecord, string>;
  meta!: Table<{ key: string; value: unknown }, string>;
  constructor() {
    super('sisvan-caracterizacion');
    this.version(1).stores({
      records: 'GlobalRecordId, formId, UniqueKey, _sync, updatedAt, [formId+RecStatus]',
      meta: 'key'
    });
  }
}
export const db = new SisvanDB();

export function newGuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0; return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

async function nextUniqueKey(formId: string): Promise<number> {
  const last = await db.records.where('formId').equals(formId).sortBy('UniqueKey');
  return (last.length ? last[last.length - 1].UniqueKey : 0) + 1;
}

export async function createRecord(formId: string, data: RecordData, user?: string): Promise<StoredRecord> {
  const now = new Date().toISOString();
  const rec: StoredRecord = {
    GlobalRecordId: newGuid(), UniqueKey: await nextUniqueKey(formId), RecStatus: 1,
    formId, data, createdAt: now, updatedAt: now, updatedBy: user, _sync: 'pending'
  };
  await db.records.add(rec);
  return rec;
}

export async function updateRecord(id: string, data: RecordData, user?: string): Promise<void> {
  await db.records.update(id, { data, updatedAt: new Date().toISOString(), updatedBy: user, _sync: 'pending' });
}

/** Borrado lógico, como Epi Info (RecStatus = 0). */
export async function deleteRecord(id: string, user?: string): Promise<void> {
  await db.records.update(id, { RecStatus: 0, updatedAt: new Date().toISOString(), updatedBy: user, _sync: 'pending' });
}
export async function restoreRecord(id: string, user?: string): Promise<void> {
  await db.records.update(id, { RecStatus: 1, updatedAt: new Date().toISOString(), updatedBy: user, _sync: 'pending' });
}

export async function listRecords(formId: string, includeDeleted = false): Promise<StoredRecord[]> {
  const all = await db.records.where('formId').equals(formId).sortBy('UniqueKey');
  return includeDeleted ? all : all.filter(r => r.RecStatus === 1);
}

export async function getMeta<T>(key: string, fallback: T): Promise<T> {
  const m = await db.meta.get(key);
  return (m?.value as T) ?? fallback;
}
export async function setMeta(key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value });
}
