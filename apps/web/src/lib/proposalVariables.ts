/**
 * Contexto de variables de propuesta para reemplazo de marcadores µ
 * en el contenido de las páginas del documento.
 */
export interface ProposalVariables {
    ciudad: string;
    fechaEmision: string;
    cliente: string;
    cotizacion: string;
    asunto: string;
    validez: string;
    /** Líneas de garantía generadas según marcas de los ítems */
    garantiaLines: string[];
}

/**
 * Mapa de marcadores µ simples (reemplazo de texto 1:1).
 * µGarantia NO está aquí porque requiere reemplazo estructural.
 */
const SIMPLE_MARKER_MAP: Record<string, keyof ProposalVariables> = {
    'µCiudad': 'ciudad',
    'µFechaEmision': 'fechaEmision',
    'µCLIENTE': 'cliente',
    'µCOT': 'cotizacion',
    'µAsunto': 'asunto',
    'µValidez': 'validez',
};

/**
 * Reemplaza los marcadores µ simples en una cadena de texto.
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
 * Construye un nodo bulletList de TipTap a partir de líneas de texto.
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
 * los marcadores µ en todos los nodos de texto.
 *
 * Manejo especial de µGarantia: el párrafo que lo contenga se
 * reemplaza por un bulletList con las líneas de garantía dinámicas.
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

    // Recorrer contenido hijo con manejo especial de µGarantia
    if (Array.isArray(result.content)) {
        const newContent: Record<string, unknown>[] = [];

        for (const child of result.content as Record<string, unknown>[]) {
            // Si este nodo contiene µGarantia, reemplazar con bulletList
            if (
                vars.garantiaLines.length > 0 &&
                nodeContainsText(child, 'µGarantia')
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
 * Reemplaza marcadores µ en una cadena HTML renderizada.
 * Maneja µGarantia convirtiéndolo a una lista HTML <ul>.
 */
export function replaceMarkersInHtml(html: string, vars: ProposalVariables): string {
    let result = replaceMarkers(html, vars);

    // Reemplazo estructural de µGarantia
    if (vars.garantiaLines.length > 0 && result.includes('µGarantia')) {
        const listItems = vars.garantiaLines.map(l => `<li>${l}</li>`).join('');
        const listHtml = `<ul>${listItems}</ul>`;
        // Reemplazar el párrafo entero que contiene µGarantia
        result = result.replace(/<p[^>]*>[^<]*µGarantia[^<]*<\/p>/g, listHtml);
        // Fallback: si no estaba dentro de <p>
        result = result.replaceAll('µGarantia', listHtml);
    }

    return result;
}

// ── Date helpers ────────────────────────────────────────────────

/**
 * Formatea una fecha ISO (YYYY-MM-DD) a formato legible en español colombiano.
 * Ejemplo: "2026-03-29" → "29 de marzo de 2026"
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

const LENOVO_LINE = 'Para recibir atención de garantías y soporte técnico de soluciones de la marca Lenovo comuníquese con la línea de atención 01-800-917-0541';
const DELL_LINE = 'Para recibir atención de garantías y soporte técnico de soluciones de la marca Dell comuníquese con la línea de atención 01-800-915-5704';
const GENERAL_LINE = 'Para recibir atención de garantías y soporte técnico de soluciones de otras marcas ofrecidas, soluciones de Novotechno y sus compañías asociadas comuníquese con su ejecutivo comercial a las líneas: Medellín 604 4440731 o Bogotá 601 7552549.';

/**
 * Genera las líneas de garantía según las marcas presentes en los ítems.
 *
 * - Si hay ítems Lenovo → línea Lenovo + línea general
 * - Si hay ítems Dell → línea Dell + línea general
 * - Si hay ambos → Lenovo + Dell + general
 * - Si no hay ninguno → solo línea general
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
