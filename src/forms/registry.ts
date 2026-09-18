import type { FormDefinition } from '@/core/types';
import { menores5 } from './menores5';

/**
 * Las 5 "bases" de caracterización. Cada una se genera con scripts/build-schema.py
 * a partir de su .mdb/.prj y se traduce su check code a rules.ts.
 * Las que aún no están migradas aparecen deshabilitadas en el menú.
 */
export const forms: FormDefinition[] = [menores5];

export const plannedForms: { id: string; shortTitle: string }[] = [
  { id: 'recien_nacidos', shortTitle: 'Recién nacidos' },
  { id: 'gestantes', shortTitle: 'Gestantes' },
  { id: 'adultos', shortTitle: 'Adultos' },
  { id: 'bac', shortTitle: 'Búsquedas activas institucionales (BAC)' }
];

export const getForm = (id: string) => forms.find(f => f.id === id);
