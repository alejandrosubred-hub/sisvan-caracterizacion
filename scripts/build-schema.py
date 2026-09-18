#!/usr/bin/env python3
"""
Genera el esquema de un formulario Epi Info 7 (.mdb) para la app web.

Uso:
  python3 scripts/build-schema.py \
      --mdb  FormulariosCaracterizacionSISVAN.mdb \
      --view AltNutMen5 \
      --resultado resultado.xlsx \
      --out  src/forms/menores5

Produce en --out:
  schema.json   páginas -> secciones -> campos (tipo, prompt, requerido, rango, patrón, fuente de valores legales)
  codes.json    tablas de valores legales (codeXXX) usadas por la vista
  columns.json  orden exacto de columnas del Excel de salida (desde resultado.xlsx)
  checkcode.txt check code original de la vista, para traducirlo a rules.ts

Requiere: pip install access-parser openpyxl
"""
import argparse, json, re, sys
from access_parser import AccessParser
import openpyxl

FIELD_TYPES = {1:'text',2:'label',3:'text',4:'multiline',5:'number',6:'phone',7:'date',8:'time',9:'datetime',
               10:'checkbox',11:'yesno',12:'option',13:'button',14:'image',15:'mirror',16:'grid',17:'legal',
               18:'codes',19:'commentlegal',20:'relate',21:'group',27:'list'}
NOT_STORED = {'label','button','mirror','group','image','relate'}

