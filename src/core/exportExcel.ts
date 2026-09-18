import * as XLSX from 'xlsx';
import type { FormDefinition, StoredRecord } from './types';

/**
 * Exporta con la estructura exacta de resultado.xlsx (Epi Info → Excel):
 * UniqueKey, GlobalRecordId, RecStatus, <campos en orden de la vista>, FKEY.
 */
export function buildWorkbook(form: FormDefinition, records: StoredRecord[]): XLSX.WorkBook {
  const cols = form.exportColumns;
  const rows = records.map(r => cols.map(c => {
    if (c === 'UniqueKey') return r.UniqueKey;
    if (c === 'GlobalRecordId') return r.GlobalRecordId;
    if (c === 'RecStatus') return r.RecStatus;
    if (c === 'FKEY') return null;
    const v = r.data[c];
    return v === undefined || v === '' ? null : v;
  }));
  const ws = XLSX.utils.aoa_to_sheet([cols, ...rows]);
  ws['!cols'] = cols.map(c => ({ wch: Math.min(40, Math.max(10, c.length + 2)) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, form.schema.view.slice(0, 31));
  return wb;
}

export function downloadExcel(form: FormDefinition, records: StoredRecord[], filename?: string) {
  const wb = buildWorkbook(form, records);
  const stamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, filename ?? `${form.id}_${stamp}.xlsx`);
}

/** Importa un Excel con la misma estructura (por ejemplo, la base histórica de Epi Info). */
export async function readExcel(file: File): Promise<Record<string, unknown>[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { defval: null, raw: true });
}
