/** Tipos de campo tal como los define Epi Info 7 (metaFieldTypes). */
export type FieldType =
  | 'text' | 'multiline' | 'number' | 'phone' | 'date' | 'time' | 'datetime'
  | 'checkbox' | 'yesno' | 'option' | 'legal' | 'codes' | 'commentlegal' | 'list'
  | 'label' | 'mirror' | 'button' | 'image' | 'grid' | 'relate';

export interface FieldDef {
  name: string;
  type: FieldType;
  prompt: string;
  required?: boolean;
  readOnly?: boolean;
  repeatLast?: boolean;        // "Repeat Last": arrastra el valor del registro anterior
  range?: [number, number];    // RANGE [lo, hi]
  pattern?: string;            // ##.#, YYYY-MM-DD, ###-###-####
  maxLength?: number;
  layout?: 'horizontal' | 'vertical';
  source?: string;             // tabla codeXXX de valores legales
  sourceColumn?: string;
  options?: string[];          // campos Option (radio) — se guarda el índice 0-based
  mirrorOf?: string;
}

export interface SectionDef { title: string; fields: FieldDef[] }
export interface PageDef { name: string; sections: SectionDef[] }
export interface FormSchema { view: string; pages: PageDef[]; storedFields: string[] }

/** Un registro = una "hoja" de Epi Info, plano, con las mismas columnas del Excel. */
export type FieldValue = string | number | null;
export interface RecordData { [field: string]: FieldValue }

export type SyncState = 'pending' | 'synced' | 'conflict';

export interface StoredRecord {
  GlobalRecordId: string;      // GUID como en Epi Info
  UniqueKey: number;           // consecutivo local
  RecStatus: 1 | 0;            // 1 = activo, 0 = eliminado (igual que Epi Info)
  formId: string;              // 'menores5' | 'recien_nacidos' | ...
  data: RecordData;
  createdAt: string;           // ISO
  updatedAt: string;           // ISO
  updatedBy?: string;
  _sync: SyncState;
}

/** Definición de una "base" (una de las 5). */
export interface FormDefinition {
  id: string;
  title: string;
  shortTitle: string;
  schema: FormSchema;
  codes: Record<string, string[]>;
  exportColumns: string[];
  /** Traducción del check code: recalcula campos derivados. */
  applyRules: (d: RecordData) => RecordData;
  /** Traducción de HIDE/UNHIDE: nombres de campos ocultos para este registro. */
  hiddenFields: (d: RecordData) => Set<string>;
  /** Traducción de HIGHLIGHT / DIALOG: mensajes de advertencia por campo. */
  warnings: (d: RecordData) => Record<string, string>;
  /** Campo que se muestra como "DOCUMENTO DEL MENOR" en la cabecera. */
  titleField: string;
  summaryFields: string[];
}
