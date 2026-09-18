import { useEffect, useMemo, useState } from 'react';
import type { FieldDef, FieldValue, FormDefinition, RecordData, StoredRecord } from '@/core/types';
import { Field } from './Field';

interface Props {
  form: FormDefinition;
  record: StoredRecord | null;          // null = registro nuevo
  initial: RecordData;
  onSave: (data: RecordData) => Promise<void>;
  onCancel: () => void;
  onDelete?: () => Promise<void>;
}

const isEmpty = (v: FieldValue | undefined) => v === null || v === undefined || v === '';

function validate(form: FormDefinition, data: RecordData, hidden: Set<string>): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const page of form.schema.pages) for (const sec of page.sections) for (const f of sec.fields) {
    if (hidden.has(f.name) || f.readOnly) continue;
    const v = data[f.name];
    if (f.required && isEmpty(v)) { errors[f.name] = 'Campo obligatorio.'; continue; }
    if (f.type === 'number' && f.range && !isEmpty(v)) {
      const n = Number(v);
      if (n < f.range[0] || n > f.range[1]) errors[f.name] = `Fuera de rango (${f.range[0]}–${f.range[1]}).`;
    }
    if (f.type === 'date' && !isEmpty(v) && Number.isNaN(Date.parse(String(v)))) errors[f.name] = 'Fecha inválida.';
  }
  return errors;
}

export function FormRenderer({ form, record, initial, onSave, onCancel, onDelete }: Props) {
  const [data, setData] = useState<RecordData>(() => form.applyRules(initial));
  const [page, setPage] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => { setData(form.applyRules(initial)); setPage(0); setErrors({}); setDirty(false); }, [initial, form]);

  const hidden = useMemo(() => form.hiddenFields(data), [data, form]);
  const warns = useMemo(() => form.warnings(data), [data, form]);

  const onChange = (name: string, value: FieldValue) => {
    setData(prev => form.applyRules({ ...prev, [name]: value }));
    setDirty(true);
    if (errors[name]) setErrors(({ [name]: _, ...rest }) => rest);
  };

  const pageErrors = (i: number) => form.schema.pages[i].sections.flatMap(s => s.fields).filter(f => errors[f.name]).length;

  const save = async () => {
    const e = validate(form, data, hidden);
    setErrors(e);
    const names = Object.keys(e);
    if (names.length) {
      const firstPage = form.schema.pages.findIndex(p => p.sections.some(s => s.fields.some(f => e[f.name])));
      setPage(firstPage);
      setTimeout(() => document.getElementById(`f_${names[0]}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 50);
      return;
    }
    // Solo se guardan los campos de datos (no espejos, etiquetas ni botones).
    const clean: RecordData = {};
    for (const k of form.schema.storedFields) clean[k] = data[k] ?? null;
    setSaving(true);
    try { await onSave(clean); setDirty(false); } finally { setSaving(false); }
  };

  const title = data[form.titleField];
  const current = form.schema.pages[page];

  return (
    <div className="form-shell">
      <aside className="pager">
        <div className="doc-box">
          <span>Documento del menor</span>
          <strong>{isEmpty(title) ? '— sin número —' : String(title)}</strong>
        </div>
        <nav aria-label="Páginas del formulario">
          {form.schema.pages.map((p, i) => {
            const first = p.sections.find(s => s.title && /^\d/.test(s.title));
            const last = [...p.sections].reverse().find(s => s.title && /^\d/.test(s.title));
            const range = first && last ? `${first.title.split('.')[0]}–${last.title.split('.')[0]}` : '';
            const n = pageErrors(i);
            return (
              <button key={p.name} type="button" className={`page-tab ${i === page ? 'active' : ''}`} onClick={() => setPage(i)}>
                <span className="page-num">Hoja {i + 1}</span>
                <span className="page-sections">Secciones {range}</span>
                {n > 0 && <span className="badge-error">{n}</span>}
              </button>
            );
          })}
        </nav>
        <div className="pager-actions">
          <button type="button" className="primary" onClick={save} disabled={saving}>{saving ? 'Guardando…' : 'Guardar registro'}</button>
          <button type="button" onClick={onCancel}>{dirty ? 'Descartar cambios' : 'Volver a la lista'}</button>
          {record && onDelete && <button type="button" className="danger" onClick={onDelete}>Eliminar registro</button>}
        </div>
        {record && (
          <dl className="rec-meta">
            <dt>UniqueKey</dt><dd>{record.UniqueKey}</dd>
            <dt>GlobalRecordId</dt><dd className="mono">{record.GlobalRecordId}</dd>
            <dt>Actualizado</dt><dd>{new Date(record.updatedAt).toLocaleString('es-CO')}{record.updatedBy ? ` · ${record.updatedBy}` : ''}</dd>
            <dt>Estado</dt><dd>{record._sync === 'synced' ? 'Sincronizado' : 'Pendiente de subir'}</dd>
          </dl>
        )}
      </aside>

      <main className="form-page" key={page}>
        {current.sections.map((sec, si) => {
          const visible = sec.fields.filter(f => !hidden.has(f.name));
          if (!visible.length) return null;
          return (
            <section key={si} className={`group ${sec.title ? '' : 'nogroup'}`}>
              {sec.title && <h2 className="legend">{sec.title}</h2>}
              <div className="grid">
                {visible.map((f: FieldDef) => (
                  <Field key={f.name} field={f} value={data[f.name] ?? null} data={data} codes={form.codes}
                    error={errors[f.name]} warning={warns[f.name]} onChange={onChange} />
                ))}
              </div>
            </section>
          );
        })}
        <div className="page-nav">
          <button type="button" disabled={page === 0} onClick={() => setPage(p => p - 1)}>← Hoja anterior</button>
          {page < form.schema.pages.length - 1
            ? <button type="button" className="primary" onClick={() => { setPage(p => p + 1); window.scrollTo({ top: 0 }); }}>Siguiente hoja →</button>
            : <button type="button" className="primary" onClick={save} disabled={saving}>Guardar registro</button>}
        </div>
      </main>
    </div>
  );
}
