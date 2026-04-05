import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Plus, Trash2, Loader2,
    Type, ImagePlus, FileText, BookOpen, Pencil,
    Image as ImageIcon, ListOrdered, FileSignature, Building2,
    CheckCircle2, AlertTriangle, Eye,
    ChevronUp, ChevronDown,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { api } from '../../lib/api';
import RichTextEditor from '../../components/proposals/RichTextEditor';
import PdfPreviewModal from '../../components/proposals/PdfPreviewModal';

/** Template shape from the API */
interface TemplateBlock {
    id: string;
    blockType: 'RICH_TEXT' | 'IMAGE';
    content: Record<string, unknown>;
    sortOrder: number;
}

interface Template {
    id: string;
    name: string;
    templateType: string;
    content: TemplateBlock[];
    sortOrder: number;
    isActive: boolean;
}

const PAGE_TYPE_LABELS: Record<string, string> = {
    COVER: 'Portada',
    PRESENTATION: 'Carta de Presentación',
    COMPANY_INFO: 'Info. General',
    INDEX: 'Índice',
    TERMS: 'Términos y Condiciones',
    CUSTOM: 'Personalizada',
};

const PAGE_TYPE_STYLES: Record<string, { bg: string; text: string; border: string; icon: typeof FileText }> = {
    COVER: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200', icon: ImageIcon },
    PRESENTATION: { bg: 'bg-sky-50', text: 'text-sky-600', border: 'border-sky-200', icon: FileSignature },
    COMPANY_INFO: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200', icon: Building2 },
    INDEX: { bg: 'bg-violet-50', text: 'text-violet-600', border: 'border-violet-200', icon: ListOrdered },
    TERMS: { bg: 'bg-rose-50', text: 'text-rose-600', border: 'border-rose-200', icon: FileText },
    CUSTOM: { bg: 'bg-indigo-50', text: 'text-indigo-600', border: 'border-indigo-200', icon: FileText },
};

const PAGE_TYPES = ['COVER', 'PRESENTATION', 'COMPANY_INFO', 'INDEX', 'TERMS', 'CUSTOM'];

