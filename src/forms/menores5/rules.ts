import type { RecordData, FieldValue } from '@/core/types';
import { zWeightForLengthHeight, zLengthHeightForAge, zBmiForAge, zHeadCircForAge, type Sex } from '@/core/who/zscore';

/**
 * Traducción 1:1 del Check Code de la vista AltNutMen5 (FormulariosCaracterizacionSISVAN.prj).
 * Cada bloque indica el "Field ... After" original. Ver checkcode.txt en esta carpeta.
 */

const num = (v: FieldValue): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
const str = (v: FieldValue): string => (v === null || v === undefined ? '' : String(v).trim());
const r2 = (n: number) => Math.round(n * 100) / 100;          // FORMAT(..., "Fixed") → 2 decimales
const r1 = (n: number) => Math.round(n * 10) / 10;

function daysBetween(a: string, b: string): number | null {
  const da = Date.parse(a + 'T00:00:00Z'), dbb = Date.parse(b + 'T00:00:00Z');
  if (Number.isNaN(da) || Number.isNaN(dbb)) return null;
  return Math.round((da - dbb) / 86400000);
}

/** Modo de cálculo P/T: 'epiinfo' reproduce exactamente el check code; 'who' usa peso/talla desde 24 m. */
export const ZSCORE_MODE: 'epiinfo' | 'who' = 'epiinfo';

export function applyRules(input: RecordData): RecordData {
  const d: RecordData = { ...input };

  // ---- Field Fechadelavisita: EdadMeses = ((visita - nacimiento) + 1) / 30.44
  const fn = str(d.FechadeNacimiento), fv = str(d.Fechadelavisita);
  const dias = fn && fv ? daysBetween(fv, fn) : null;
  d.EdadMeses = dias === null ? null : r1((dias + 1) / 30.44);
  const edad = num(d.EdadMeses);

  // ---- Field FIES8DejadodeComer1dia: ResultadoFIES, InterpretacionFIES, NivelINSAN
  const fies = ['FIES1Preocupado', 'FIES2PodidoComer', 'FIES3PocaVariedad', 'FIES4Saltarse1comida',
    'FIES5ComidoMenos', 'FIES6HogarSinAlimentos', 'FIES7SentidoHambre', 'FIES8DejadodeComer1dia'].map(k => num(d[k]));
  if (fies.every(x => x !== null)) {
    const f = fies as number[];
    const total = f.reduce((a, b) => a + b, 0);
    d.ResultadoFIES = total;
    d.InterpretacionFIES = total === 0 ? 'Hogar Seguro, Sin ISAH' : 'Con Inseguridad Alimentaria en el Hogar';
    let nivel = '';
    if (f[0] > 0 || f[1] > 0 || f[2] > 0) nivel = 'Leve';
    if (f[3] > 0 || f[4] > 0 || f[5] > 0) nivel = 'Moderada';
    if (f[6] > 0 || f[7] > 0) nivel = 'Severa';
    d.NivelINSAN = total === 0 ? '' : nivel;
  } else {
    d.ResultadoFIES = null; d.InterpretacionFIES = ''; d.NivelINSAN = '';
  }

  // ---- Field TallaLongitudencm + Sub DXMEN5 (antropometría del menor)
  const peso = num(d.PesoActualKg), talla = num(d.TallaLongitudencm);
  const sexo = num(d.Sexo12) as Sex | null;
  d.IMCActual = peso && talla ? r1(peso / ((talla * 0.01) * (talla * 0.01))) : null;
  const imc = num(d.IMCActual);

  let zPT: number | null = null, zTE: number | null = null, zIMC: number | null = null, tallaAjustada: number | null = null;
  if (edad !== null && edad >= 0 && edad < 60 && sexo && talla && talla > 0) {
    if (peso && peso > 0) {
      const res = zWeightForLengthHeight(peso, talla, edad, sexo, ZSCORE_MODE);
      zPT = res.z; tallaAjustada = edad >= 24 ? res.lengthUsed : talla;
    }
    zTE = zLengthHeightForAge(talla, edad, sexo);   // <24 m usa longitud (LgthAge), ≥24 m talla (HtAge)
    if (imc && peso && peso > 0) zIMC = zBmiForAge(imc, edad, sexo);
  }
  d.TALLALONGITUD2 = tallaAjustada;
  d.ZSocrePTActual = zPT === null ? null : r2(zPT);
  d.ZScoreTEAct = zTE === null ? null : r2(zTE);
  d.ZScoreIMCEVistia = zIMC === null ? null : r2(zIMC);

  const zpt = num(d.ZSocrePTActual);
  d.InterptretacionPTVisita =
    zpt === null ? '' :
    zpt < -3 ? 'DESNUTRICION AGUDA SEVERA' :
    zpt < -2 ? 'DESNUTRICION AGUDA MODERADA' :
    zpt < -1 ? 'RIESGO DE DESNUTRICION AGUDA' :
    zpt <= 1 ? 'PESO ADECUADO PARA LA TALLA' :
    zpt <= 2 ? 'RIESGO DE SOBREPESO' :
    zpt <= 3 ? 'SOBREPESO' : 'OBESIDAD';

  const zte = num(d.ZScoreTEAct);
  d.InterpretacionTEVisita =
    zte === null ? '' :
    zte < -2 ? 'TALLA BAJA PARA LA EDAD' :
    zte < -1 ? 'RIESGO DE TALLA BAJA' : 'TALLA ADECUADA PARA LA EDAD';

  const zimc = num(d.ZScoreIMCEVistia);
  d.InterpretacionIMCEViista =
    zimc === null ? '' :
    zimc <= 1 ? '*NO APLICA' :
    zimc <= 2 ? 'RIESGO DE SOBREPESO' :
    zimc <= 3 ? 'SOBREPESO' : 'OBESIDAD';

  // ---- Field Perimetrocefalico
  const pc = num(d.Perimetrocefalico);
  const zPC = pc && pc > 0 && edad !== null && edad >= 0 && edad < 60 && sexo ? zHeadCircForAge(pc, edad, sexo) : null;
  d.ZScorePCEAct = zPC === null ? null : r2(zPC);
  const zpc = num(d.ZScorePCEAct);
  d.InterpretacionPCEVisita =
    zpc === null ? '' :
    zpc < -2 ? 'FACTOR DE RIESGO PARA EL NEURO DESARROLLO MICRO' :
    zpc <= 2 ? 'PERIMETRO CEFALICO ADECUADO PARA LA EDAD' : 'FACTOR DE RIESGO PARA EL NEURO DESARROLLO MACRO';

  // ---- Field Perimetrodelbrazo
  const pb = num(d.Perimetrodelbrazo);
  d.InterpretacionPerimetrodelBrazoVisita =
    pb === null || edad === null ? '' :
    edad < 6 ? 'NO APLICA EN MENOR DE 6MESES' :
    edad > 6 ? (pb < 11.5 ? 'RIESGO DE MUERTE POR DNT' : 'NEGATIVO PARA TAMIZAJE') : '';

  // ---- Field TallaAdulto / EdadCuidador2 / PerimetroCintura (11.1 madre o cuidador)
  const pa = num(d.PesoAdultokg), ta = num(d.TallaAdulto);
  d.IMCAdulto = pa && ta ? r1(pa / ((ta * 0.01) * (ta * 0.01))) : null;
  const imcA = num(d.IMCAdulto), edadA = num(d.EdadCuidador2);
  d.InterpIMCEAdulto =
    imcA === null || edadA === null || edadA < 18 ? '' :
    imcA < 18.5 ? '1. Delgadez' :
    imcA <= 25 ? '2. IMC Normal' :
    imcA <= 30 ? '3. Sobrepeso' : '4. Obesidad';

  const cint = num(d.PerimetroCintura), sexA = str(d.SexoAdulto);
  d.InterpretacionCcinturaAdulto =
    cint === null || !sexA ? '' :
    sexA === 'M' ? (cint >= 90 ? 'Obesidad Abdominal' : 'Sin Obesidad Abdominal') :
    sexA === 'F' ? (cint >= 80 ? 'Obesidad Abdominal' : 'Sin Obesidad Abdominal') : '';

  return d;
}

