import schema from './schema.json';
import codes from './codes.json';
import columns from './columns.json';
import type { FormDefinition, FormSchema } from '@/core/types';
import { applyRules, hiddenFields, warnings } from './rules';

export const menores5: FormDefinition = {
  id: 'menores5',
  title: 'Caracterización en seguridad alimentaria · Menores de 5 años',
  shortTitle: 'Menores de 5 años',
  schema: schema as FormSchema,
  codes: codes as Record<string, string[]>,
  exportColumns: columns as string[],
  applyRules, hiddenFields, warnings,
  titleField: 'NumeroIdenMenor',
  summaryFields: ['Nombre1', 'Apellido1', 'Fechadelavisita', 'EdadMeses', 'InterptretacionPTVisita', 'LocalidadVivienda']
};
