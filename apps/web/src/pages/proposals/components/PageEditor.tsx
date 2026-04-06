import { AnimatePresence, motion } from 'framer-motion';
import {
    Lock, Type, ImagePlus, Pencil,
    FileText, ListOrdered,
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import { type ProposalPage, type PageBlock } from '../../../hooks/useProposalPages';
import { type ProposalVariables } from '../../../lib/proposalVariables';
import { PAGE_TYPE_LABELS, PAGE_TYPE_STYLES } from '../../../lib/constants';
import BlockEditor from './BlockEditor';

interface PageEditorProps {
    page: ProposalPage;
    editingTitle: string | null;
    setEditingTitle: (v: string | null) => void;
    onUpdatePage: (pageId: string, data: { title?: string }) => void;
    onCreateBlock: (pageId: string, blockType: 'RICH_TEXT' | 'IMAGE') => Promise<PageBlock | null>;
    onUpdateBlock: (blockId: string, content: Record<string, unknown>) => void;
    onDeleteBlock: (pageId: string, blockId: string) => void;
    onAddTextBlock: () => void;
    onAddImageBlock: () => void;
    onUploadImageForBlock: (blockId: string) => void;
    uploadImage: (file: File) => Promise<string | null>;
    isAdmin: boolean;
    proposalVars: ProposalVariables;
}

function PageEditor({
    page, editingTitle, setEditingTitle,
    onUpdatePage, onUpdateBlock, onDeleteBlock,
    onAddTextBlock, onAddImageBlock, onUploadImageForBlock, uploadImage,
    proposalVars,
}: PageEditorProps) {
    const style = PAGE_TYPE_STYLES[page.pageType] || PAGE_TYPE_STYLES.CUSTOM;
    const IconComponent = style.icon;

    return (
        <div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-100 border border-slate-100">
            {/* Page Header */}
            <div className="p-8 bg-slate-50/50 border-b border-slate-100">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                        <div className={cn("p-3 rounded-2xl shadow-lg", style.bg, style.border, "border")}>
                            <IconComponent className={cn("h-6 w-6", style.text)} />
                        </div>
                        <div>
                            {editingTitle !== null ? (
                                <input
                                    type="text"
                                    value={editingTitle}
                                    onChange={(e) => setEditingTitle(e.target.value)}
                                    onBlur={() => {
                                        if (editingTitle.trim() && editingTitle.trim() !== page.title) {
                                            onUpdatePage(page.id, { title: editingTitle.trim() });
                                        }
                                        setEditingTitle(null);
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                        if (e.key === 'Escape') setEditingTitle(null);
                                    }}
                                    autoFocus
                                    className="text-xl font-black text-slate-900 tracking-tight bg-white border-2 border-indigo-200 rounded-xl px-3 py-1 focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none w-full max-w-md"
                                />
                            ) : (
                                <button
                                    onClick={() => setEditingTitle(page.title || '')}
                                    className="group/name flex items-center space-x-2 hover:bg-indigo-50 rounded-xl px-3 py-1 -mx-3 -my-1 transition-colors"
                                >
                                    <h4 className="text-xl font-black text-slate-900 tracking-tight">
                                        {page.title || PAGE_TYPE_LABELS[page.pageType]}
                                    </h4>
                                    <Pencil className="h-3.5 w-3.5 text-slate-300 group-hover/name:text-indigo-500 transition-colors" />
                                </button>
                            )}
                            <div className="flex items-center space-x-2 mt-1">
                                <span className={cn("text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg", style.bg, style.text)}>
                                    {PAGE_TYPE_LABELS[page.pageType]}
                                </span>
                                {page.isLocked && (
                                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center space-x-1">
                                        <Lock className="h-3 w-3" /> <span>Predeterminada</span>
                                    </span>
                                )}
                                <span className="text-sm text-slate-400 font-medium">
                                    · {page.blocks.length} bloque{page.blocks.length !== 1 ? 's' : ''}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Add block buttons */}
                    <div className="flex items-center space-x-3">
                        <button
                            onClick={onAddTextBlock}
                            className="flex items-center space-x-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 px-5 py-3 rounded-2xl transition-all font-black text-[10px] uppercase tracking-widest"
                        >
                            <Type className="h-4 w-4" />
                            <span>Agregar Texto</span>
                        </button>
                        <button
                            onClick={onAddImageBlock}
                            className="flex items-center space-x-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 px-5 py-3 rounded-2xl transition-all font-black text-[10px] uppercase tracking-widest"
                        >
                            <ImagePlus className="h-4 w-4" />
                            <span>Agregar Imagen</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Blocks */}
            <div className="p-8 space-y-6">
                {page.blocks.length === 0 ? (
                    <div className="py-16 text-center">
                        {page.pageType === 'INDEX' ? (
                            <>
                                <ListOrdered className="h-16 w-16 mx-auto text-violet-200 mb-4" />
                                <p className="text-sm font-bold text-slate-400">
                                    El índice se genera automáticamente a partir de las páginas del documento.
                                </p>
                                <p className="text-xs text-slate-300 mt-2">
                                    No requiere contenido manual.
                                </p>
                            </>
                        ) : (
                            <>
                                <FileText className="h-16 w-16 mx-auto text-slate-100 mb-4" />
                                <p className="text-sm font-bold text-slate-400">
                                    Esta página no tiene contenido aún. Use los botones de arriba para agregar texto o imágenes.
                                </p>
                            </>
                        )}
                    </div>
                ) : (
                    <AnimatePresence mode="popLayout">
                        {page.blocks.map((block, idx) => (
                            <motion.div
                                key={block.id}
                                layout
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                            >
                                <BlockEditor
                                    block={block}
                                    index={idx}
                                    totalBlocks={page.blocks.length}
                                    pageId={page.id}
                                    onUpdate={onUpdateBlock}
                                    onDelete={() => onDeleteBlock(page.id, block.id)}
                                    onUploadImage={() => onUploadImageForBlock(block.id)}
                                    uploadImage={uploadImage}
                                    proposalVars={proposalVars}
                                />
                            </motion.div>
                        ))}
                    </AnimatePresence>
                )}
            </div>
        </div>
    );
}

export default PageEditor;
