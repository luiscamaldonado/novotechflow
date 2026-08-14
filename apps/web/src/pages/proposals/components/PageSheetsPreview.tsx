import { AlertTriangle, Eye } from 'lucide-react';
import { type ProposalPage } from '../../../hooks/useProposalPages';
import { type ProposalVariables } from '../../../lib/proposalVariables';
import { useContentPageSheets, isContentPage } from '../../../hooks/useContentPageSheets';
import { PAGE_GEOMETRY } from '../../../lib/constants';
import PdfSheet from '../../../components/proposals/PdfSheet';
import PdfContentPage from '../../../components/proposals/PdfContentPage';

interface PageSheetsPreviewProps {
    page: ProposalPage;
    proposalVars: ProposalVariables;
    ownerSignatureUrl?: string;
    /** Encabezado resuelto de la hoja hija activa ("Titulo de la seccion — Hoja N"); undefined para paginas planas */
    resolvedSheetHeading?: string;
}

/** Escala de la hoja en la columna de vista previa del constructor */
const SHEET_SCALE = 0.6;

export default function PageSheetsPreview({ page, proposalVars, ownerSignatureUrl, resolvedSheetHeading }: PageSheetsPreviewProps) {
    const { measureRef, slices } = useContentPageSheets(page, proposalVars, ownerSignatureUrl);
    /** Hoja hija (C1): slice unico, sin continuaciones; el desborde es un error visible */
    const isChildSheet = page.parentPageId !== null;

    return (
        <>
            {/* Hidden measurement container — must stay mounted for the hook to measure */}
            <div ref={measureRef} style={{ position: 'fixed', top: -9999, left: -9999, width: PAGE_GEOMETRY.WIDTH_PX, pointerEvents: 'none' }} />

            {!isContentPage(page) ? (
                <div className="bg-white rounded-[2rem] p-8 text-center border-2 border-dashed border-slate-100">
                    <Eye className="h-10 w-10 mx-auto text-slate-200 mb-3" />
                    <p className="text-sm text-slate-400 font-medium max-w-xs mx-auto">
                        Las hojas de portada e índice se ven en la Vista Previa PDF.
                    </p>
                </div>
            ) : (
                <div className="space-y-6">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                        Hojas del PDF
                    </h3>
                    <div className="space-y-8">
                        {slices.map((slice, idx) => (
                            <div key={idx}>
                                <div
                                    style={{
                                        width: PAGE_GEOMETRY.WIDTH_PX * SHEET_SCALE,
                                        height: PAGE_GEOMETRY.HEIGHT_PX * SHEET_SCALE,
                                        position: 'relative',
                                    }}
                                >
                                    {/* Badges — fuera del transform, no se escalan */}
                                    <div className="absolute -top-4 left-4 z-10 flex items-center space-x-2">
                                        <span className="px-4 py-1 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-full shadow-lg shadow-indigo-600/30">
                                            Hoja {idx + 1}
                                        </span>
                                        {slice.isContinuation && (
                                            <span className="px-3 py-1 bg-amber-500 text-white text-[9px] font-black uppercase tracking-widest rounded-full shadow-lg">
                                                Continuación
                                            </span>
                                        )}
                                        {slice.isOverflowing && (
                                            <span className="flex items-center gap-1 px-3 py-1 bg-amber-600 text-white text-[9px] font-black uppercase tracking-widest rounded-full shadow-lg">
                                                <AlertTriangle className="h-3 w-3" />
                                                Excede la hoja
                                            </span>
                                        )}
                                    </div>

                                    <div
                                        style={{
                                            transform: `scale(${SHEET_SCALE})`,
                                            transformOrigin: 'top left',
                                            width: PAGE_GEOMETRY.WIDTH_PX,
                                            height: PAGE_GEOMETRY.HEIGHT_PX,
                                        }}
                                    >
                                        <PdfSheet>
                                            <PdfContentPage pageType={page.pageType} title={isChildSheet ? (resolvedSheetHeading ?? page.title) : page.title} htmlContent={slice.htmlContent} isContinuation={slice.isContinuation} isSheet={isChildSheet} />
                                        </PdfSheet>
                                    </div>
                                </div>

                                {slice.isOverflowing && (
                                    <div className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 p-3">
                                        <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                                        <p className="text-[11px] font-medium text-amber-700 leading-relaxed">
                                            {isChildSheet ? (
                                                <>El contenido excede la hoja: en el PDF se cortará al límite de la página. Divide el contenido en otra hoja.</>
                                            ) : (
                                                <>El contenido excede el área útil de la hoja.</>
                                            )}
                                        </p>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </>
    );
}
