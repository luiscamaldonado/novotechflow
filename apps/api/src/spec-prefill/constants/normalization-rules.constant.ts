/**
 * Reglas de normalización que se inyectan en el prompt de cada estrategia
 * para forzar un formato consistente en los campos extraídos por Gemini.
 */
export const NORMALIZATION_RULES = `
REGLAS DE NORMALIZACI\u00d3N ULTRA-ESTRICTAS (APLICA A TODOS LOS CAMPOS SIN EXCEPCI\u00d3N):
- 'memoriaRam': Formato "[Capacidad]GB/TB [Tipo]". ELIMINA velocidades (MHz, MT/s) y latencias. Ej: "16GB DDR5".
- 'almacenamiento': Formato "[Capacidad]GB/TB [Tipo]". ELIMINA conectores y factores de forma (M.2, PCIe, NVMe, Gen4). Ej: "512GB SSD". NUNCA devuelvas "512GB SSD M.2".
- 'procesador': Solo Marca, Familia y Modelo. ELIMINA n\u00facleos e hilos. Ej: "Intel Core Ultra 5 225U" o "AMD Ryzen AI 5 330".
- 'graficos': Si el texto original dice "UMA", "N/A", no menciona gr\u00e1ficos dedicados, o solo dice "Intel" o "AMD", DEBES devolver ESTRICTAMENTE "Integrados" o el nombre completo del chip integrado (Ej: "Intel UHD Graphics"). Mant\u00e9n nombres de dedicadas completos (Ej: "NVIDIA RTX 2000 ADA").
- 'sistemaOperativo': ESTRICTAMENTE "Windows 11 Pro" o "Windows 11 Home". ELIMINA "64", "64-bit", "Downgrade" o idiomas.
- 'garantiaEquipo': Traduce al ESPA\u00d1OL. Usa SIEMPRE min\u00fascula para "a\u00f1os" o "a\u00f1o". Resume eliminando texto innecesario. Usa SIEMPRE "Onsite" en lugar de "En el sitio" o "On site". NUNCA combines ambos. Ej: "3 a\u00f1os Onsite", "1 a\u00f1o b\u00e1sico", "3 a\u00f1os Premier Support".
`;