export default function DefaultPagesAdmin() {
    const [templates, setTemplates] = useState<Template[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [newName, setNewName] = useState('');
    const [newType, setNewType] = useState('COVER');
    const [editingTitle, setEditingTitle] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploadingBlockId, setUploadingBlockId] = useState<string | null>(null);
    const [savedMsg, setSavedMsg] = useState(false);
    const [showPreview, setShowPreview] = useState(false);

    const apiBase = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3000';

    const activeTemplate = templates.find(t => t.id === activeId) ?? null;

    const loadTemplates = useCallback(async () => {
        try {
            setLoading(true);
            const res = await api.get('/templates');
            setTemplates(res.data || []);
            if (res.data?.length > 0 && !activeId) {
                setActiveId(res.data[0].id);
            }
        } catch (e) {
            console.error('Error loading templates:', e);
        } finally {
            setLoading(false);
        }
    }, [activeId]);

    useEffect(() => { loadTemplates(); }, []); // eslint-disable-line

    // ── CRUD operations ──

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newName.trim()) return;
        setSaving(true);
        try {
            const res = await api.post('/templates', { name: newName.trim(), templateType: newType });
            setTemplates(prev => [...prev, { ...res.data, content: res.data.content || [] }]);
            setActiveId(res.data.id);
            setIsCreating(false);
            setNewName('');
        } catch (e) {
            console.error(e);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('¿Eliminar esta plantilla? Esta acción no se puede deshacer.')) return;
        try {
            await api.delete(`/templates/${id}`);
            setTemplates(prev => prev.filter(t => t.id !== id));
            if (activeId === id) setActiveId(null);
        } catch (e) {
            console.error(e);
        }
    };

    const handleUpdateTitle = async (id: string, name: string) => {
        try {
            await api.patch(`/templates/${id}`, { name });
            setTemplates(prev => prev.map(t => t.id === id ? { ...t, name } : t));
            flashSaved();
        } catch (e) {
            console.error(e);
        }
    };

    // ── Block operations ──

    const handleAddBlock = async (blockType: 'RICH_TEXT' | 'IMAGE') => {
        if (!activeId) return;
        setSaving(true);
        try {
            const res = await api.post(`/templates/${activeId}/blocks`, { blockType, content: {} });
            setTemplates(prev => prev.map(t => {
                if (t.id !== activeId) return t;
                return { ...t, content: [...t.content, res.data] };
            }));
            if (blockType === 'IMAGE') {
                setUploadingBlockId(res.data.id);
                fileInputRef.current?.click();
            }
            flashSaved();
        } catch (e) {
            console.error(e);
        } finally {
            setSaving(false);
        }
    };

    const handleUpdateBlock = async (blockId: string, content: Record<string, unknown>) => {
        if (!activeId) return;
        try {
            await api.patch(`/templates/${activeId}/blocks/${blockId}`, { content });
            setTemplates(prev => prev.map(t => {
                if (t.id !== activeId) return t;
                return {
                    ...t,
                    content: t.content.map(b => b.id === blockId ? { ...b, content } : b),
                };
            }));
            flashSaved();
        } catch (e) {
            console.error(e);
        }
    };

    const handleDeleteBlock = async (blockId: string) => {
        if (!activeId) return;
        try {
            await api.delete(`/templates/${activeId}/blocks/${blockId}`);
            setTemplates(prev => prev.map(t => {
                if (t.id !== activeId) return t;
                return { ...t, content: t.content.filter(b => b.id !== blockId) };
            }));
        } catch (e) {
            console.error(e);
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !uploadingBlockId || !activeId) return;
        try {
            const form = new FormData();
            form.append('file', file);
            const res = await api.post(
                `/templates/${activeId}/blocks/${uploadingBlockId}/image`,
                form,
                { headers: { 'Content-Type': 'multipart/form-data' } },
            );
            setTemplates(prev => prev.map(t => {
                if (t.id !== activeId) return t;
                return {
                    ...t,
                    content: t.content.map(b => b.id === uploadingBlockId ? { ...b, content: res.data.content } : b),
                };
            }));
            flashSaved();
        } catch (e) {
            console.error(e);
        } finally {
            setUploadingBlockId(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleInlineImageUpload = (blockId: string) => {
        setUploadingBlockId(blockId);
        fileInputRef.current?.click();
    };

    const flashSaved = () => {
        setSavedMsg(true);
        setTimeout(() => setSavedMsg(false), 2000);
    };

    const moveTemplate = async (index: number, direction: 'up' | 'down') => {
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= templates.length) return;
        const newTemplates = [...templates];
        [newTemplates[index], newTemplates[newIndex]] = [newTemplates[newIndex], newTemplates[index]];
        setTemplates(newTemplates);
        try {
            const res = await api.patch('/templates/reorder', { templateIds: newTemplates.map(t => t.id) });
            setTemplates(res.data || newTemplates);
        } catch (e) {
            console.error(e);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
            </div>
        );
    }

    return (
        <div className="max-w-[1600px] mx-auto space-y-6 px-4 pb-20">
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 flex items-center">
                        <BookOpen className="h-8 w-8 mr-3 text-indigo-600" />
                        Plantillas de Documento
                    </h2>
                    <p className="text-slate-500 text-sm font-medium mt-1">
                        Configure las páginas por defecto que se usarán en todas las propuestas comerciales.
                    </p>
                </div>

                <div className="flex items-center space-x-4">
                    <AnimatePresence>
                        {savedMsg && (
                            <motion.div
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                className="flex items-center space-x-2 bg-emerald-50 text-emerald-700 px-5 py-3 rounded-2xl border border-emerald-200"
                            >
                                <CheckCircle2 className="h-4 w-4" />
                                <span className="text-xs font-black uppercase tracking-widest">Guardado</span>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <button
                        onClick={() => setShowPreview(true)}
                        className="flex items-center space-x-3 px-6 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-2xl shadow-lg shadow-indigo-200 hover:shadow-xl hover:shadow-indigo-300 transition-all font-black text-[10px] uppercase tracking-widest"
                    >
                        <Eye className="h-4 w-4" />
                        <span>Vista Previa PDF</span>
                    </button>
                </div>
            </div>

            {/* PDF Preview Modal */}
            <AnimatePresence>
                {showPreview && (
                    <PdfPreviewModal
                        pages={templates.map(t => ({
                            id: t.id,
                            proposalId: 'admin-preview',
                            pageType: t.templateType as any,
                            title: t.name,
                            variables: null,
                            isLocked: true,
                            sortOrder: t.sortOrder,
                            blocks: t.content as any
                        }))}
                        onClose={() => setShowPreview(false)}
                    />
                )}
            </AnimatePresence>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Sidebar — Templates list */}
                <div className="lg:col-span-3 space-y-4">
                    <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Plantillas</h3>
                            <button
                                onClick={() => setIsCreating(true)}
                                className="p-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-all scale-90"
                                title="Crear nueva plantilla"
                            >
                                <Plus className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="space-y-2">
                            {templates.map((tpl, idx) => {
                                const style = PAGE_TYPE_STYLES[tpl.templateType] || PAGE_TYPE_STYLES.CUSTOM;
                                const isActive = activeId === tpl.id;
                                const IconComponent = style.icon;

                                return (
                                    <div
                                        key={tpl.id}
                                        onClick={() => setActiveId(tpl.id)}
                                        className={cn(
                                            "group flex items-center justify-between p-4 rounded-2xl cursor-pointer transition-all border-2",
                                            isActive
                                                ? "bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100"
                                                : "bg-slate-50 border-transparent hover:bg-white hover:border-indigo-100 text-slate-600"
                                        )}
                                    >
                                        <div className="flex items-center space-x-3 min-w-0 flex-1">
                                            <IconComponent className={cn("h-4 w-4 shrink-0", isActive ? "text-indigo-200" : style.text)} />
                                            <div className="min-w-0">
                                                <span className="text-sm font-black tracking-tight truncate block">
                                                    {tpl.name}
                                                </span>
                                                <span className={cn(
                                                    "text-[9px] font-black uppercase tracking-widest",
                                                    isActive ? "text-indigo-200" : "text-slate-400"
                                                )}>
                                                    {PAGE_TYPE_LABELS[tpl.templateType] || tpl.templateType}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center shrink-0 gap-0.5">
                                            <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); moveTemplate(idx, 'up'); }}
                                                    disabled={idx === 0}
                                                    className={cn(
                                                        "p-0.5 rounded transition-colors disabled:opacity-30",
                                                        isActive ? "text-indigo-200 hover:bg-indigo-500" : "text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                                                    )}
                                                    title="Subir"
                                                >
                                                    <ChevronUp className="h-3.5 w-3.5" />
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); moveTemplate(idx, 'down'); }}
                                                    disabled={idx === templates.length - 1}
                                                    className={cn(
                                                        "p-0.5 rounded transition-colors disabled:opacity-30",
                                                        isActive ? "text-indigo-200 hover:bg-indigo-500" : "text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                                                    )}
                                                    title="Bajar"
                                                >
                                                    <ChevronDown className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleDelete(tpl.id); }}
                                                className={cn(
                                                    "p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity",
                                                    isActive ? "hover:bg-indigo-500 text-indigo-200" : "hover:bg-red-50 text-slate-400 hover:text-red-500"
                                                )}
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}

                            {/* Create form */}
                            {isCreating && (
                                <motion.form
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    onSubmit={handleCreate}
                                    className="p-3 space-y-3 bg-white rounded-2xl border-2 border-indigo-100"
                                >
                                    <input
                                        autoFocus
                                        type="text"
                                        placeholder="Nombre de la plantilla..."
                                        value={newName}
                                        onChange={e => setNewName(e.target.value)}
                                        className="w-full px-3 py-2 rounded-xl bg-slate-50 border-2 border-slate-100 text-sm font-bold focus:ring-0 focus:border-indigo-200"
                                    />
                                    <select
                                        value={newType}
                                        onChange={e => setNewType(e.target.value)}
                                        className="w-full px-3 py-2 rounded-xl bg-slate-50 border-2 border-slate-100 text-sm font-bold focus:ring-0 focus:border-indigo-200"
                                    >
                                        {PAGE_TYPES.map(pt => (
                                            <option key={pt} value={pt}>{PAGE_TYPE_LABELS[pt] || pt}</option>
                                        ))}
                                    </select>
                                    <div className="flex space-x-2">
                                        <button type="submit" disabled={saving} className="flex-1 bg-indigo-600 text-white py-2 rounded-xl text-[10px] font-black uppercase tracking-widest">
                                            {saving ? <Loader2 className="h-3 w-3 animate-spin mx-auto" /> : "Crear"}
                                        </button>
                                        <button type="button" onClick={() => setIsCreating(false)} className="px-3 py-2 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                                            Cancelar
                                        </button>
                                    </div>
                                </motion.form>
                            )}

                            {templates.length === 0 && !isCreating && (
                                <div className="py-8 text-center">
                                    <AlertTriangle className="h-8 w-8 mx-auto text-amber-300 mb-3" />
                                    <p className="text-xs font-bold text-slate-400">
                                        No hay plantillas configuradas. Se usarán los valores por defecto.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="bg-indigo-50/80 border-2 border-indigo-200 rounded-2xl p-4">
                        <p className="text-xs font-bold text-indigo-700">💡 Cómo funciona</p>
                        <p className="text-[10px] text-indigo-600 mt-1 leading-relaxed">
                            Las plantillas que configure aquí se copiarán automáticamente como páginas predeterminadas cuando cualquier usuario comercial cree una nueva propuesta.
                        </p>
                    </div>
                </div>

                {/* Main Content — Template Editor */}
                <div className="lg:col-span-9">
                    {activeTemplate ? (
                        <TemplateEditor
                            template={activeTemplate}
                            editingTitle={editingTitle}
                            setEditingTitle={setEditingTitle}
                            onUpdateTitle={handleUpdateTitle}
                            onAddBlock={handleAddBlock}
                            onUpdateBlock={handleUpdateBlock}
                            onDeleteBlock={handleDeleteBlock}
                            onUploadImage={handleInlineImageUpload}
                            apiBase={apiBase}
                        />
                    ) : (
                        <div className="bg-white rounded-[2.5rem] p-32 text-center border-2 border-dashed border-slate-100">
                            <BookOpen className="h-20 w-20 mx-auto text-slate-100 mb-6" />
                            <h4 className="text-xl font-black text-slate-300 uppercase tracking-tight">
                                Seleccione una plantilla para editar
                            </h4>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ── Template Editor ───────────────────────────────────────

function TemplateEditor({
    template, editingTitle, setEditingTitle,
    onUpdateTitle, onAddBlock, onUpdateBlock, onDeleteBlock, onUploadImage, apiBase,
}: {
    template: Template;
    editingTitle: string | null;
    setEditingTitle: (v: string | null) => void;
    onUpdateTitle: (id: string, name: string) => void;
    onAddBlock: (type: 'RICH_TEXT' | 'IMAGE') => void;
    onUpdateBlock: (blockId: string, content: Record<string, unknown>) => void;
    onDeleteBlock: (blockId: string) => void;
    onUploadImage: (blockId: string) => void;
    apiBase: string;
}) {
    const style = PAGE_TYPE_STYLES[template.templateType] || PAGE_TYPE_STYLES.CUSTOM;
    const IconComponent = style.icon;
    const blocks = template.content || [];

    return (
        <div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-100 border border-slate-100 overflow-hidden">
            {/* Header */}
            <div className="p-8 bg-slate-50/50 border-b border-slate-100">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                        <div className={cn("p-3 rounded-2xl shadow-lg border", style.bg, style.border)}>
                            <IconComponent className={cn("h-6 w-6", style.text)} />
                        </div>
                        <div>
                            {editingTitle !== null ? (
                                <input
                                    type="text"
                                    value={editingTitle}
                                    onChange={(e) => setEditingTitle(e.target.value)}
                                    onBlur={() => {
                                        if (editingTitle.trim() && editingTitle.trim() !== template.name) {
                                            onUpdateTitle(template.id, editingTitle.trim());
                                        }
                                        setEditingTitle(null);
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                        if (e.key === 'Escape') setEditingTitle(null);
                                    }}
                                    autoFocus
                                    className="text-xl font-black text-slate-900 tracking-tight bg-white border-2 border-indigo-200 rounded-xl px-3 py-1 focus:ring-2 focus:ring-indigo-400 outline-none max-w-md"
                                />
                            ) : (
                                <button
                                    onClick={() => setEditingTitle(template.name)}
                                    className="group/name flex items-center space-x-2 hover:bg-indigo-50 rounded-xl px-3 py-1 -mx-3 -my-1 transition-colors"
                                >
                                    <h4 className="text-xl font-black text-slate-900 tracking-tight">{template.name}</h4>
                                    <Pencil className="h-3.5 w-3.5 text-slate-300 group-hover/name:text-indigo-500" />
                                </button>
                            )}
                            <div className="flex items-center space-x-2 mt-1">
                                <span className={cn("text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg", style.bg, style.text)}>
                                    {PAGE_TYPE_LABELS[template.templateType] || template.templateType}
                                </span>
                                <span className="text-sm text-slate-400 font-medium">
                                    · {blocks.length} bloque{blocks.length !== 1 ? 's' : ''}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center space-x-3">
                        <button
                            onClick={() => onAddBlock('RICH_TEXT')}
                            className="flex items-center space-x-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 px-5 py-3 rounded-2xl transition-all font-black text-[10px] uppercase tracking-widest"
                        >
                            <Type className="h-4 w-4" />
                            <span>Agregar Texto</span>
                        </button>
                        <button
                            onClick={() => onAddBlock('IMAGE')}
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
                {template.templateType === 'INDEX' && blocks.length === 0 ? (
                    <div className="py-16 text-center">
                        <ListOrdered className="h-16 w-16 mx-auto text-violet-200 mb-4" />
                        <p className="text-sm font-bold text-slate-400">El índice se genera automáticamente.</p>
                        <p className="text-xs text-slate-300 mt-2">No requiere contenido manual.</p>
                    </div>
                ) : blocks.length === 0 ? (
                    <div className="py-16 text-center">
                        <FileText className="h-16 w-16 mx-auto text-slate-100 mb-4" />
                        <p className="text-sm font-bold text-slate-400">
                            Esta plantilla no tiene contenido. Use los botones de arriba para agregar texto o imágenes.
                        </p>
                    </div>
                ) : (
                    blocks.map((block, idx) => (
                        <TemplateBlockEditor
                            key={block.id}
                            block={block}
                            index={idx}
                            total={blocks.length}
                            onUpdate={(content) => onUpdateBlock(block.id, content)}
                            onDelete={() => onDeleteBlock(block.id)}
                            onUploadImage={() => onUploadImage(block.id)}
                            apiBase={apiBase}
                        />
                    ))
                )}
            </div>
        </div>
    );
}

// ── Block Editor ──────────────────────────────────────────

function TemplateBlockEditor({
    block, index, total, onUpdate, onDelete, onUploadImage, apiBase,
}: {
    block: TemplateBlock;
    index: number;
    total: number;
    onUpdate: (content: Record<string, unknown>) => void;
    onDelete: () => void;
    onUploadImage: () => void;
    apiBase: string;
}) {
    const [captionBuffer, setCaptionBuffer] = useState(
        (block.content as Record<string, string>)?.caption || ''
    );

    const isImage = block.blockType === 'IMAGE';
    const imageUrl = (block.content as Record<string, string>)?.url;

    return (
        <div className="group relative bg-slate-50/50 rounded-2xl border-2 border-slate-100 hover:border-indigo-100 transition-all">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
                <div className="flex items-center space-x-2">
                    <span className={cn(
                        "text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg",
                        isImage ? "bg-emerald-50 text-emerald-600" : "bg-indigo-50 text-indigo-600"
                    )}>
                        {isImage ? 'Imagen' : 'Texto'}
                    </span>
                    <span className="text-[10px] text-slate-400 font-bold">Bloque {index + 1} de {total}</span>
                </div>
                <div className="flex items-center space-x-1">
                    {isImage && (
                        <button onClick={onUploadImage} className="p-1.5 rounded-lg text-slate-300 hover:text-emerald-500 hover:bg-emerald-50 transition-colors" title="Cambiar imagen">
                            <ImagePlus className="h-3.5 w-3.5" />
                        </button>
                    )}
                    <button onClick={onDelete} className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors" title="Eliminar bloque">
                        <Trash2 className="h-3.5 w-3.5" />
                    </button>
                </div>
            </div>

            <div className="p-5">
                {isImage ? (
                    <div className="space-y-4">
                        {imageUrl ? (
                            <div className="rounded-xl overflow-hidden border border-slate-200 bg-white">
                                <img
                                    src={`${apiBase}${imageUrl}`}
                                    alt={captionBuffer || 'Imagen de plantilla'}
                                    className="w-full max-h-[500px] object-contain"
                                />
                            </div>
                        ) : (
                            <button
                                onClick={onUploadImage}
                                className="w-full py-16 border-2 border-dashed border-slate-200 rounded-2xl text-center hover:border-indigo-300 hover:bg-indigo-50/30 transition-all"
                            >
                                <ImagePlus className="h-12 w-12 mx-auto text-slate-300 mb-3" />
                                <p className="text-sm font-bold text-slate-400">Click para subir una imagen</p>
                            </button>
                        )}
                        <input
                            type="text"
                            value={captionBuffer}
                            onChange={e => setCaptionBuffer(e.target.value)}
                            onBlur={() => {
                                if (captionBuffer !== (block.content as Record<string, string>)?.caption) {
                                    onUpdate({ ...block.content as object, caption: captionBuffer });
                                }
                            }}
                            placeholder="Descripción de la imagen..."
                            className="w-full px-4 py-3 bg-white border-2 border-slate-100 rounded-xl text-sm font-medium text-slate-700 placeholder:text-slate-300 focus:border-indigo-200 focus:ring-0"
                        />
                    </div>
                ) : (
                    <RichTextEditor
                        content={block.content as Record<string, unknown> | null}
                        onUpdate={(content) => onUpdate(content)}
                    />
                )}
            </div>
        </div>
    );
}
