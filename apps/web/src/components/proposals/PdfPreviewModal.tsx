import { motion } from 'framer-motion';
import { X, FileText, ListOrdered, Download, Loader2, FileSpreadsheet } from 'lucide-react';

import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';
import type { ProposalPage, PageBlock } from '../../hooks/useProposalPages';
import { type ProposalVariables } from '../../lib/proposalVariables';
import type { ProcessedScenario } from '../../hooks/useProposalScenarios';
import TechnicalSpecSheet from './TechnicalSpecSheet';
import EconomicProposalTable from './EconomicProposalTable';
import PdfSheet from './PdfSheet';
import PdfContentPage from './PdfContentPage';
import EconomicMeasureContainer from './EconomicMeasureContainer';
import { consolidateTechnicalItems, type ConsolidatedTechItem } from '../../lib/consolidateTechnicalItems';
import { paginateEconomicProposal, type EconomicPageSlice } from '../../lib/paginateEconomicProposal';
import { getApiBase, resolveImageUrl as resolveImageUrlShared } from '../../lib/resolveImageUrl';
import { PAGE_GEOMETRY, PAGE_TYPE_LABELS } from '../../lib/constants';
import { buildPageHtml } from '../../lib/renderPageHtml';
import { measureContentElements, paginateContentPage, paginateSheet } from '../../lib/paginateContentPage';
import { resolveSheetHeading, resolveSheetSectionTitle } from '../../lib/resolveSheetHeading';
import { useEconomicRowHeights } from '../../hooks/useEconomicRowHeights';

interface PdfPreviewModalProps {
    pages: ProposalPage[];
    onClose: () => void;
    proposalVars?: ProposalVariables;
    processedScenarios?: ProcessedScenario[];
    enableExcelExport?: boolean;
    ownerSignatureUrl?: string;
}

/** Represents one visual page slice */
interface VisualPage {
    id: string;
    pageType: string;
    title: string | null;
    /** Pre-rendered HTML for this page slice */
    htmlContent: string;
    isContinuation: boolean;
    /** Special page types */
    isCover: boolean;
    isIndex: boolean;
    isTechSpec: boolean;
    isEconomic: boolean;
    /** For cover pages */
    coverBlocks: PageBlock[];
    /** For index pages */
    allPages?: ProposalPage[];
    /** For tech spec pages (consolidated) */
    consolidatedTechItem?: ConsolidatedTechItem;
    consolidatedTotalItems?: number;
    /** For economic proposal pages */
    economicScenario?: ProcessedScenario;
    /** For pages ECONOMIC: slice específico del escenario */
    economicSlice?: EconomicPageSlice;
    /** For section sheets: owning section identity (marks the visual page as a sheet) */
    section?: { id: string; title: string };
}

