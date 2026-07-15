import { PAGE_TYPE_LABELS } from '../../lib/constants';

interface PdfContentPageProps {
    pageType: string;
    title: string | null;
    htmlContent: string;
    isContinuation: boolean;
}

/**
 * Cuerpo de una hoja de contenido: el padding de hoja, el header condicional
 * (primera hoja vs continuacion, con caso especial CUSTOM) y el contenedor
 * prose donde se inyecta el htmlContent ya paginado.
 */
export default function PdfContentPage({ pageType, title, htmlContent, isContinuation }: PdfContentPageProps) {
    return (
        <div className="px-16 py-16 h-full">
            {/* Header */}
            {!isContinuation ? (
                pageType === 'CUSTOM' ? (
                    <div className="mb-8 pb-4 border-b-2 border-indigo-600">
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase">
                            Propuesta Comercial
                        </h2>
                        {title && (
                            <p className="text-sm text-indigo-600 font-bold mt-1">{title}</p>
                        )}
                    </div>
                ) : (
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-8 pb-4 border-b-2 border-indigo-600">
                        {title || PAGE_TYPE_LABELS[pageType]}
                    </h2>
                )
            ) : (
                <div className="mb-6 pb-3 border-b border-slate-200 flex items-center justify-between">
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">
                        {title || PAGE_TYPE_LABELS[pageType]}
                        <span className="text-slate-300 ml-2">— Continuación</span>
                    </p>
                </div>
            )}

            {/* Content */}
            {htmlContent ? (
                <div
                    className="prose prose-sm max-w-none prose-headings:text-slate-900 prose-p:text-slate-700 prose-p:leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: htmlContent }}
                />
            ) : (
                <div className="py-20 text-center">
                    <p className="text-sm text-slate-300 italic">Esta página no tiene contenido aún.</p>
                </div>
            )}
        </div>
    );
}