def col(tb, name, i, default=None):
    v = tb.get(name)
    if v is None or i >= len(v): return default
    x = v[i]
    if x is None or (isinstance(x,float) and x!=x) or (isinstance(x,str) and x.strip()=='' ): return default
    return x

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--mdb', required=True); ap.add_argument('--view', required=True)
    ap.add_argument('--resultado'); ap.add_argument('--out', required=True)
    a = ap.parse_args()
    import os; os.makedirs(a.out, exist_ok=True)
    db = AccessParser(a.mdb)

    views = db.parse_table('metaViews')
    vi = views['Name'].index(a.view)
    view_id = views['ViewId'][vi]
    open(f'{a.out}/checkcode.txt','w',encoding='utf-8').write(views['CheckCode'][vi] or '')

    pages = db.parse_table('metaPages')
    page_rows = sorted([(pages['Position'][i], pages['PageId'][i], pages['Name'][i])
                        for i in range(len(pages['PageId'])) if pages['ViewId'][i]==view_id])

    mf = db.parse_table('metaFields'); n = len(mf['FieldId'])
    fields = []
    for i in range(n):
        if col(mf,'ViewId',i) != view_id: continue
        ft = FIELD_TYPES.get(col(mf,'FieldTypeId',i), 'text')
        f = dict(name=col(mf,'Name',i), type=ft, prompt=(col(mf,'PromptText',i) or '').strip(),
                 page=col(mf,'PageId',i), tab=col(mf,'TabIndex',i,0) or 0,
                 top=float(col(mf,'ControlTopPositionPercentage',i,0) or 0),
                 left=float(col(mf,'ControlLeftPositionPercentage',i,0) or 0),
                 width=float(col(mf,'ControlWidthPercentage',i,0) or 0),
                 required=bool(col(mf,'IsRequired',i,False)), readOnly=bool(col(mf,'IsReadOnly',i,False)),
                 repeatLast=bool(col(mf,'ShouldRepeatLast',i,False)))
        lo, up = col(mf,'Lower',i), col(mf,'Upper',i)
        if lo is not None and up is not None and ft=='number': f['range']=[float(lo),float(up)]
        pat = col(mf,'Pattern',i)
        if pat and pat not in ('Vertical,Left','Horizontal,Left'): f['pattern']=str(pat)
        if pat in ('Vertical,Left','Horizontal,Left'): f['layout']='horizontal' if pat.startswith('Horizontal') else 'vertical'
        ml = col(mf,'MaxLength',i)
        if ml: f['maxLength']=int(ml)
        st, tc = col(mf,'SourceTableName',i), col(mf,'TextColumnName',i)
        if st: f['source']=st; f['sourceColumn']=tc
        lst = col(mf,'List',i)
        if lst:
            if ft=='group': f['members']=[s for s in str(lst).split(',') if s]
            else: f['options']=[s for s in str(lst).split('||')[0].split(',')]
        if ft=='mirror':
            src = col(mf,'SourceFieldId',i)
            if src is not None:
                try: j = mf['FieldId'].index(src); f['mirrorOf']=mf['Name'][j]
                except ValueError: pass
        fields.append(f)

    # ---- valores legales
    codes = {}
    for f in fields:
        st = f.get('source')
        if not st or st in codes: continue
        try:
            tb = db.parse_table(st)
        except Exception as e:
            print('WARN no pude leer', st, e, file=sys.stderr); continue
        cc = f.get('sourceColumn')
        key = cc if cc in tb else next((k for k in tb if k.lower()==str(cc).lower()), None) or next(iter(tb), None)
        vals = [str(v).strip() for v in (tb.get(key) or []) if v is not None and str(v).strip()!='']
        codes[st] = vals

    # ---- layout: páginas -> secciones (grupos Epi Info) -> campos en orden de tab
    by_name = {f['name']:f for f in fields}
    member_of = {}
    for g in fields:
        if g['type']=='group':
            for m in g.get('members',[]): member_of.setdefault(m, g['name'])
    schema_pages = []
    for pos, pid, pname in page_rows:
        pf = [f for f in fields if f['page']==pid and f['type']!='group']
        pf.sort(key=lambda f:(f['tab'], f['top'], f['left']))
        sections, emitted, loose = [], set(), []
        def flush_loose():
            nonlocal loose
            if loose: sections.append(dict(title='', fields=loose)); loose=[]
        for f in pf:
            g = member_of.get(f['name'])
            if g and g not in emitted:
                flush_loose(); emitted.add(g)
                members = [by_name[m] for m in by_name[g]['members'] if m in by_name and by_name[m]['type']!='group']
                # subgrupos anidados: grupos que son miembros de este grupo
                for m in by_name[g]['members']:
                    if m in by_name and by_name[m]['type']=='group' and m not in emitted:
                        emitted.add(m)
                members.sort(key=lambda x:(x['tab'], x['top'], x['left']))
                sections.append(dict(title=by_name[g]['prompt'], fields=members))
            elif not g and f['name'] not in [x['name'] for s in sections for x in s['fields']]:
                loose.append(f)
        flush_loose()
        clean = []
        for s in sections:
            fs = [{k:v for k,v in f.items() if k not in ('page','top','left','width','tab')} for f in s['fields']]
            clean.append(dict(title=s['title'], fields=fs))
        schema_pages.append(dict(name=pname, sections=clean))

    stored = [f['name'] for f in fields if f['type'] not in NOT_STORED]
    schema = dict(view=a.view, pages=schema_pages, storedFields=stored)
    json.dump(schema, open(f'{a.out}/schema.json','w',encoding='utf-8'), ensure_ascii=False, indent=1)
    json.dump(codes, open(f'{a.out}/codes.json','w',encoding='utf-8'), ensure_ascii=False, indent=0)

    if a.resultado:
        ws = openpyxl.load_workbook(a.resultado, read_only=True).worksheets[0]
        header = [c for c in next(ws.iter_rows(min_row=1,max_row=1,values_only=True)) if c]
        json.dump(header, open(f'{a.out}/columns.json','w',encoding='utf-8'), ensure_ascii=False, indent=0)
        missing = [c for c in header if c not in stored and c not in ('UniqueKey','GlobalRecordId','RecStatus','FKEY')]
        if missing: print('Columnas de resultado.xlsx sin campo en la vista:', missing, file=sys.stderr)
    print(f'OK: {len(fields)} campos, {len(stored)} almacenados, {len(codes)} tablas de códigos, {len(schema_pages)} páginas')

if __name__ == '__main__': main()