/** HIDE / UNHIDE del check code. */
export function hiddenFields(d: RecordData): Set<string> {
  const h = new Set<string>(['TALLALONGITUD2']);
  const show = (cond: boolean, ...fields: string[]) => { if (!cond) fields.forEach(f => h.add(f)); };
  show(str(d.ServicioIdentif) === '5. Otro', 'Cualotroservicio');
  show(str(d.PertenenciaEtnica) === '6 Indigena', 'PuebloIndigena');
  show(str(d.ConservacionAlimentos) === 'Otro', 'CualotroConservacion');
  show(str(d.AntPatologicos) === 'Otra', 'Otroantecedentemdico');
  show(str(d.Hatenidohospitalicx) === 'Si', 'MotivoHospCx');
  show(str(d.VinculacinaProgramasSociales) === '5. Otro', 'CualotroProgSocial');
  show(str(d.ProgramPrimerainf) === 'Si', 'NombreInstprog1inf');
  show(str(d.Intolerancia) === 'Si', 'CaulIntolerancialim');
  show(str(d.Tienebarrerasdeacce) === 'Si', 'CualesBarreras');
  show(str(d.activacinderuta) === 'Si', 'EntidadalaqueseCanaliz', 'CualotrEntidad');
  return h;
}

/** DIALOG / HIGHLIGHT del check code, como advertencias por campo. */
export function warnings(d: RecordData): Record<string, string> {
  const w: Record<string, string> = {};
  const edad = num(d.EdadMeses);
  if (edad !== null && edad < 0) w.FechadeNacimiento = 'Revise las fechas: la edad no puede ser negativa.';
  if (edad !== null && edad > 60) w.EdadMeses = 'Revise las fechas: solo menores de 5 años (< 60 meses).';
  const zpt = num(d.ZSocrePTActual);
  if (zpt !== null && zpt < -2) w.InterptretacionPTVisita = 'Desnutrición aguda: active la ruta de atención.';
  return w;
}
