import { useRef, useState, useEffect, useCallback, type RefObject } from 'react';
import { type ProposalPage } from './useProposalPages';
import { type ProposalVariables } from '../lib/proposalVariables';
import { buildPageHtml } from '../lib/renderPageHtml';
import {
    measureContentElements,
    paginateContentPage,
    type ContentPageSlice,
} from '../lib/paginateContentPage';
import { resolveImageUrl as resolveImageUrlShared, getApiBase } from '../lib/resolveImageUrl';

/**
 * Una pagina es de contenido si no es portada ni indice.
 * Espeja la ramificacion de buildVisualPages en PdfPreviewModal: ahi COVER e
 * INDEX hacen `continue` y todo lo demas cae en la rama de contenido.
 */
export function isContentPage(page: ProposalPage | null): boolean {
    return !!page && page.pageType !== 'COVER' && page.pageType !== 'INDEX';
}

/**
 * Produce las hojas reales que el PDF generaria para una pagina de contenido.
 *
 * Reusa exactamente los modulos compartidos que consume PdfPreviewModal
 * (buildPageHtml, measureContentElements, paginateContentPage) para que el
 * corte de hoja de la vista previa del constructor coincida con el del PDF.
 */
export function useContentPageSheets(
    page: ProposalPage | null,
    proposalVars: ProposalVariables | undefined,
): { measureRef: RefObject<HTMLDivElement | null>; slices: ContentPageSlice[] } {
    const resolveImageUrl = useCallback((url: string) => resolveImageUrlShared(url, getApiBase()), []);
    const measureRef = useRef<HTMLDivElement>(null);
    const [slices, setSlices] = useState<ContentPageSlice[]>([]);

    useEffect(() => {
        if (!isContentPage(page) || !page) {
            setSlices([]);
            return;
        }

        let cancelled = false;

        const build = () => {
            if (cancelled) return;
            const container = measureRef.current;
            if (!container) return;
            const html = buildPageHtml(page.blocks, proposalVars, resolveImageUrl);
            const elements = measureContentElements(html, container);
            setSlices(paginateContentPage(elements));
        };

        const timer = window.setTimeout(build, 200);
        if (document.fonts) {
            document.fonts.ready.then(() => { if (!cancelled) build(); });
        }

        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, [page, proposalVars, resolveImageUrl]);

    return { measureRef, slices };
}
