import { useState, useRef } from 'react';
import { Trash2, ImagePlus } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { type PageBlock } from '../../../hooks/useProposalPages';
import { type ProposalVariables } from '../../../lib/proposalVariables';
import RichTextEditor from '../../../components/proposals/RichTextEditor';

interface BlockEditorProps {
    block: PageBlock;
    index: number;
    totalBlocks: number;
    pageId: string;
    onUpdate: (blockId: string, content: Record<string, unknown>) => void;
    onDelete: () => void;
    onUploadImage: () => void;
    uploadImage: (file: File) => Promise<string | null>;
    proposalVars: ProposalVariables;
}

function BlockEditor({ block, index, totalBlocks, onUpdate, onDelete, uploadImage, proposalVars }: BlockEditorProps) {
    const [captionBuffer, setCaptionBuffer] = useState(
        (block.content as Record<string, string>)?.caption || ''
    );
    const blockFileRef = useRef<HTMLInputElement>(null);

    const handleInlineUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const url = await uploadImage(file);
        if (url) {
            onUpdate(block.id, { ...block.content as object, url });
        }
        if (blockFileRef.current) blockFileRef.current.value = '';
    };

    const isImage = block.blockType === 'IMAGE';
    const imageUrl = (block.content as Record<string, string>)?.url;
    const apiBase = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3000';

    return (
        <div className="group relative bg-slate-50/50 rounded-2xl border-2 border-slate-100 hover:border-indigo-100 transition-all">
            {/* Block header bar */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
                <div className="flex items-center space-x-2">
                    <span className={cn(
                        "text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg",
                        isImage ? "bg-emerald-50 text-emerald-600" : "bg-indigo-50 text-indigo-600"
                    )}>
                        {isImage ? 'Imagen' : 'Texto'}
                    </span>
                    <span className="text-[10px] text-slate-400 font-bold">Bloque {index + 1} de {totalBlocks}</span>
                </div>
                <div className="flex items-center space-x-1">
                    {isImage && (
                        <>
                            <input ref={blockFileRef} type="file" accept="image/*" className="hidden" onChange={handleInlineUpload} />
                            <button
                                onClick={() => blockFileRef.current?.click()}
                                className="p-1.5 rounded-lg text-slate-300 hover:text-emerald-500 hover:bg-emerald-50 transition-colors"
                                title="Cambiar imagen"
                            >
                                <ImagePlus className="h-3.5 w-3.5" />
                            </button>
                        </>
                    )}
                    <button
                        onClick={onDelete}
                        className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                        title="Eliminar bloque"
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                    </button>
                </div>
            </div>

            {/* Block content */}
            <div className="p-5">
                {isImage ? (
                    <div className="space-y-4">
                        {imageUrl ? (
                            <div className="rounded-xl overflow-hidden border border-slate-200 bg-white">
                                <img
                                    src={`${apiBase}${imageUrl}`}
                                    alt={captionBuffer || 'Imagen de propuesta'}
                                    className="w-full max-h-[500px] object-contain"
                                />
                            </div>
                        ) : (
                            <button
                                onClick={() => blockFileRef.current?.click()}
                                className="w-full py-16 border-2 border-dashed border-slate-200 rounded-2xl text-center hover:border-indigo-300 hover:bg-indigo-50/30 transition-all"
                            >
                                <ImagePlus className="h-12 w-12 mx-auto text-slate-300 mb-3" />
                                <p className="text-sm font-bold text-slate-400">Click para subir una imagen</p>
                                <p className="text-[10px] text-slate-300 font-bold mt-1">JPG, PNG, GIF, WebP · Máximo 10MB</p>
                            </button>
                        )}
                        {/* Caption */}
                        <input
                            type="text"
                            value={captionBuffer}
                            onChange={(e) => setCaptionBuffer(e.target.value)}
                            onBlur={() => {
                                if (captionBuffer !== (block.content as Record<string, string>)?.caption) {
                                    onUpdate(block.id, { ...block.content as object, caption: captionBuffer });
                                }
                            }}
                            placeholder="Agregar descripción de la imagen..."
                            className="w-full px-4 py-3 bg-white border-2 border-slate-100 rounded-xl text-sm font-medium text-slate-700 placeholder:text-slate-300 focus:border-indigo-200 focus:ring-0"
                        />
                    </div>
                ) : (
                    <RichTextEditor
                        content={block.content as Record<string, unknown> | null}
                        onUpdate={(content) => onUpdate(block.id, content)}
                        proposalVars={proposalVars}
                    />
                )}
            </div>
        </div>
    );
}

export default BlockEditor;
