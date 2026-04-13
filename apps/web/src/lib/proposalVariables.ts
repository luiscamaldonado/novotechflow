/**
 * Contexto de variables de propuesta para reemplazo de marcadores
 * en el contenido de las paginas del documento.
 *
 * Encoding note: all non-ASCII characters in runtime strings use
 * Unicode escapes (\uXXXX) to prevent UTF-16 LE corruption when
 * compiled inside Docker/Alpine (which assumes UTF-8).
 */
export interface ProposalVariables {
    ciudad: string;
    fechaEmision: string;
    cliente: string;
    cotizacion: string;
    asunto: string;
    validez: string;
    /** Lineas de garantia generadas segun marcas de los items */
    garantiaLines: string[];
}

/** Unicode escape for the micro sign used as marker prefix */
const MU = '\u00b5'; // µ

/**
 * Mapa de marcadores simples (reemplazo de texto 1:1).
 * El marcador de Garantia NO esta aqui porque requiere reemplazo estructural.
 */
const SIMPLE_MARKER_MAP: Record<string, keyof ProposalVariables> = {
    [`${MU}Ciudad`]: 'ciudad',
    [`${MU}FechaEmision`]: 'fechaEmision',
    [`${MU}CLIENTE`]: 'cliente',
    [`${MU}COT`]: 'cotizacion',
    [`${MU}Asunto`]: 'asunto',
    [`${MU}Validez`]: 'validez',
};

/** Marker string for warranty replacement */
const GARANTIA_MARKER = `${MU}Garantia`;

/**
 * Reemplaza los marcadores simples en una cadena de texto.
 */
export function replaceMarkers(text: string, vars: ProposalVariables): string {
    let result = text;
    for (const [marker, key] of Object.entries(SIMPLE_MARKER_MAP)) {
        const value = vars[key];
        if (typeof value === 'string' && value) {
            result = result.replaceAll(marker, value);
        }
    }
    return result;
}

// ── TipTap JSON helpers ─────────────────────────────────────────

/**
 * Comprueba recursivamente si un nodo TipTap contiene el texto indicado.
 */
function nodeContainsText(node: Record<string, unknown>, text: string): boolean {
    if (node.type === 'text' && typeof node.text === 'string') {
        return node.text.includes(text);
    }
    if (Array.isArray(node.content)) {
        return node.content.some((c: Record<string, unknown>) => nodeContainsText(c, text));
    }
    return false;
}

/**
 * Construye un nodo bulletList de TipTap a partir de lineas de texto.
 */
function buildTiptapBulletList(lines: string[]): Record<string, unknown> {
    return {
        type: 'bulletList',
        content: lines.map(line => ({
            type: 'listItem',
            content: [{
                type: 'paragraph',
                content: [{ type: 'text', text: line }],
            }],
        })),
    };
}

/**
 * Recorre recursivamente un documento TipTap JSON y reemplaza
 * los marcadores en todos los nodos de texto.
 *
 * Manejo especial de Garantia: el parrafo que lo contenga se
 * reemplaza por un bulletList con las lineas de garantia dinamicas.
 *
 * Retorna un nuevo objeto (no muta el original).
 */
export function replaceMarkersInTiptapJson(
    doc: Record<string, unknown>,
    vars: ProposalVariables,
): Record<string, unknown> {
    if (!doc || typeof doc !== 'object') return doc;

    const result: Record<string, unknown> = { ...doc };

    // Si es un nodo de texto, reemplazar marcadores simples
    if (result.type === 'text' && typeof result.text === 'string') {
        result.text = replaceMarkers(result.text, vars);
    }

    // Recorrer contenido hijo con manejo especial de Garantia
    if (Array.isArray(result.content)) {
        const newContent: Record<string, unknown>[] = [];

        for (const child of result.content as Record<string, unknown>[]) {
            if (
                vars.garantiaLines.length > 0 &&
                nodeContainsText(child, GARANTIA_MARKER)
            ) {
                newContent.push(buildTiptapBulletList(vars.garantiaLines));
            } else {
                newContent.push(replaceMarkersInTiptapJson(child, vars));
            }
        }

        result.content = newContent;
    }

    return result;
}

