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
 * Extrae todo el texto plano de un nodo TipTap recursivamente.
 */
function extractText(node: Record<string, unknown>): string {
    if (node.type === 'text' && typeof node.text === 'string') {
        return node.text;
    }
    if (Array.isArray(node.content)) {
        return node.content.map((c: Record<string, unknown>) => extractText(c)).join('');
    }
    return '';
}


/**
 * Comprueba si un nodo es un heading (cualquier nivel).
 */
function isHeading(node: Record<string, unknown>): boolean {
    return node.type === 'heading';
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
 * Comprueba si un nodo contiene texto bold que coincide con el patrón (al inicio del nodo).
 * El heading puede ser:
 * - Un heading node (h1-h6)
 * - Un párrafo cuyo PRIMER texto es bold y contiene el patrón
 *   (el resto del párrafo puede tener texto normal tras un hardBreak)
 */
function nodeStartsWithBoldText(node: Record<string, unknown>, pattern: RegExp): boolean {
    if (isHeading(node)) {
        return pattern.test(extractText(node));
    }

    if (node.type === 'paragraph' && Array.isArray(node.content)) {
        const children = node.content as Record<string, unknown>[];
        if (children.length === 0) return false;

        // El primer hijo debe ser un texto con marca bold que coincida con el patrón
        const first = children[0];
        if (first.type === 'text' && typeof first.text === 'string') {
            const marks = first.marks as Array<{ type: string }> | undefined;
            const isBold = marks?.some((m) => m.type === 'bold');
            if (isBold && pattern.test(first.text)) return true;
        }
    }
    return false;
}

/**
 * Busca la sección "GARANTÍA Y SOPORTE" en el doc e inyecta las viñetas
 * de garantía dinámicas al final de esa sección.
 *
 * La estructura TipTap observada en la plantilla es:
 *   paragraph → [text(bold:"GARANTÍA Y SOPORTE."), hardBreak, text(...)]
 *   paragraph → [text(body...)]
 *   ...
 *   bulletList → [listItem → para("Lenovo..."), listItem → para("Dell..."), ...]
 *   paragraph → [text(bold:"DISPONIBILIDAD Y ENTREGA"), ...]
 *
 * Algoritmo:
 * 1. Encontrar el párrafo que comienza con bold "GARANTÍA Y SOPORTE"
 * 2. Buscar hacia adelante cualquier bulletList con texto de garantía/soporte
 * 3. Remover esos bulletLists estáticos
 * 4. Insertar el nuevo bulletList dinámico en la posición del primero que se removió,
 *    o al final de la sección si no se encontró ninguno existente
 */
function injectGarantiaIntoSection(
    contentNodes: Record<string, unknown>[],
    garantiaLines: string[],
): Record<string, unknown>[] {
    // 1. Buscar el párrafo con "GARANTÍA Y SOPORTE"
    const sectionPattern = /garant[ií]a\s+y\s+soporte/i;
    let sectionIdx = -1;

    for (let i = 0; i < contentNodes.length; i++) {
        if (nodeStartsWithBoldText(contentNodes[i], sectionPattern)) {
            sectionIdx = i;
            break;
        }
    }

    if (sectionIdx === -1) return contentNodes;

    // 2. Buscar el final de la sección:
    //    el siguiente nodo que sea un heading o un párrafo que empiece con bold corto
    //    (indicando que es otro título de sección)
    const boldTitlePattern = /^[A-ZÁÉÍÓÚÑ\s.,]+$/; // All-caps text = section title
    let sectionEndIdx = contentNodes.length;
    for (let i = sectionIdx + 1; i < contentNodes.length; i++) {
        const node = contentNodes[i];
        if (isHeading(node)) {
            sectionEndIdx = i;
            break;
        }
        // Detectar otro título bold all-caps (como "DISPONIBILIDAD Y ENTREGA")
        if (node.type === 'paragraph' && Array.isArray(node.content)) {
            const children = node.content as Record<string, unknown>[];
            if (children.length > 0) {
                const first = children[0];
                if (first.type === 'text' && typeof first.text === 'string') {
                    const marks = first.marks as Array<{ type: string }> | undefined;
                    const isBold = marks?.some((m) => m.type === 'bold');
                    if (isBold && boldTitlePattern.test(first.text.trim()) && first.text.trim().length < 80) {
                        // Es otro título de sección, no es "GARANTÍA Y SOPORTE" (ya lo encontramos)
                        if (i !== sectionIdx) {
                            sectionEndIdx = i;
                            break;
                        }
                    }
                }
            }
        }
    }

    // 3. Dentro de la sección, buscar y marcar bulletLists de garantía para remover
    const newContent = [...contentNodes];
    const indicesToRemove: number[] = [];

    for (let i = sectionIdx + 1; i < sectionEndIdx; i++) {
        const node = newContent[i];
        if (node.type === 'bulletList') {
            const text = extractText(node).toLowerCase();
            if (
                text.includes('garantía') ||
                text.includes('garantia') ||
                text.includes('soporte técnico') ||
                text.includes('soporte tecnico') ||
                text.includes('novotechno')
            ) {
                indicesToRemove.push(i);
            }
        }
    }

    // 4. Remover en orden inverso
    for (let i = indicesToRemove.length - 1; i >= 0; i--) {
        newContent.splice(indicesToRemove[i], 1);
        if (sectionEndIdx > indicesToRemove[i]) sectionEndIdx--;
    }

    // 5. Insertar el nuevo bulletList dinámico
    //    Si había un bulletList que removimos, insertar en la posición del primero;
    //    si no, insertar al final de la sección
    const insertIdx = indicesToRemove.length > 0 ? indicesToRemove[0] : sectionEndIdx;
    const bulletList = buildTiptapBulletList(garantiaLines);
    newContent.splice(insertIdx, 0, bulletList);

    return newContent;
}

/**
 * Recorre recursivamente un documento TipTap JSON y reemplaza
 * los marcadores µ en todos los nodos de texto.
 *
 * También inserta automáticamente las viñetas de garantía al final
 * de la sección "GARANTÍA Y SOPORTE" si existe.
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

    // Recorrer contenido hijo
    if (Array.isArray(result.content)) {
        let newContent = (result.content as Record<string, unknown>[]).map(
            (child) => replaceMarkersInTiptapJson(child, vars),
        );

        // Si estamos en el nodo raíz (type === 'doc'), inyectar garantía
        if (result.type === 'doc' && vars.garantiaLines.length > 0) {
            newContent = injectGarantiaIntoSection(newContent, vars.garantiaLines);
        }

        result.content = newContent;
    }

    return result;
}

// ── HTML helpers ────────────────────────────────────────────────

/**
 * Reemplaza marcadores µ en una cadena HTML renderizada.
 * También inyecta las viñetas de garantía después de la sección
 * "GARANTÍA Y SOPORTE" si existe.
 */
export function replaceMarkersInHtml(html: string, vars: ProposalVariables): string {
    let result = replaceMarkers(html, vars);

    // Inyección automática de garantía en sección "GARANTÍA Y SOPORTE"
    if (vars.garantiaLines.length > 0) {
        const garantiaHtml = '<ul>' + vars.garantiaLines.map(l => `<li>${l}</li>`).join('') + '</ul>';

        // Buscar el heading "GARANTÍA Y SOPORTE" y el siguiente heading
        const sectionRegex = /(<h[1-6][^>]*>[^<]*garant[ií]a\s+y\s+soporte[^<]*<\/h[1-6]>)/i;
        const sectionMatch = result.match(sectionRegex);

        if (sectionMatch) {
            const sectionStart = result.indexOf(sectionMatch[0]) + sectionMatch[0].length;
            // Encontrar el siguiente heading después de esta sección
            const restHtml = result.substring(sectionStart);
            const nextHeadingMatch = restHtml.match(/<h[1-6][^>]*>/i);

            // Remover listas de garantía existentes (estáticas de la plantilla)
            let sectionContent: string;
            let afterSection: string;

            if (nextHeadingMatch) {
                const nextHeadingIdx = restHtml.indexOf(nextHeadingMatch[0]);
                sectionContent = restHtml.substring(0, nextHeadingIdx);
                afterSection = restHtml.substring(nextHeadingIdx);
            } else {
                sectionContent = restHtml;
                afterSection = '';
            }

            // Remover <ul> existentes que contengan texto de garantía
            sectionContent = sectionContent.replace(
                /<ul>(?:(?!<\/ul>).)*garant[ií]a.*?<\/ul>/gis,
                '',
            );

            // Reconstruir: antes de sección + heading + contenido limpio + nueva lista + resto
            result = result.substring(0, sectionStart) + sectionContent + garantiaHtml + afterSection;
        }
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
        const date = new Date(isoDate + 'T12:00:00'); // Avoid timezone issues
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
