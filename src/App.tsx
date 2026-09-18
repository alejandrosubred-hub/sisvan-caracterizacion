import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { User } from 'firebase/auth';
import { forms, plannedForms, getForm } from './forms/registry';
import { db, createRecord, updateRecord, deleteRecord, restoreRecord, newGuid } from './core/db';
import { downloadExcel, readExcel } from './core/exportExcel';
import { autoSync, syncForm, type SyncResult } from './core/sync';
import { remoteEnabled, watchUser, logout } from './core/firebase';
import { Login } from './ui/Login';
import { useOnline } from './hooks/useOnline';
import { FormRenderer } from './ui/FormRenderer';
import { RecordList } from './ui/RecordList';
import type { RecordData, StoredRecord } from './core/types';

type View = { kind: 'list' } | { kind: 'edit'; record: StoredRecord | null; initial: RecordData };

export default function App() {
  const [formId, setFormId] = useState(forms[0].id);
  const form = getForm(formId)!;
  const [view, setView] = useState<View>({ kind: 'list' });
  const [user, setUser] = useState<User | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const online = useOnline();

  const records = useLiveQuery(() => db.records.where('formId').equals(formId).sortBy('UniqueKey'), [formId]) ?? [];

  const notify = useCallback((m: string, ms = 4000) => { setToast(m); window.setTimeout(() => setToast(null), ms); }, []);
  const onSynced = useCallback((r: SyncResult, manual = false) => {
    if (r.error) notify(`Sin sincronizar: ${r.error}`, 12000);
    else if (r.pushed || r.pulled) notify(`Sincronizado · ${r.pushed} subidos, ${r.pulled} recibidos`);
    else if (manual) notify('Sincronizado · sin cambios pendientes');
  }, [notify]);

  useEffect(() => watchUser(setUser), []);
  useEffect(() => { if (remoteEnabled && user) return autoSync(formId, onSynced); }, [formId, user, onSynced]);

  const who = user?.email ?? undefined;

  const newRecord = () => {
    // "Repeat Last": arrastra del último registro los campos marcados así en Epi Info.
    const activos = records.filter(r => r.RecStatus === 1);
    const last = activos[activos.length - 1];
    const initial: RecordData = {};
    if (last) for (const p of form.schema.pages) for (const s of p.sections) for (const f of s.fields)
      if (f.repeatLast) initial[f.name] = last.data[f.name] ?? null;
    initial.Fechadelavisita = new Date().toISOString().slice(0, 10);
    setView({ kind: 'edit', record: null, initial });
  };

  const save = async (data: RecordData) => {
    if (view.kind !== 'edit') return;
    if (view.record) { await updateRecord(view.record.GlobalRecordId, data, who); notify(`Registro ${view.record.UniqueKey} actualizado`); }
    else { const r = await createRecord(formId, data, who); notify(`Registro ${r.UniqueKey} guardado en este dispositivo`); }
    setView({ kind: 'list' });
    if (remoteEnabled && user && online) syncForm(formId).then(onSynced);
  };

  const remove = async () => {
    if (view.kind !== 'edit' || !view.record) return;
    if (!confirm(`¿Eliminar el registro ${view.record.UniqueKey}? Queda marcado como eliminado (RecStatus = 0), igual que en Epi Info.`)) return;
    await deleteRecord(view.record.GlobalRecordId, who);
    setView({ kind: 'list' });
  };

  const dateFields = useMemo(() => new Set(form.schema.pages.flatMap(p => p.sections.flatMap(s => s.fields.filter(f => f.type === 'date').map(f => f.name)))), [form]);
  const excelSerialToISO = (n: number) => new Date(Math.round((n - 25569) * 86400000)).toISOString().slice(0, 10);

  const importExcel = async (file: File) => {
    try {
      const rows = await readExcel(file);
      let added = 0, updated = 0;
      for (const row of rows) {
        const data: RecordData = {};
        for (const k of form.schema.storedFields) {
          const v = row[k];
          if (v === undefined || v === null || v === '') { data[k] = null; continue; }
          if (v instanceof Date) { data[k] = v.toISOString().slice(0, 10); continue; }
          if (dateFields.has(k) && typeof v === 'number') { data[k] = excelSerialToISO(v); continue; }
          data[k] = typeof v === 'number' || typeof v === 'string' ? v : String(v);
        }
        const gid = typeof row.GlobalRecordId === 'string' && row.GlobalRecordId ? row.GlobalRecordId : newGuid();
        const existing = await db.records.get(gid);
        const now = new Date().toISOString();
        if (existing) { await db.records.update(gid, { data: form.applyRules(data), updatedAt: now, _sync: 'pending' }); updated++; }
        else {
          const uk = typeof row.UniqueKey === 'number' ? row.UniqueKey : (await db.records.where('formId').equals(formId).count()) + 1;
          await db.records.add({ GlobalRecordId: gid, UniqueKey: uk, RecStatus: row.RecStatus === 0 ? 0 : 1, formId,
            data: form.applyRules(data), createdAt: now, updatedAt: now, updatedBy: who, _sync: 'pending' });
          added++;
        }
      }
      notify(`Importados ${added} nuevos, ${updated} actualizados`);
    } catch (e) { notify(`No se pudo importar: ${(e as Error).message}`); }
  };

  const pendingCount = useMemo(() => records.filter(r => r._sync === 'pending').length, [records]);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-org">Secretaría Distrital de Salud · Vigilancia en Salud Pública</span>
          <h1>SISVAN <span>Caracterización en seguridad alimentaria</span></h1>
        </div>
        <nav className="bases" aria-label="Bases">
          {forms.map(f => (
            <button key={f.id} type="button" className={f.id === formId ? 'active' : ''}
              onClick={() => { setFormId(f.id); setView({ kind: 'list' }); }}>{f.shortTitle}</button>
          ))}
          {plannedForms.map(p => <button key={p.id} type="button" disabled title="Pendiente de migrar">{p.shortTitle}</button>)}
        </nav>
        <div className="status">
          <span className={`dot ${online ? 'on' : 'off'}`} />
          <span>{online ? 'En línea' : 'Sin conexión · se guarda local'}</span>
          {remoteEnabled ? (
            user
              ? <>
                  <button type="button" onClick={() => { notify('Sincronizando…'); syncForm(formId).then(r => onSynced(r, true)); }} disabled={!online}>Sincronizar{pendingCount ? ` (${pendingCount})` : ''}</button>
                  <button type="button" className="link" onClick={logout}>{user.email} · salir</button>
                </>
              : <button type="button" onClick={() => setShowLogin(true)}>Iniciar sesión</button>
          ) : <span className="muted">Modo local</span>}
        </div>
      </header>

      {view.kind === 'list' ? (
        <RecordList form={form} records={records} onNew={newRecord}
          onOpen={r => setView({ kind: 'edit', record: r, initial: r.data })}
          onExport={rows => downloadExcel(form, rows)}
          onImport={importExcel}
          onRestore={r => restoreRecord(r.GlobalRecordId, who)} />
      ) : (
        <FormRenderer form={form} record={view.record} initial={view.initial}
          onSave={save} onCancel={() => setView({ kind: 'list' })} onDelete={view.record ? remove : undefined} />
      )}

      <footer className="foot">Alejandro Ortega — Subred Sur · SISVAN · migrado desde Epi Info 7 (vista {form.schema.view})</footer>
      {showLogin && <Login online={online} onDone={() => { setShowLogin(false); notify('Sesión iniciada'); }} onClose={() => setShowLogin(false)} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
