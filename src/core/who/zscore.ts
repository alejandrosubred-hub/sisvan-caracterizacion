import tables from './tables.json';

/**
 * Z-scores con los patrones de crecimiento OMS 2006 (0–60 meses), método LMS.
 * Equivale a ZSCORE("WHO CGS", indicador, medida, edad|longitud, sexo) de Epi Info 7.
 *
 * Tablas (L, M, S) mensuales / cada 0.5 cm, interpoladas linealmente.
 * Para los indicadores basados en peso (P/T, IMC/E) se aplica la restricción OMS:
 * por encima de +3 / por debajo de −3 el z se calcula linealmente con las curvas SD2 y SD3.
 */
type Row = [number, number, number, number]; // x, L, M, S
type TableName = 'wfl' | 'wfh' | 'lhfa' | 'bmifa' | 'hcfa';
export type Sex = 1 | 2; // 1 = masculino, 2 = femenino (como Sexo12)

const T = tables as unknown as Record<string, Row[]>;

function lms(name: TableName, sex: Sex, x: number): { L: number; M: number; S: number } | null {
  const rows = T[`${name}_${sex === 1 ? 'boys' : 'girls'}`];
  if (!rows || x < rows[0][0] || x > rows[rows.length - 1][0]) return null;
  let lo = 0, hi = rows.length - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (rows[mid][0] <= x) lo = mid; else hi = mid; }
  const a = rows[lo], b = rows[hi];
  if (a[0] === x || a === b) return { L: a[1], M: a[2], S: a[3] };
  const t = (x - a[0]) / (b[0] - a[0]);
  return { L: a[1] + t * (b[1] - a[1]), M: a[2] + t * (b[2] - a[2]), S: a[3] + t * (b[3] - a[3]) };
}

function sd(p: { L: number; M: number; S: number }, z: number): number {
  return p.L === 0 ? p.M * Math.exp(p.S * z) : p.M * Math.pow(1 + p.L * p.S * z, 1 / p.L);
}

function zFrom(p: { L: number; M: number; S: number }, y: number, restrict: boolean): number {
  const z = p.L === 0 ? Math.log(y / p.M) / p.S : (Math.pow(y / p.M, p.L) - 1) / (p.L * p.S);
  if (!restrict) return z;
  if (z > 3) return 3 + (y - sd(p, 3)) / (sd(p, 3) - sd(p, 2));
  if (z < -3) return -3 + (y - sd(p, -3)) / (sd(p, -2) - sd(p, -3));
  return z;
}

export function zWeightForLength(weightKg: number, lengthCm: number, sex: Sex): number | null {
  const p = lms('wfl', sex, lengthCm); return p ? zFrom(p, weightKg, true) : null;
}
export function zWeightForHeight(weightKg: number, heightCm: number, sex: Sex): number | null {
  const p = lms('wfh', sex, heightCm); return p ? zFrom(p, weightKg, true) : null;
}
export function zLengthHeightForAge(cm: number, ageMonths: number, sex: Sex): number | null {
  const p = lms('lhfa', sex, ageMonths); return p ? zFrom(p, cm, false) : null;
}
export function zBmiForAge(bmi: number, ageMonths: number, sex: Sex): number | null {
  const p = lms('bmifa', sex, ageMonths); return p ? zFrom(p, bmi, true) : null;
}
export function zHeadCircForAge(cm: number, ageMonths: number, sex: Sex): number | null {
  const p = lms('hcfa', sex, ageMonths); return p ? zFrom(p, cm, false) : null;
}

/**
 * Peso para la talla exactamente como lo hace el check code de Epi Info (sub DXMEN5):
 *  - < 24 meses: tabla peso/longitud con la longitud medida.
 *  - 24–60 meses: suma 0.7 cm a la talla y usa la tabla peso/longitud mientras talla <= 109.3;
 *    por encima usa la tabla peso/talla (los LMS que Epi Info tiene "quemados" son los de esa tabla).
 * Con mode='who' se usa directamente peso/talla a partir de los 24 meses (criterio OMS).
 */
export function zWeightForLengthHeight(weightKg: number, cm: number, ageMonths: number, sex: Sex,
  mode: 'epiinfo' | 'who' = 'epiinfo'): { z: number | null; lengthUsed: number } {
  if (ageMonths < 24) return { z: zWeightForLength(weightKg, cm, sex), lengthUsed: cm };
  if (mode === 'who') return { z: zWeightForHeight(weightKg, cm, sex), lengthUsed: cm };
  const adj = Math.round((cm + 0.7) * 10) / 10;
  if (cm <= 109.3) return { z: zWeightForLength(weightKg, adj, sex), lengthUsed: adj };
  // Epi Info tiene "quemadas" las filas de peso/talla de 0.5 en 0.5 cm, sin interpolar
  // (y el tramo 109.4–109.5 usa la fila de 109.0). Se replica tal cual.
  const row = cm < 109.5 ? 109.0 : Math.min(120, Math.floor(cm * 2) / 2);
  const p = lms('wfh', sex, row);
  return { z: p ? zFrom(p, weightKg, false) : null, lengthUsed: adj };
}
