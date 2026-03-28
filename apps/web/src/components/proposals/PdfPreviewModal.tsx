import { motion } from 'framer-motion';
import { X, FileText, ListOrdered } from 'lucide-react';
import { generateHTML } from '@tiptap/html';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import { useRef, useEffect, useState, useCallback } from 'react';
import type { ProposalPage, PageBlock } from '../../hooks/useProposalPages';

const PAGE_TYPE_LABELS: Record<string, string> = {
    COVER: 'Portada',
    PRESENTATION: 'Carta de Presentación',
    COMPANY_INFO: 'Info. General',
    INDEX: 'Índice',
    TERMS: 'Términos y Condiciones',
    CUSTOM: 'Página Personalizada',
};

const extensions = [
    StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    Underline,
];

interface PdfPreviewModalProps {
    pages: ProposalPage[];
    onClose: () => void;
}

function renderRichText(content: Record<string, unknown> | null): string {
    if (!content || !content.type) return '';
    try {
        return generateHTML(content as Parameters<typeof generateHTML>[0], extensions);
    } catch {
        return '<p style="color:#aaa;">Contenido vacío</p>';
    }
}

/** Letter page size at 96dpi */
const PAGE_HEIGHT = 1056;
const PAGE_PADDING = 64; // py-16 = 64px each side
const USABLE_HEIGHT = PAGE_HEIGHT - PAGE_PADDING * 2; // ~928px
const HEADER_HEIGHT = 72; // estimated header with border

/** Represents one visual page slice */
interface VisualPage {
    id: string;
    pageType: string;
    title: string;
    /** Pre-rendered HTML for this page slice */
    htmlContent: string;
    isContinuation: boolean;
    /** Special page types */
    isCover: boolean;
    isIndex: boolean;
    /** For cover pages */
    coverBlocks: PageBlock[];
    /** For index pages */
    allPages?: ProposalPage[];
}

