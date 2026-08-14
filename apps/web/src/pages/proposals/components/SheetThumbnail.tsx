import { useCallback, useMemo } from 'react';
import { type ProposalPage } from '../../../hooks/useProposalPages';
import { type ProposalVariables } from '../../../lib/proposalVariables';
import { buildPageHtml } from '../../../lib/renderPageHtml';
import { resolveImageUrl as resolveImageUrlShared, getApiBase } from '../../../lib/resolveImageUrl';
import { PAGE_GEOMETRY } from '../../../lib/constants';
import PdfSheet from '../../../components/proposals/PdfSheet';
import PdfContentPage from '../../../components/proposals/PdfContentPage';

/**
 * Escala de la miniatura de hoja en la grilla de la seccion (2-3 por fila
 * dentro de col-span-9). El papel completo (816x1056 px) se reduce con
 * transform, mismo patron que SHEET_SCALE en PageSheetsPreview; el
 * overflow:hidden de PdfSheet corta el desborde igual que el PDF.
 */
const THUMBNAIL_SCALE = 0.3;

interface SheetThumbnailProps {
    sheet: ProposalPage;
    /** Encabezado resuelto por la seccion ("Titulo — Hoja N"), misma fuente que el PDF */
    heading: string;
    proposalVars: ProposalVariables;
    ownerSignatureUrl?: string;
    onOpen: () => void;
}

/**
 * Miniatura de papel real de UNA hoja hija: el mismo PdfSheet + PdfContentPage
 * del pipeline, escalado. Sin medicion ni paginacion: la hoja es rigida y el
 * corte de desborde es identico al del PDF por construccion.
 */
function SheetThumbnail({ sheet, heading, proposalVars, ownerSignatureUrl, onOpen }: SheetThumbnailProps) {
    const resolveImageUrl = useCallback((url: string) => resolveImageUrlShared(url, getApiBase()), []);
    const htmlContent = useMemo(
        () => buildPageHtml(sheet.blocks, proposalVars, resolveImageUrl, sheet.pageType, ownerSignatureUrl),
        [sheet.blocks, sheet.pageType, proposalVars, resolveImageUrl, ownerSignatureUrl],
    );

    return (
        <button
            type="button"
            onClick={onOpen}
            className="group flex flex-col items-center space-y-2 p-3 rounded-2xl border-2 border-transparent hover:border-indigo-100 hover:bg-slate-50 transition-all"
        >
            <div
                className="pointer-events-none select-none"
                style={{
                    width: PAGE_GEOMETRY.WIDTH_PX * THUMBNAIL_SCALE,
                    height: PAGE_GEOMETRY.HEIGHT_PX * THUMBNAIL_SCALE,
                    position: 'relative',
                }}
            >
                <div
                    style={{
                        transform: `scale(${THUMBNAIL_SCALE})`,
                        transformOrigin: 'top left',
                        width: PAGE_GEOMETRY.WIDTH_PX,
                        height: PAGE_GEOMETRY.HEIGHT_PX,
                    }}
                >
                    <PdfSheet>
                        <PdfContentPage pageType={sheet.pageType} title={heading} htmlContent={htmlContent} isContinuation={false} isSheet />
                    </PdfSheet>
                </div>
            </div>
            <span className="text-xs text-slate-400 font-medium group-hover:text-indigo-600 transition-colors">
                {sheet.blocks.length} bloque{sheet.blocks.length !== 1 ? 's' : ''}
            </span>
        </button>
    );
}

export default SheetThumbnail;