export default function PdfPreviewModal({ pages, onClose, proposalVars, processedScenarios = [], enableExcelExport = false, ownerSignatureUrl }: PdfPreviewModalProps) {
    const apiBase = getApiBase();

    /** Wrapper local que cierra sobre apiBase. Delega en el helper compartido en lib/resolveImageUrl.ts. */
    const resolveImageUrl = useCallback(
        (url: string): string => resolveImageUrlShared(url, apiBase),
        [apiBase],
    );
    const [visualPages, setVisualPages] = useState<VisualPage[]>([]);
    const measureRef = useRef<HTMLDivElement>(null);
    const [ready, setReady] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [exportingExcel, setExportingExcel] = useState(false);
    const { measureRef: economicMeasureRef, rowHeights } = useEconomicRowHeights(processedScenarios);
    const consolidation = useMemo(
        () => consolidateTechnicalItems(processedScenarios),
        [processedScenarios],
    );
    const pagesContainerRef = useRef<HTMLDivElement>(null);

    /** Genera y descarga el PDF capturando cada página como imagen */
    const generatePdf = useCallback(async () => {
        const container = pagesContainerRef.current;
        if (!container || visualPages.length === 0) return;

        setDownloading(true);
        try {
            // Letter size in points: 612 x 792
            const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
            const pageElements = container.querySelectorAll<HTMLElement>('[data-pdf-page]');

            for (let i = 0; i < pageElements.length; i++) {
                const el = pageElements[i];
                const canvas = await html2canvas(el, {
                    scale: 2,
                    useCORS: true,
                    allowTaint: true,
                    backgroundColor: '#ffffff',
                    width: PAGE_GEOMETRY.WIDTH_PX,
                    height: PAGE_GEOMETRY.HEIGHT_PX,
                    windowWidth: PAGE_GEOMETRY.WIDTH_PX,
                });

                const imgData = canvas.toDataURL('image/jpeg', 0.92);
                const pdfWidth = PAGE_GEOMETRY.WIDTH_PT;
                const pdfHeight = PAGE_GEOMETRY.HEIGHT_PT;

                if (i > 0) pdf.addPage();
                pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
            }

            // Build filename: "Propuesta Comercial Novotechno - COT-XXX - CLIENTE.pdf"
            const cot = proposalVars?.cotizacion || 'SIN-COT';
            const cliente = proposalVars?.cliente || 'CLIENTE';
            const filename = `Propuesta Comercial Novotechno_${cot}_${cliente}.pdf`;
            pdf.save(filename);
        } catch (err) {
            console.error('Error generating PDF:', err);
        } finally {
            setDownloading(false);
        }
    }, [visualPages, proposalVars]);

    /** Genera y descarga el Excel con ficha técnica + precios de venta */
    const handleExportExcel = useCallback(async () => {
        setExportingExcel(true);
        try {
            const { exportProposalExcel } = await import('../../lib/exportProposalExcel');
            await exportProposalExcel({
                consolidatedItems: consolidation.items,
                variantLabelByScenarioItemId: consolidation.variantLabelByScenarioItemId,
                processedScenarios,
                proposalCode: proposalVars?.cotizacion ?? 'SIN-COT',
                clientName: proposalVars?.cliente ?? 'CLIENTE',
            });
        } catch (err) {
            console.error('Error exporting Excel:', err);
            alert('No se pudo generar el archivo Excel. Intente de nuevo.');
        } finally {
            setExportingExcel(false);
        }
    }, [consolidation, processedScenarios, proposalVars]);

    const buildVisualPages = useCallback(() => {
        const container = measureRef.current;
        if (!container) return;

        const result: VisualPage[] = [];

        for (const page of pages) {
            // Cover pages: single page, no splitting
            if (page.pageType === 'COVER') {
                result.push({
                    id: `${page.id}-cover`,
                    pageType: page.pageType,
                    title: page.title,
                    htmlContent: '',
                    isContinuation: false,
                    isCover: true,
                    isIndex: false,
                    isTechSpec: false,
                    isEconomic: false,
                    coverBlocks: page.blocks,
                });
                continue;
            }

            // Index pages: single page, auto-generated
            if (page.pageType === 'INDEX') {
                result.push({
                    id: `${page.id}-index`,
                    pageType: page.pageType,
                    title: page.title,
                    htmlContent: '',
                    isContinuation: false,
                    isCover: false,
                    isIndex: true,
                    isTechSpec: false,
                    isEconomic: false,
                    coverBlocks: [],
                    allPages: pages,
                });

                // Inject virtual TECH SPEC pages after INDEX (consolidated, deduplicated)
                for (const consolidated of consolidation.items) {
                    result.push({
                        id: `techspec-${consolidated.item.scenarioItem.id}`,
                        pageType: 'TECH_SPEC',
                        title: 'Propuesta Técnica',
                        htmlContent: '',
                        isContinuation: false,
                        isCover: false,
                        isIndex: false,
                        isTechSpec: true,
                        isEconomic: false,
                        coverBlocks: [],
                        consolidatedTechItem: consolidated,
                        consolidatedTotalItems: consolidation.items.length,
                    });
                }

                // Inject virtual ECONOMIC PROPOSAL pages after tech specs (paginated)
                for (const scenario of processedScenarios) {
                    const slices = paginateEconomicProposal(scenario, rowHeights);
                    for (const slice of slices) {
                        result.push({
                            id: `economic-${scenario.id}-${slice.sliceIndex}`,
                            pageType: 'ECONOMIC',
                            title: `Propuesta Económica — ${scenario.name}`,
                            htmlContent: '',
                            isContinuation: !slice.isFirstSlice,
                            isCover: false,
                            isIndex: false,
                            isTechSpec: false,
                            isEconomic: true,
                            coverBlocks: [],
                            economicScenario: scenario,
                            economicSlice: slice,
                        });
                    }
                }

                continue;
            }

            // Seccion contenedora: no emite hoja propia — el PDF la representa por sus hojas hijas
            if (page.isSectionModel && !page.parentPageId) {
                continue;
            }

            // Hoja hija (C1): contenedor rigido de una pagina fisica — slice unico via paginateSheet;
            // el desborde lo recorta el overflow hidden de PdfSheet. Vacia tambien emite su hoja.
            if (page.parentPageId !== null) {
                const sheetHtml = buildPageHtml(page.blocks, proposalVars, resolveImageUrl, page.pageType, ownerSignatureUrl);
                const [sheetSlice] = paginateSheet(measureContentElements(sheetHtml, container));
                result.push({
                    id: `${page.id}-0`,
                    pageType: page.pageType,
                    title: resolveSheetHeading(page, pages) ?? page.title,
                    htmlContent: sheetSlice.htmlContent,
                    isContinuation: false,
                    isCover: false,
                    isIndex: false,
                    isTechSpec: false,
                    isEconomic: false,
                    coverBlocks: [],
                    section: { id: page.parentPageId, title: resolveSheetSectionTitle(page, pages) },
                });
                continue;
            }

            // Content pages: render all blocks to HTML, then split by element heights
            const fullHtml = buildPageHtml(page.blocks, proposalVars, resolveImageUrl, page.pageType, ownerSignatureUrl);

            if (!fullHtml.trim()) {
                result.push({
                    id: `${page.id}-0`,
                    pageType: page.pageType,
                    title: page.title,
                    htmlContent: '',
                    isContinuation: false,
                    isCover: false,
                    isIndex: false,
                    isTechSpec: false,
                    isEconomic: false,
                    coverBlocks: [],
                });
                continue;
            }

            const elementData = measureContentElements(fullHtml, container);
            const slices = paginateContentPage(elementData);

            slices.forEach((slice, sliceIdx) => {
                result.push({
                    id: `${page.id}-${sliceIdx}`,
                    pageType: page.pageType,
                    title: page.title,
                    htmlContent: slice.htmlContent,
                    isContinuation: slice.isContinuation,
                    isCover: false,
                    isIndex: false,
                    isTechSpec: false,
                    isEconomic: false,
                    coverBlocks: [],
                });
            });
        }

        setVisualPages(result);
        setReady(true);
    }, [pages, proposalVars, processedScenarios, consolidation, rowHeights, resolveImageUrl, ownerSignatureUrl]);

    useEffect(() => {
        // Wait for DOM to be ready
        const timer = setTimeout(buildVisualPages, 200);
        return () => clearTimeout(timer);
    }, [buildVisualPages]);

    // Rebuild when fonts/images load
    useEffect(() => {
        if (document.fonts) {
            document.fonts.ready.then(() => {
                setTimeout(buildVisualPages, 100);
            });
        }
    }, [buildVisualPages]);

    const totalPages = ready ? visualPages.length : pages.length;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col bg-slate-900/80 backdrop-blur-md"
        >
            {/* Hidden measurement container for content pages */}
            <div ref={measureRef} style={{ position: 'fixed', top: -9999, left: -9999, width: PAGE_GEOMETRY.WIDTH_PX, pointerEvents: 'none' }} />

            {/* Hidden measurement container for economic table row heights */}
            <EconomicMeasureContainer measureRef={economicMeasureRef} processedScenarios={processedScenarios} variantLabelByScenarioItemId={consolidation.variantLabelByScenarioItemId} />

            {/* Toolbar */}
            <div className="flex items-center justify-between px-8 py-4 bg-slate-900/90 border-b border-slate-700/50 shrink-0">
                <div className="flex items-center space-x-4">
                    <FileText className="h-6 w-6 text-indigo-400" />
                    <div>
                        <h3 className="text-lg font-black text-white tracking-tight">Vista Previa del Documento</h3>
                        <p className="text-xs text-slate-400 font-medium">
                            {totalPages} página{totalPages !== 1 ? 's' : ''} · Tamaño Carta (8.5&quot; × 11&quot;)
                        </p>
                    </div>
                </div>
                <div className="flex items-center space-x-3">
                    {enableExcelExport && (
                        <button
                            onClick={handleExportExcel}
                            disabled={exportingExcel || consolidation.items.length === 0}
                            className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-black tracking-tight hover:bg-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-600/30"
                        >
                            {exportingExcel ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    <span>Exportando…</span>
                                </>
                            ) : (
                                <>
                                    <FileSpreadsheet className="h-4 w-4" />
                                    <span>Descargar Excel</span>
                                </>
                            )}
                        </button>
                    )}
                    <button
                        onClick={generatePdf}
                        disabled={downloading || visualPages.length === 0}
                        className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-black tracking-tight hover:bg-indigo-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-600/30"
                    >
                        {downloading ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span>Generando…</span>
                            </>
                        ) : (
                            <>
                                <Download className="h-4 w-4" />
                                <span>Descargar PDF</span>
                            </>
                        )}
                    </button>
                    <button
                        onClick={onClose}
                        className="p-3 rounded-xl bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white transition-all"
                        aria-label="Cerrar vista previa"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>
            </div>

            {/* Scrollable preview area */}
            <div className="flex-1 overflow-y-auto py-12 px-4">
                <div ref={pagesContainerRef} className="mx-auto space-y-12" style={{ maxWidth: PAGE_GEOMETRY.WIDTH_PX }}>
                    {visualPages.map((vPage, pageIdx) => (
                        <motion.div
                            key={vPage.id}
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: pageIdx * 0.06 }}
                            className="relative"
                        >
                            {/* Page badge */}
                            <div className="absolute -top-4 left-8 z-10 flex items-center space-x-2">
                                <span className="px-4 py-1 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-full shadow-lg shadow-indigo-600/30">
                                    Pág. {pageIdx + 1} · {PAGE_TYPE_LABELS[vPage.pageType] || vPage.pageType}
                                </span>
                                {vPage.isContinuation && (
                                    <span className="px-3 py-1 bg-amber-500 text-white text-[9px] font-black uppercase tracking-widest rounded-full shadow-lg">
                                        Continuación
                                    </span>
                                )}
                            </div>

                            {/* Paper page */}
                            <PdfSheet>
                                {vPage.isCover ? (
                                    <CoverPageContent blocks={vPage.coverBlocks} title={vPage.title ?? ''} apiBase={apiBase} resolveImageUrl={resolveImageUrl} />
                                ) : vPage.isIndex ? (
                                    <IndexPageContent visualPages={visualPages} />
                                ) : vPage.isTechSpec && vPage.consolidatedTechItem ? (
                                    <TechnicalSpecSheet
                                        item={vPage.consolidatedTechItem.item}
                                        globalIndex={vPage.consolidatedTechItem.globalIndex}
                                        totalItems={vPage.consolidatedTotalItems!}
                                        variantLabel={vPage.consolidatedTechItem.variantLabel}
                                    />
                                ) : vPage.isEconomic && vPage.economicScenario && vPage.economicSlice ? (
                                    <EconomicProposalTable
                                        scenario={vPage.economicScenario}
                                        variantLabelByScenarioItemId={consolidation.variantLabelByScenarioItemId}
                                        slice={vPage.economicSlice}
                                    />
                                ) : (
                                    <PdfContentPage pageType={vPage.pageType} title={vPage.title} htmlContent={vPage.htmlContent} isContinuation={vPage.isContinuation} isSheet={vPage.section != null} />
                                )}
                            </PdfSheet>
                        </motion.div>
                    ))}

                    {/* Fallback if visual pages haven't been computed yet */}
                    {visualPages.length === 0 && (
                        <div className="flex items-center justify-center h-64">
                            <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
                        </div>
                    )}
                </div>
            </div>
        </motion.div>
    );
}

