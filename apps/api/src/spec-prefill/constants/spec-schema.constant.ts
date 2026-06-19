/**
 * Esquema de respuesta de Gemini para la extracción de especificaciones.
 * Fuente única compartida por todas las estrategias de prellenado (DRY).
 * Usa el formato de tipos de la API de Gemini (MAYÚSCULAS: STRING/OBJECT/ARRAY)
 * y la clave 'partNumber' (idioma del prompt); el mapeo a 'numeroParte'
 * ocurre en cada estrategia.
 */

/** Categorías permitidas para el campo 'formato'. */
const FORMATO_VALUES = [
  'Laptop',
  'Desktop',
  'Workstation',
  'Monitor',
  'Tablet',
  'Accesorio',
];

/** Propiedades de un equipo que Gemini debe devolver. */
const SPEC_PROPERTIES = {
  fabricante: { type: 'STRING' },
  partNumber: { type: 'STRING' },
  formato: {
    type: 'STRING',
    enum: FORMATO_VALUES,
    description: 'Tipo de equipo (obligatorio).',
  },
  modelo: {
    type: 'STRING',
    description:
      'Nombre comercial completo del equipo. Incluye siempre la generaci\u00f3n si est\u00e1 presente (ej. Gen 8 o G3); nunca la omitas.',
  },
  procesador: { type: 'STRING' },
  sistemaOperativo: { type: 'STRING' },
  graficos: { type: 'STRING' },
  memoriaRam: { type: 'STRING' },
  almacenamiento: { type: 'STRING' },
  pantalla: { type: 'STRING' },
  network: { type: 'STRING' },
  seguridad: { type: 'STRING' },
  garantiaEquipo: { type: 'STRING' },
  garantiaBateria: { type: 'STRING' },
};

/** Campos obligatorios que Gemini siempre debe devolver. */
const REQUIRED_FIELDS = ['formato', 'modelo'];

/** Schema para estrategias que devuelven varios equipos (texto, Excel, PDF). */
export const SPEC_SCHEMA_ARRAY = {
  type: 'ARRAY',
  description: 'Lista de equipos extra\u00eddos de la fuente.',
  items: {
    type: 'OBJECT',
    properties: SPEC_PROPERTIES,
    required: REQUIRED_FIELDS,
  },
};

/** Schema para estrategias que devuelven un solo equipo (part number, HP). */
export const SPEC_SCHEMA_OBJECT = {
  type: 'OBJECT',
  properties: SPEC_PROPERTIES,
  required: REQUIRED_FIELDS,
};
