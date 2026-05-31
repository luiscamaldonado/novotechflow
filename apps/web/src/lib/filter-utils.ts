import { MULTI_VALUE_FILTER_SEPARATOR } from './constants';

/**
 * Parsea un input de filtro multivalor en una lista de términos normalizados.
 *
 * Separa por MULTI_VALUE_FILTER_SEPARATOR, recorta espacios, descarta
 * segmentos vacíos y normaliza a minúsculas para comparación case-insensitive.
 *
 * @example
 * parseMultiValueFilter('SURA; ARGOS;') // ['sura', 'argos']
 * parseMultiValueFilter('   ')          // []
 */
export function parseMultiValueFilter(input: string): string[] {
  return input
    .split(MULTI_VALUE_FILTER_SEPARATOR)
    .map((term) => term.trim().toLowerCase())
    .filter((term) => term.length > 0);
}

/**
 * Determina si un valor coincide con alguno de los términos de búsqueda (OR).
 *
 * Un arreglo de términos vacío significa "sin filtro" y siempre retorna true.
 * En caso contrario retorna true cuando el valor contiene al menos un término
 * como substring. Los términos ya vienen en minúsculas desde
 * parseMultiValueFilter; el valor se normaliza aquí.
 *
 * @example
 * matchesAnyTerm('Seguros SURA S.A.', ['sura'])          // true
 * matchesAnyTerm('Cementos Argos',    ['sura', 'argos']) // true
 * matchesAnyTerm('Nutresa',           [])                // true  (sin filtro)
 */
export function matchesAnyTerm(value: string, terms: string[]): boolean {
  if (terms.length === 0) return true;
  const haystack = value.toLowerCase();
  return terms.some((term) => haystack.includes(term));
}
