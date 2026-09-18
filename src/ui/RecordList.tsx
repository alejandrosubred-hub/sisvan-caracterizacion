import { useMemo, useState } from 'react';
import type { FormDefinition, StoredRecord } from '@/core/types';

interface Props {
  form: FormDefinition;
  records: StoredRecord[];
  onNew: () => void;
  onOpen: (r: StoredRecord) => void;
  onExport: (rows: StoredRecord[]) => void;
  onImport: (file: File) => void;
  onRestore: (r: StoredRecord) => void;
}

export function RecordList({ form, records, onNew, onOpen, onExport, onImport, onRestore }: Props) {
  const [q, setQ] = useState('');
  const [showDeleted, setShowDeleted] = useState(false);

  const rows = useMemo(() => {
    const base = records.filter(r => showDeleted ? true : r.RecStatus === 1);
    if (!q.trim()) return base;
    const t = q.toLowerCase();
    return base.filter(r => [form.titleField, ...form.summaryFields].some(k => String(r.data[k] ?? '').toLowerCase().includes(t)));
  }, [records, q, showDeleted, form]);

  const pending = records.filter(r => r._sync === 'pending').length;

  return (
    <div className="list">
      <div className="list-toolbar">
        <input type="search" placeholder="Buscar por documento, nombre, localidad…" value={q} onChange={e => setQ(e.target.value)} />
        <label className="check"><input type="checkbox" checked={showDeleted} onChange={e => setShowDeleted(e.target.checked)} /> Ver eliminados</label>
        <div className="spacer" />
        <label className="btn">
          Importar Excel
          <input type="file" accept=".xlsx,.xls" hidden onChange={e => { const f = e.target.files?.[0]; if (f) onImport(f); e.target.value = ''; }} />
        </label>
        <button type="button" onClick={() => onExport(rows)} disabled={!rows.length}>Exportar Excel ({rows.length})</button>
        <button type="button" className="primary" onClick={onNew}>Nuevo registro</button>
      </div>

      {records.length === 0 ? (
        <div className="empty">
          <h2>Aún no hay registros de {form.shortTitle.toLowerCase()}</h2>
          <p>Crea el primero con «Nuevo registro» o importa la base histórica de Epi Info con «Importar Excel».</p>
        </div>
      ) : (
        <table className="records">
          <thead>
            <tr>
              <th>#</th><th>Documento</th><th>Nombre</th><th>Visita</th><th>Edad (m)</th><th>P/T</th><th>Localidad</th><th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.GlobalRecordId} className={r.RecStatus === 0 ? 'deleted' : ''} onClick={() => r.RecStatus === 1 && onOpen(r)}>
                <td className="num">{r.UniqueKey}</td>
                <td className="mono">{String(r.data[form.titleField] ?? '')}</td>
                <td>{[r.data.Nombre1, r.data.Nombre2, r.data.Apellido1, r.data.Apellido2].filter(Boolean).join(' ')}</td>
                <td>{String(r.data.Fechadelavisita ?? '')}</td>
                <td className="num">{r.data.EdadMeses ?? ''}</td>
                <td className={`pt ${String(r.data.InterptretacionPTVisita ?? '').startsWith('DESNUTRICION') ? 'alert' : ''}`}>{String(r.data.InterptretacionPTVisita ?? '')}</td>
                <td>{String(r.data.LocalidadVivienda ?? '')}</td>
                <td>
                  {r.RecStatus === 0
                    ? <button type="button" className="link" onClick={e => { e.stopPropagation(); onRestore(r); }}>Eliminado · restaurar</button>
                    : <span className={`sync ${r._sync}`}>{r._sync === 'synced' ? 'Sincronizado' : 'Pendiente'}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {pending > 0 && <p className="pending-note">{pending} registro{pending > 1 ? 's' : ''} guardado{pending > 1 ? 's' : ''} en este dispositivo pendiente{pending > 1 ? 's' : ''} de subir.</p>}
    </div>
  );
}
