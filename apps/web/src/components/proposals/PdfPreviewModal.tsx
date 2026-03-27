import { motion } from 'framer-motion';
import { X, FileText } from 'lucide-react';
import { generateHTML } from '@tiptap/html';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import type { ProposalPage } from '../../hooks/useProposalPages';

const PAGE_TYPE_LABELS: Record<string, string> = {
    COVER: 'Portada',
    INTRO: 'Introducción',
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

export default function PdfPreviewModal({ pages, onClose }: PdfPreviewModalProps) {
    const apiBase = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3000';

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col bg-slate-900/80 backdrop-blur-md"
        >
            {/* Toolbar */}
            <div className="flex items-center justify-between px-8 py-4 bg-slate-900/90 border-b border-slate-700/50 shrink-0">
                <div className="flex items-center space-x-4">
                    <FileText className="h-6 w-6 text-indigo-400" />
                    <div>
                        <h3 className="text-lg font-black text-white tracking-tight">Vista Previa del Documento</h3>
                        <p className="text-xs text-slate-400 font-medium">{pages.length} página{pages.length !== 1 ? 's' : ''}</p>
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
                <div className="max-w-[850px] mx-auto space-y-12">
                    {pages.map((page, pageIdx) => (
                        <motion.div
                            key={page.id}
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: pageIdx * 0.08 }}
                            className="relative"
                        >
                            {/* Page number badge */}
                            <div className="absolute -top-4 left-8 z-10 px-4 py-1 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-full shadow-lg shadow-indigo-600/30">
                                Pág. {pageIdx + 1} · {PAGE_TYPE_LABELS[page.pageType] || page.pageType}
                            </div>

                            {/* Paper page */}
                            <div
                                className="bg-white rounded-2xl shadow-2xl shadow-black/20 border border-slate-200/50 overflow-hidden"
                                style={{
                                    minHeight: '1056px', /* approx letter height at 96dpi */
                                    aspectRatio: '8.5/11',
                                }}
                            >
                                {/* Page content with print-like padding */}
                                <div className="px-16 py-16">
                                    {/* Page Title */}
                                    {page.pageType === 'COVER' ? (
                                        <CoverPageContent page={page} apiBase={apiBase} />
                                    ) : (
                                        <>
                                            <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-8 pb-4 border-b-2 border-indigo-600">
                                                {page.title || PAGE_TYPE_LABELS[page.pageType]}
                                            </h2>

                                            {page.blocks.length === 0 ? (
                                                <div className="py-20 text-center">
                                                    <p className="text-sm text-slate-300 italic">Esta página no tiene contenido aún.</p>
                                                </div>
                                            ) : (
                                                <div className="space-y-8">
                                                    {page.blocks.map(block => {
                                                        if (block.blockType === 'RICH_TEXT') {
                                                            const html = renderRichText(block.content);
                                                            return (
                                                                <div
                                                                    key={block.id}
                                                                    className="prose prose-sm max-w-none prose-headings:text-slate-900 prose-p:text-slate-700 prose-p:leading-relaxed"
                                                                    dangerouslySetInnerHTML={{ __html: html }}
                                                                />
                                                            );
                                                        }

                                                        if (block.blockType === 'IMAGE') {
                                                            const url = (block.content as Record<string, string>)?.url;
                                                            const caption = (block.content as Record<string, string>)?.caption;
                                                            if (!url) return null;
                                                            return (
                                                                <figure key={block.id} className="my-6">
                                                                    <img
                                                                        src={`${apiBase}${url}`}
                                                                        alt={caption || ''}
                                                                        className="w-full max-h-[400px] object-contain rounded-lg border border-slate-100"
                                                                    />
                                                                    {caption && (
                                                                        <figcaption className="text-center text-xs text-slate-500 italic mt-3">
                                                                            {caption}
                                                                        </figcaption>
                                                                    )}
                                                                </figure>
                                                            );
                                                        }

                                                        return null;
                                                    })}
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </motion.div>
    );
}

/** Special cover page layout */
function CoverPageContent({ page, apiBase }: { page: ProposalPage; apiBase: string }) {
    return (
        <div className="flex flex-col items-center justify-center" style={{ minHeight: '900px' }}>
            <div className="w-full max-w-md mx-auto text-center space-y-8">
                {/* Company logo placeholder */}
                <div className="w-24 h-24 mx-auto bg-gradient-to-br from-indigo-600 to-violet-600 rounded-3xl shadow-2xl shadow-indigo-600/30 flex items-center justify-center">
                    <FileText className="h-12 w-12 text-white" />
                </div>

                {/* Title */}
                <div className="space-y-4 pt-8">
                    <h1 className="text-4xl font-black tracking-tight text-slate-900 leading-tight">
                        PROPUESTA COMERCIAL
                    </h1>
                    <div className="w-24 h-1 bg-indigo-600 mx-auto rounded-full" />
                </div>

                {/* Subtitle from page title or blocks */}
                <p className="text-lg text-slate-500 font-medium leading-relaxed max-w-sm mx-auto">
                    {page.title || 'Portada'}
                </p>

                {/* Render any blocks on cover too */}
                {page.blocks.length > 0 && (
                    <div className="pt-8 text-left space-y-4 w-full">
                        {page.blocks.map(block => {
                            if (block.blockType === 'RICH_TEXT') {
                                const html = renderRichText(block.content);
                                return (
                                    <div
                                        key={block.id}
                                        className="prose prose-sm max-w-none"
                                        dangerouslySetInnerHTML={{ __html: html }}
                                    />
                                );
                            }
                            if (block.blockType === 'IMAGE') {
                                const url = (block.content as Record<string, string>)?.url;
                                const caption = (block.content as Record<string, string>)?.caption;
                                if (!url) return null;
                                return (
                                    <figure key={block.id} className="my-4">
                                        <img
                                            src={`${apiBase}${url}`}
                                            alt={caption || ''}
                                            className="w-full max-h-[350px] object-contain rounded-lg border border-slate-100"
                                        />
                                        {caption && (
                                            <figcaption className="text-center text-xs text-slate-500 italic mt-2">
                                                {caption}
                                            </figcaption>
                                        )}
                                    </figure>
                                );
                            }
                            return null;
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