// ── HTML helpers ────────────────────────────────────────────────

/**
 * Reemplaza marcadores en una cadena HTML renderizada.
 * Maneja Garantia convirtiendolo a una lista HTML <ul>.
 */
export function replaceMarkersInHtml(html: string, vars: ProposalVariables): string {
    let result = replaceMarkers(html, vars);

    // Reemplazo estructural del marcador de garantia
    if (vars.garantiaLines.length > 0 && result.includes(GARANTIA_MARKER)) {
        const listItems = vars.garantiaLines.map(l => `<li>${l}</li>`).join('');
        const listHtml = `<ul>${listItems}</ul>`;
        // Reemplazar el parrafo entero que contiene el marcador
        const escapedMarker = GARANTIA_MARKER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const paragraphRegex = new RegExp(`<p[^>]*>[^<]*${escapedMarker}[^<]*<\\/p>`, 'g');
        result = result.replace(paragraphRegex, listHtml);
        // Fallback: si no estaba dentro de <p>
        result = result.replaceAll(GARANTIA_MARKER, listHtml);
    }

    return result;
}

// ── Date helpers ────────────────────────────────────────────────

/**
 * Formatea una fecha ISO (YYYY-MM-DD) a formato legible en espanol colombiano.
 * Ejemplo: "2026-03-29" -> "29 de marzo de 2026"
 */
export function formatDateSpanish(isoDate: string): string {
    if (!isoDate) return '';
    try {
        const date = new Date(isoDate + 'T12:00:00');
        return date.toLocaleDateString('es-CO', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        });
    } catch {
        return isoDate;
    }
}

// ── Brand-based warranty logic ──────────────────────────────────

/* eslint-disable max-len */
const LENOVO_LINE = 'Para recibir atenci\u00f3n de garant\u00edas y soporte t\u00e9cnico de soluciones de la marca Lenovo comun\u00edquese con la l\u00ednea de atenci\u00f3n 01-800-917-0541';
const DELL_LINE = 'Para recibir atenci\u00f3n de garant\u00edas y soporte t\u00e9cnico de soluciones de la marca Dell comun\u00edquese con la l\u00ednea de atenci\u00f3n 01-800-915-5704';
const GENERAL_LINE = 'Para recibir atenci\u00f3n de garant\u00edas y soporte t\u00e9cnico de soluciones de otras marcas ofrecidas, soluciones de Novotechno y sus compa\u00f1\u00edas asociadas comun\u00edquese con su ejecutivo comercial a las l\u00edneas: Medell\u00edn 604 4440731 o Bogot\u00e1 601 7552549.';
/* eslint-enable max-len */

/**
 * Genera las lineas de garantia segun las marcas presentes en los items.
 *
 * - Si hay items Lenovo -> linea Lenovo + linea general
 * - Si hay items Dell -> linea Dell + linea general
 * - Si hay ambos -> Lenovo + Dell + general
 * - Si no hay ninguno -> solo linea general
 */
export function buildGarantiaLines(
    items: Array<{ brand?: string; technicalSpecs?: { fabricante?: string } }>,
): string[] {
    const brands = items
        .flatMap(item => [item.brand || '', item.technicalSpecs?.fabricante || ''])
        .map(b => b.toLowerCase().trim())
        .filter(Boolean);

    const hasLenovo = brands.some(b => b.includes('lenovo'));
    const hasDell = brands.some(b => b.includes('dell'));

    const lines: string[] = [];
    if (hasLenovo) lines.push(LENOVO_LINE);
    if (hasDell) lines.push(DELL_LINE);
    lines.push(GENERAL_LINE);

    return lines;
}