export default function PdfPreviewModal({ pages, onClose }: PdfPreviewModalProps) {
    const apiBase = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3000';
    const [visualPages, setVisualPages] = useState<VisualPage[]>([]);
    const measureRef = useRef<HTMLDivElement>(null);
    const [ready, setReady] = useState(false);

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
                    coverBlocks: [],
                    allPages: pages,
                });
                continue;
            }

            // Content pages: render all blocks to HTML, then split by element heights
            // Build the full HTML for this page
            let fullHtml = '';
            for (const block of page.blocks) {
                if (block.blockType === 'RICH_TEXT') {
                    fullHtml += renderRichText(block.content);
                } else if (block.blockType === 'IMAGE') {
                    const url = (block.content as Record<string, string>)?.url;
                    const caption = (block.content as Record<string, string>)?.caption;
                    if (url) {
                        const isSignature = url.includes('/signatures/');
                        if (isSignature) {
                            fullHtml += `<div style="margin-top:48px;"><img src="${apiBase}${url}" alt="${caption || 'Firma'}" style="object-fit:contain;" /></div>`;
                        } else {
                            fullHtml += `<figure class="my-6"><img src="${apiBase}${url}" alt="${caption || ''}" style="width:100%; max-height:400px; object-fit:contain; border-radius:8px; border:1px solid #f1f5f9;" />`;
                            if (caption) {
                                fullHtml += `<figcaption style="text-align:center; font-size:12px; color:#64748b; font-style:italic; margin-top:12px;">${caption}</figcaption>`;
                            }
                            fullHtml += '</figure>';
                        }
                    }
                }
            }

            if (!fullHtml.trim()) {
                result.push({
                    id: `${page.id}-0`,
                    pageType: page.pageType,
                    title: page.title,
                    htmlContent: '',
                    isContinuation: false,
                    isCover: false,
                    isIndex: false,
                    coverBlocks: [],
                });
                continue;
            }

            // Render the full HTML into a measurement div to get child element heights
            const measure = document.createElement('div');
            measure.style.width = `${816 - PAGE_PADDING * 2}px`; // page width minus padding
            measure.style.position = 'absolute';
            measure.style.visibility = 'hidden';
            measure.style.left = '-9999px';
            measure.className = 'prose prose-sm max-w-none';
            measure.innerHTML = fullHtml;
            container.appendChild(measure);

            // Force image rendering by setting dimensions
            const imgs = measure.querySelectorAll('img');
            imgs.forEach(img => {
                if (!img.naturalHeight) {
                    img.style.height = '300px';
                }
            });

            // Get all top-level child elements and their heights
            const children = Array.from(measure.children) as HTMLElement[];
            const elementData: { html: string; height: number }[] = [];

            for (const child of children) {
                const rect = child.getBoundingClientRect();
                const styles = window.getComputedStyle(child);
                const marginTop = parseFloat(styles.marginTop) || 0;
                const marginBottom = parseFloat(styles.marginBottom) || 0;
                elementData.push({
                    html: child.outerHTML,
                    height: rect.height + marginTop + marginBottom,
                });
            }

            container.removeChild(measure);

            // Split elements across pages
            let currentHeight = HEADER_HEIGHT;
            let currentHtml = '';
            let isContinuation = false;
            let sliceIdx = 0;

            for (let i = 0; i < elementData.length; i++) {
                const el = elementData[i];

                // Would adding this element exceed the page?
                if (currentHeight + el.height > USABLE_HEIGHT && currentHtml.length > 0) {
                    // Flush current page
                    result.push({
                        id: `${page.id}-${sliceIdx}`,
                        pageType: page.pageType,
                        title: page.title,
                        htmlContent: currentHtml,
                        isContinuation,
                        isCover: false,
                        isIndex: false,
                        coverBlocks: [],
                    });
                    sliceIdx++;
                    currentHtml = '';
                    currentHeight = 40; // continuation header is smaller
                    isContinuation = true;
                }

                currentHtml += el.html;
                currentHeight += el.height;
            }

            // Flush remaining content
            result.push({
                id: `${page.id}-${sliceIdx}`,
                pageType: page.pageType,
                title: page.title,
                htmlContent: currentHtml,
                isContinuation,
                isCover: false,
                isIndex: false,
                coverBlocks: [],
            });
        }

        setVisualPages(result);
        setReady(true);
    }, [pages, apiBase]);

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
            {/* Hidden measurement container */}
            <div ref={measureRef} style={{ position: 'fixed', top: -9999, left: -9999, width: 816, pointerEvents: 'none' }} />

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
                <button
                    onClick={onClose}
                    className="p-3 rounded-xl bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white transition-all"
                >
                    <X className="h-5 w-5" />
                </button>
            </div>

            {/* Scrollable preview area */}
            <div className="flex-1 overflow-y-auto py-12 px-4">
                <div className="max-w-[816px] mx-auto space-y-12">
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
                            <div
                                className="bg-white rounded-2xl shadow-2xl shadow-black/20 border border-slate-200/50 overflow-hidden"
                                style={{ minHeight: `${PAGE_HEIGHT}px`, maxHeight: `${PAGE_HEIGHT}px`, overflow: 'hidden' }}
                            >
                                {vPage.isCover ? (
                                    <CoverPageContent blocks={vPage.coverBlocks} title={vPage.title} apiBase={apiBase} />
                                ) : vPage.isIndex ? (
                                    <IndexPageContent pages={vPage.allPages || pages} />
                                ) : (
                                    <div className="px-16 py-16 h-full">
                                        {/* Header */}
                                        {!vPage.isContinuation ? (
                                            vPage.pageType === 'CUSTOM' ? (
                                                <div className="mb-8 pb-4 border-b-2 border-indigo-600">
                                                    <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase">
                                                        Propuesta Comercial
                                                    </h2>
                                                    {vPage.title && (
                                                        <p className="text-sm text-indigo-600 font-bold mt-1">{vPage.title}</p>
                                                    )}
                                                </div>
                                            ) : (
                                                <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-8 pb-4 border-b-2 border-indigo-600">
                                                    {vPage.title || PAGE_TYPE_LABELS[vPage.pageType]}
                                                </h2>
                                            )
                                        ) : (
                                            <div className="mb-6 pb-3 border-b border-slate-200 flex items-center justify-between">
                                                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">
                                                    {vPage.title || PAGE_TYPE_LABELS[vPage.pageType]}
                                                    <span className="text-slate-300 ml-2">— Continuación</span>
                                                </p>
                                            </div>
                                        )}

                                        {/* Content */}
                                        {vPage.htmlContent ? (
                                            <div
                                                className="prose prose-sm max-w-none prose-headings:text-slate-900 prose-p:text-slate-700 prose-p:leading-relaxed"
                                                dangerouslySetInnerHTML={{ __html: vPage.htmlContent }}
                                            />
                                        ) : (
                                            <div className="py-20 text-center">
                                                <p className="text-sm text-slate-300 italic">Esta página no tiene contenido aún.</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
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
function CoverPageContent({ blocks, title, apiBase }: { blocks: PageBlock[]; title: string; apiBase: string }) {
    const imageBlock = blocks.find(b => b.blockType === 'IMAGE');
    const imageUrl = (imageBlock?.content as Record<string, string>)?.url;

    if (imageUrl) {
        return (
            <div className="w-full h-full flex items-center justify-center" style={{ minHeight: `${PAGE_HEIGHT}px` }}>
                <img
                    src={`${apiBase}${imageUrl}`}
                    alt="Portada"
                    className="w-full h-full object-cover"
                    style={{ minHeight: `${PAGE_HEIGHT}px` }}
                />
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center" style={{ minHeight: `${PAGE_HEIGHT}px` }}>
            <div className="w-full max-w-md mx-auto text-center space-y-8">
                <div className="w-24 h-24 mx-auto bg-gradient-to-br from-indigo-600 to-violet-600 rounded-3xl shadow-2xl shadow-indigo-600/30 flex items-center justify-center">
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

/** Auto-generated index page */
function IndexPageContent({ pages }: { pages: ProposalPage[] }) {
    return (
        <div className="px-16 py-16" style={{ minHeight: `${PAGE_HEIGHT}px` }}>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-8 pb-4 border-b-2 border-indigo-600">Índice</h2>
            <div className="space-y-1">
                {pages.map((page, idx) => (
                    <div
                        key={page.id}
                        className={`flex items-center justify-between py-3 ${page.pageType === 'INDEX' ? 'text-violet-600 font-bold' : ''}`}
                    >
                        <div className="flex items-center space-x-3">
                            <span className="text-sm font-bold text-slate-400 w-8 text-right">{idx + 1}.</span>
                            <div className="flex items-center space-x-2">
                                <ListOrdered className="h-4 w-4 text-slate-300" />
                                <span className="text-sm font-bold text-slate-800">{page.title || PAGE_TYPE_LABELS[page.pageType]}</span>
                            </div>
                        </div>
                        <div className="flex-1 mx-4 border-b border-dotted border-slate-200" />
                        <span className="text-sm font-black text-slate-500">{idx + 1}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