/** Cover page: full-page image */
function CoverPageContent({ blocks, title, resolveImageUrl }: { blocks: PageBlock[]; title: string; apiBase: string; resolveImageUrl: (url: string) => string }) {
    const imageBlock = blocks.find(b => b.blockType === 'IMAGE');
    const imageUrl = (imageBlock?.content as Record<string, string>)?.url;

    if (imageUrl) {
        return (
            <div className="w-full h-full flex items-center justify-center" style={{ minHeight: `${PAGE_GEOMETRY.HEIGHT_PX}px` }}>
                <img
                    src={resolveImageUrl(imageUrl)}
                    alt="Portada"
                    className="w-full h-full object-cover"
                    style={{ minHeight: `${PAGE_GEOMETRY.HEIGHT_PX}px` }}
                />
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center" style={{ minHeight: `${PAGE_GEOMETRY.HEIGHT_PX}px` }}>
            <div className="w-full max-w-md mx-auto text-center space-y-8">
                <div className="w-24 h-24 mx-auto bg-linear-to-br from-indigo-600 to-violet-600 rounded-3xl shadow-2xl shadow-indigo-600/30 flex items-center justify-center">
                    <FileText className="h-12 w-12 text-white" />
                </div>
                <div className="space-y-4 pt-8">
                    <h1 className="text-4xl font-black tracking-tight text-slate-900 leading-tight uppercase">Propuesta Comercial</h1>
                    <div className="w-24 h-1 bg-indigo-600 mx-auto rounded-full" />
                </div>
                <p className="text-lg text-slate-500 font-medium leading-relaxed max-w-sm mx-auto">{title || 'Portada'}</p>
            </div>
        </div>
    );
}

/** Auto-generated index page — lists all visual pages with correct numbering */
function IndexPageContent({ visualPages }: { visualPages: VisualPage[] }) {
    // Build deduplicated index entries: group continuations under their parent
    const entries: { label: string; pageNum: number; pageType: string; isSub?: boolean }[] = [];
    const seenSections = new Set<string>();

    visualPages.forEach((vp, idx) => {
        // Skip cover and index itself
        if (vp.isCover || vp.isIndex) return;
        // Skip continuations
        if (vp.isContinuation) return;

        // For tech spec pages, single global entry
        if (vp.isTechSpec) {
            const sectionKey = 'techspec-global';
            if (!seenSections.has(sectionKey)) {
                seenSections.add(sectionKey);
                entries.push({
                    label: 'Propuesta Técnica',
                    pageNum: idx + 1,
                    pageType: 'TECH_SPEC',
                });
            }
            return;
        }

        // For economic pages, one entry per scenario
        if (vp.isEconomic && vp.economicScenario) {
            entries.push({
                label: `Propuesta Económica — ${vp.economicScenario.name}`,
                pageNum: idx + 1,
                pageType: 'ECONOMIC',
            });
            return;
        }

        // Section sheets: one entry per section, pointing at its first sheet
        if (vp.section) {
            const sectionKey = `section-${vp.section.id}`;
            if (!seenSections.has(sectionKey)) {
                seenSections.add(sectionKey);
                entries.push({
                    label: vp.section.title,
                    pageNum: idx + 1,
                    pageType: vp.pageType,
                });
            }
            return;
        }

        // Regular pages
        entries.push({
            label: vp.title || PAGE_TYPE_LABELS[vp.pageType] || vp.pageType,
            pageNum: idx + 1,
            pageType: vp.pageType,
        });
    });

    return (
        <div className="px-16 py-16" style={{ minHeight: `${PAGE_GEOMETRY.HEIGHT_PX}px` }}>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-8 pb-4 border-b-2 border-indigo-600">Índice</h2>
            <div className="space-y-1">
                {entries.map((entry, idx) => {
                    const isTechOrEcon = entry.pageType === 'TECH_SPEC' || entry.pageType === 'ECONOMIC';
                    return (
                        <div
                            key={`idx-${idx}`}
                            className="flex items-center justify-between py-3"
                        >
                            <div className="flex items-center space-x-3">
                                <span className="text-sm font-bold text-slate-400 w-8 text-right">{idx + 1}.</span>
                                <div className="flex items-center space-x-2">
                                    <ListOrdered className="h-4 w-4 text-slate-300" />
                                    <span className={`text-sm font-bold ${
                                        isTechOrEcon ? 'text-indigo-700' : 'text-slate-800'
                                    }`}>
                                        {entry.label}
                                    </span>
                                </div>
                            </div>
                            <div className="flex-1 mx-4 border-b border-dotted border-slate-200" />
                            <span className="text-sm font-black text-slate-500">{entry.pageNum}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
