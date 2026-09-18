import type { FieldDef, FieldValue, RecordData } from '@/core/types';

interface Props {
  field: FieldDef;
  value: FieldValue;
  data: RecordData;
  codes: Record<string, string[]>;
  error?: string;
  warning?: string;
  onChange: (name: string, value: FieldValue) => void;
}

function stepFromPattern(p?: string): string {
  if (!p) return 'any';
  const dec = p.includes('.') ? p.split('.')[1].length : 0;
  return dec === 0 ? '1' : (1 / Math.pow(10, dec)).toString();
}

const isLong = (f: FieldDef) => f.type === 'multiline' || (f.maxLength ?? 0) >= 60 || f.prompt.length > 70;

export function Field({ field: f, value, data, codes, error, warning, onChange }: Props) {
  const id = `f_${f.name}`;
  const cls = ['field', f.type, isLong(f) ? 'wide' : '', error ? 'has-error' : '', warning ? 'has-warning' : '', f.readOnly ? 'readonly' : ''].join(' ');
  const v = value ?? '';

  if (f.type === 'button') return null;
  if (f.type === 'label') return <p className={`field-label ${f.prompt.length > 90 ? 'wide' : ''}`}>{f.prompt}</p>;

  if (f.type === 'mirror') {
    const src = f.mirrorOf ? data[f.mirrorOf] : '';
    return (
      <div className={`${cls} mirror`}>
        <label>{f.prompt}</label>
        <output>{src === null || src === undefined || src === '' ? '—' : String(src)}</output>
      </div>
    );
  }

  const label = <label htmlFor={id}>{f.prompt}{f.required && <span className="req" title="Obligatorio"> *</span>}</label>;
  const foot = (error || warning) && <small className={error ? 'msg-error' : 'msg-warning'}>{error ?? warning}</small>;

  if (f.type === 'option' && f.options) {
    return (
      <fieldset className={`${cls} choice ${f.layout ?? 'vertical'}`}>
        <legend>{f.prompt}{f.required && <span className="req"> *</span>}</legend>
        <div className="choices">
          {f.options.map((o, i) => (
            <label key={o} className="choice-item">
              <input type="radio" name={f.name} checked={v === i} onChange={() => onChange(f.name, i)} disabled={f.readOnly} />
              {o}
            </label>
          ))}
          {v !== '' && !f.required && <button type="button" className="link" onClick={() => onChange(f.name, null)}>limpiar</button>}
        </div>
        {foot}
      </fieldset>
    );
  }

  if ((f.type === 'legal' || f.type === 'codes' || f.type === 'commentlegal' || f.type === 'list') && (f.source || f.options)) {
    // La tabla de códigos manda; 'options' (List) es solo respaldo.
    const list = (f.source && codes[f.source]) || f.options || [];
    // Comment Legal: se muestra "1-Masculino" pero se guarda "1".
    const toCode = (s: string) => (f.type === 'commentlegal' ? s.split('-')[0].trim() : s);
    const current = String(v);
    if (f.layout && list.length <= 6) {
      return (
        <fieldset className={`${cls} choice ${f.layout}`}>
          <legend>{f.prompt}{f.required && <span className="req"> *</span>}</legend>
          <div className="choices">
            {list.map(o => (
              <label key={o} className="choice-item">
                <input type="radio" name={f.name} checked={current === toCode(o)} onChange={() => onChange(f.name, toCode(o))} disabled={f.readOnly} />
                {o}
              </label>
            ))}
          </div>
          {foot}
        </fieldset>
      );
    }
    if (list.length > 40) {
      // Listas grandes (UPGD, UPZ, pueblos indígenas): campo con búsqueda.
      return (
        <div className={`${cls} wide`}>
          {label}
          <input id={id} list={`${id}_list`} value={current} readOnly={f.readOnly} placeholder="Escribe para buscar…"
            onChange={e => onChange(f.name, e.target.value)}
            onBlur={e => { const t = e.target.value; if (t && !list.includes(t)) { const m = list.find(x => x.toLowerCase().startsWith(t.toLowerCase())); onChange(f.name, m ?? t); } }} />
          <datalist id={`${id}_list`}>{list.map(o => <option key={o} value={o} />)}</datalist>
          {current && !list.includes(current) && <small className="msg-error">Valor fuera de la lista de códigos.</small>}
          {foot}
        </div>
      );
    }
    return (
      <div className={cls}>
        {label}
        <select id={id} value={current} disabled={f.readOnly} onChange={e => onChange(f.name, e.target.value || null)}>
          <option value="">—</option>
          {list.map(o => <option key={o} value={toCode(o)}>{o}</option>)}
        </select>
        {foot}
      </div>
    );
  }

  if (f.type === 'number') {
    return (
      <div className={cls}>
        {label}
        <input id={id} type="number" inputMode="decimal" value={v} readOnly={f.readOnly} step={stepFromPattern(f.pattern)}
          min={f.range?.[0]} max={f.range?.[1]} placeholder={f.pattern}
          onChange={e => onChange(f.name, e.target.value === '' ? null : Number(e.target.value))} />
        {f.range && !error && !warning && <small className="hint">{f.range[0]}–{f.range[1]}</small>}
        {foot}
      </div>
    );
  }

  if (f.type === 'date') {
    return (
      <div className={cls}>
        {label}
        <input id={id} type="date" value={String(v)} readOnly={f.readOnly} onChange={e => onChange(f.name, e.target.value || null)} />
        {foot}
      </div>
    );
  }

  if (f.type === 'phone') {
    return (
      <div className={cls}>
        {label}
        <input id={id} type="tel" value={String(v)} readOnly={f.readOnly} placeholder="###-###-####"
          onChange={e => onChange(f.name, e.target.value || null)} />
        {foot}
      </div>
    );
  }

  if (f.type === 'multiline' || (f.maxLength ?? 0) >= 200) {
    return (
      <div className={`${cls} wide`}>
        {label}
        <textarea id={id} value={String(v)} readOnly={f.readOnly} maxLength={f.maxLength || undefined} rows={3}
          onChange={e => onChange(f.name, e.target.value || null)} />
        {foot}
      </div>
    );
  }

  return (
    <div className={cls}>
      {label}
      <input id={id} type="text" value={String(v)} readOnly={f.readOnly} maxLength={f.maxLength || undefined}
        onChange={e => onChange(f.name, e.target.value || null)} />
      {foot}
    </div>
  );
}
