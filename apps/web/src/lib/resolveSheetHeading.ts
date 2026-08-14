import type { ProposalPage } from '../hooks/useProposalPages';

/** Fallback cuando la seccion no tiene titulo */
const SECTION_TITLE_FALLBACK = 'Secci\u00f3n';

/**
 * Titulo resuelto de la seccion a la que pertenece una hoja hija (B1: el
 * titulo es de la seccion, no de la hoja). Mitad izquierda del encabezado
 * de hoja; tambien es la etiqueta de la entrada de seccion en el indice.
 */
export function resolveSheetSectionTitle(sheet: ProposalPage, pages: ProposalPage[]): string {
    const parent = pages.find(p => p.id === sheet.parentPageId);
    return parent?.title || SECTION_TITLE_FALLBACK;
}

/**
 * Encabezado resuelto de una hoja hija: "Titulo de la seccion — Hoja N", con
 * N por orden de sortOrder entre hermanas. Fuente unica consumida por el
 * editor (ProposalDocBuilder) y el PDF (PdfPreviewModal): el encabezado es
 * identico por construccion, no por copia. Devuelve undefined si la pagina
 * no es una hoja hija.
 */
export function resolveSheetHeading(sheet: ProposalPage, pages: ProposalPage[]): string | undefined {
    if (!sheet.parentPageId) return undefined;
    const siblings = pages
        .filter(p => p.parentPageId === sheet.parentPageId)
        .sort((a, b) => a.sortOrder - b.sortOrder);
    const sheetIdx = siblings.findIndex(s => s.id === sheet.id);
    return `${resolveSheetSectionTitle(sheet, pages)} \u2014 Hoja ${sheetIdx + 1}`;
}
