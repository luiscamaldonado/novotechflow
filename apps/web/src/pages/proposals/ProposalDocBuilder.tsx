import { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    FileText, Plus, Trash2, ArrowLeft, Loader2,
    Lock, GripVertical, Type, ImagePlus,
    BookOpen, Pencil, Eye, ShieldAlert,
    Image as ImageIcon, ListOrdered, FileSignature, Building2,
    ChevronUp, ChevronDown, MapPin,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useProposalPages, type ProposalPage, type PageBlock } from '../../hooks/useProposalPages';
import { useAuthStore } from '../../store/authStore';
import RichTextEditor from '../../components/proposals/RichTextEditor';
import PdfPreviewModal from '../../components/proposals/PdfPreviewModal';
import { api } from '../../lib/api';
import type { ProposalDetail } from '../../lib/types';
import { COLOMBIAN_CAPITAL_CITIES } from '../../lib/colombianCities';
import { type ProposalVariables, formatDateSpanish, buildGarantiaLines } from '../../lib/proposalVariables';

/** Page type display labels */
const PAGE_TYPE_LABELS: Record<string, string> = {
    COVER: 'Portada',
    PRESENTATION: 'Carta de Presentación',
    COMPANY_INFO: 'Info. General',
    INDEX: 'Índice',
    TERMS: 'Términos y Condiciones',
    CUSTOM: 'Página Personalizada',
};

/** Page type icons & colors */
const PAGE_TYPE_STYLES: Record<string, { bg: string; text: string; border: string; icon: typeof FileText }> = {
    COVER: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200', icon: ImageIcon },
    PRESENTATION: { bg: 'bg-sky-50', text: 'text-sky-600', border: 'border-sky-200', icon: FileSignature },
    COMPANY_INFO: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200', icon: Building2 },
    INDEX: { bg: 'bg-violet-50', text: 'text-violet-600', border: 'border-violet-200', icon: ListOrdered },
    TERMS: { bg: 'bg-rose-50', text: 'text-rose-600', border: 'border-rose-200', icon: FileText },
    CUSTOM: { bg: 'bg-indigo-50', text: 'text-indigo-600', border: 'border-indigo-200', icon: FileText },
};

export default function ProposalDocBuilder() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const isAdmin = user?.role === 'ADMIN';

    const {
        loading, saving, pages, activePageId, setActivePageId, activePage,
        loadPages, createPage, updatePage, deletePage, reorderPages,
        createBlock, updateBlock, deleteBlock, uploadImage,
    } = useProposalPages(id);

    const movePage = (index: number, direction: 'up' | 'down') => {
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= pages.length) return;
        const newPages = [...pages];
        [newPages[index], newPages[newIndex]] = [newPages[newIndex], newPages[index]];
        reorderPages(newPages.map(p => p.id));
    };

    const [isCreatingPage, setIsCreatingPage] = useState(false);
    const [newPageTitle, setNewPageTitle] = useState('');
    const [editingTitle, setEditingTitle] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploadingBlockId, setUploadingBlockId] = useState<string | null>(null);
    const [showPreview, setShowPreview] = useState(false);

    // ── Proposal metadata for µ marker replacements ──────────
    const [proposal, setProposal] = useState<ProposalDetail | null>(null);
    const [selectedCity, setSelectedCity] = useState<string>('Bogotá D.C.');

    useEffect(() => {
        if (!id) return;
        api.get(`/proposals/${id}`).then(res => {
            const data = res.data;
            if (data.issueDate) data.issueDate = data.issueDate.split('T')[0];
            if (data.validityDate) data.validityDate = data.validityDate.split('T')[0];
            setProposal(data);
        }).catch(err => console.error('Error loading proposal metadata', err));
    }, [id]);

    /** Variables de propuesta para reemplazo de marcadores µ */
    const proposalVars = useMemo<ProposalVariables>(() => {
        // Construir texto de validez: "15 de abril de 2026 (15 días)"
        let validezText = '';
        if (proposal?.validityDate) {
            validezText = formatDateSpanish(proposal.validityDate);
            if (proposal.validityDays) {
                validezText += ` (${proposal.validityDays} días)`;
            }
        }

        // Construir líneas de garantía basadas en marcas de los ítems
        const garantiaLines = proposal?.proposalItems
            ? buildGarantiaLines(proposal.proposalItems)
            : [];

        return {
            ciudad: selectedCity,
            fechaEmision: proposal?.issueDate ? formatDateSpanish(proposal.issueDate) : '',
            cliente: proposal?.clientName || '',
            cotizacion: proposal?.proposalCode || '',
            asunto: proposal?.subject || '',
            validez: validezText,
            garantiaLines,
        };
    }, [selectedCity, proposal]);

    useEffect(() => {
        loadPages();
    }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleCreatePage = async (e: React.FormEvent) => {
        e.preventDefault();
        const ok = await createPage(newPageTitle);
        if (ok) {
            setNewPageTitle('');
            setIsCreatingPage(false);
        }
    };

    const handleAddTextBlock = async () => {
        if (!activePageId) return;
        await createBlock(activePageId, 'RICH_TEXT');
    };

    const handleAddImageBlock = async () => {
        if (!activePageId) return;
        const block = await createBlock(activePageId, 'IMAGE');
        if (block) {
            setUploadingBlockId(block.id);
            fileInputRef.current?.click();
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !uploadingBlockId) return;

        const url = await uploadImage(file);
        if (url) {
            await updateBlock(uploadingBlockId, { url, caption: '' });
        }
        setUploadingBlockId(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleImageUploadForBlock = (blockId: string) => {
        setUploadingBlockId(blockId);
        fileInputRef.current?.click();
    };

    /** Check whether the current user can edit the active page */
    const canEditPage = (page: ProposalPage | null): boolean => {
        if (!page) return false;
        // Locked (default) pages can only be edited by admin
        if (page.isLocked) return isAdmin;
        // Custom pages can be edited by anyone
        return true;
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
            {/* Hidden file input for image upload */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
            />

            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <button
                        onClick={() => navigate(`/proposals/${id}/calculations`)}
                        className="p-3 bg-white border border-slate-100 rounded-2xl shadow-sm text-slate-400 hover:text-indigo-600 transition-colors"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </button>
                    <div>
                        <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 flex items-center">
                            <BookOpen className="h-8 w-8 mr-3 text-indigo-600" />
                            Construcción del Documento
                        </h2>
                        <p className="text-slate-500 text-sm font-medium mt-1">
                            Propuesta Comercial · Tamaño Carta (8.5&quot; × 11&quot;)
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => setShowPreview(true)}
                    className="flex items-center space-x-3 px-6 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-2xl shadow-lg shadow-indigo-200 hover:shadow-xl hover:shadow-indigo-300 transition-all font-black text-[10px] uppercase tracking-widest"
                >
                    <Eye className="h-4 w-4" />
                    <span>Vista Previa PDF</span>
                </button>
            </div>

            {/* City selector bar */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex items-center gap-6 flex-wrap">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-50 rounded-xl">
                        <MapPin className="h-4 w-4 text-indigo-600" />
                    </div>
                    <CityCombobox value={selectedCity} onChange={setSelectedCity} />
                </div>
                {proposal && (
                    <>
                        <div className="h-8 w-px bg-slate-200" />
                        <div>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Cliente</span>
                            <span className="text-sm font-bold text-slate-800">{proposal.clientName}</span>
                        </div>
                        <div className="h-8 w-px bg-slate-200" />
                        <div>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Cotización</span>
                            <span className="text-sm font-mono font-bold text-indigo-600">{proposal.proposalCode}</span>
                        </div>
                        <div className="h-8 w-px bg-slate-200" />
                        <div>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Fecha Emisión</span>
                            <span className="text-sm font-bold text-slate-800">{formatDateSpanish(proposal.issueDate)}</span>
                        </div>
                        <div className="h-8 w-px bg-slate-200" />
                        <div className="flex-1 min-w-0">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Asunto</span>
                            <span className="text-sm font-bold text-slate-800 truncate block">{proposal.subject}</span>
                        </div>
                    </>
                )}
            </div>

            {/* PDF Preview Modal */}
            <AnimatePresence>
                {showPreview && (
                    <PdfPreviewModal
                        pages={pages}
                        onClose={() => setShowPreview(false)}
                        proposalVars={proposalVars}
                    />
                )}
            </AnimatePresence>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Sidebar — Pages */}
                <div className="lg:col-span-3 space-y-4">
                    <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Páginas</h3>
                            <button
                                onClick={() => setIsCreatingPage(true)}
                                className="p-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-all scale-90"
                                title="Agregar página personalizada"
                            >
                                <Plus className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="space-y-2">
                            <AnimatePresence mode="popLayout">
                                {pages.map((page, idx) => {
                                    const style = PAGE_TYPE_STYLES[page.pageType] || PAGE_TYPE_STYLES.CUSTOM;
                                    const isActive = activePageId === page.id;
                                    const IconComponent = style.icon;

                                    return (
                                        <motion.div
                                            key={page.id}
                                            layout
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -20 }}
                                            onClick={() => setActivePageId(page.id)}
                                            className={cn(
                                                "group flex items-center justify-between p-4 rounded-2xl cursor-pointer transition-all border-2",
                                                isActive
                                                    ? "bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100"
                                                    : "bg-slate-50 border-transparent hover:bg-white hover:border-indigo-100 text-slate-600"
                                            )}
                                        >
                                            <div className="flex items-center space-x-3 min-w-0 flex-1">
                                                {page.isLocked ? (
                                                    <Lock className={cn("h-4 w-4 shrink-0", isActive ? "text-indigo-200" : "text-slate-400")} />
                                                ) : (
                                                    <GripVertical className={cn("h-4 w-4 shrink-0", isActive ? "text-indigo-200" : "text-slate-300")} />
                                                )}
                                                <div className="min-w-0">
                                                    <span className="text-sm font-black tracking-tight truncate block">
                                                        {idx + 1}. {page.title || PAGE_TYPE_LABELS[page.pageType]}
                                                    </span>
                                                    <span className={cn(
                                                        "text-[9px] font-black uppercase tracking-widest",
                                                        isActive ? "text-indigo-200" : "text-slate-400"
                                                    )}>
                                                        {PAGE_TYPE_LABELS[page.pageType]}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex items-center shrink-0 gap-0.5">
                                                <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); movePage(idx, 'up'); }}
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
                                                        onClick={(e) => { e.stopPropagation(); movePage(idx, 'down'); }}
                                                        disabled={idx === pages.length - 1}
                                                        className={cn(
                                                            "p-0.5 rounded transition-colors disabled:opacity-30",
                                                            isActive ? "text-indigo-200 hover:bg-indigo-500" : "text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                                                        )}
                                                        title="Bajar"
                                                    >
                                                        <ChevronDown className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                                {!page.isLocked && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); deletePage(page.id); }}
                                                        className={cn(
                                                            "p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity",
                                                            isActive ? "hover:bg-indigo-500 text-indigo-200" : "hover:bg-red-50 text-slate-400 hover:text-red-500"
                                                        )}
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </AnimatePresence>

                            {isCreatingPage && (
                                <motion.form
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    onSubmit={handleCreatePage}
                                    className="p-2 space-y-3"
                                >
                                    <input
                                        autoFocus
                                        type="text"
                                        placeholder="Nombre de la página..."
                                        value={newPageTitle}
                                        onChange={(e) => setNewPageTitle(e.target.value)}
                                        className="w-full px-4 py-3 rounded-xl bg-white border-2 border-indigo-100 text-sm font-bold focus:ring-0"
                                    />
                                    <div className="flex space-x-2">
                                        <button
                                            type="submit"
                                            disabled={saving}
                                            className="flex-1 bg-indigo-600 text-white py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex justify-center items-center"
                                        >
                                            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Crear"}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setIsCreatingPage(false)}
                                            className="px-4 py-2 text-slate-400 text-[10px] font-black uppercase tracking-widest"
                                        >
                                            Cancelar
                                        </button>
                                    </div>
                                </motion.form>
                            )}

                            {pages.length === 0 && !isCreatingPage && (
                                <div className="py-8 text-center px-4">
                                    <FileText className="h-10 w-10 mx-auto text-slate-200 mb-3" />
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
                                        Cargando páginas...
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Admin notice */}
                    {!isAdmin && (
                        <div className="bg-amber-50/80 border-2 border-amber-200 rounded-2xl p-4 flex items-start space-x-3">
                            <ShieldAlert className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-xs font-bold text-amber-700">Páginas Predeterminadas</p>
                                <p className="text-[10px] text-amber-600 mt-1 leading-relaxed">
                                    Las páginas con candado solo pueden ser editadas por un administrador.
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Main Content — Page Editor */}
                <div className="lg:col-span-9 space-y-6">
                    {activePage ? (
                        canEditPage(activePage) ? (
                            <PageEditor
                                page={activePage}
                                editingTitle={editingTitle}
                                setEditingTitle={setEditingTitle}
                                onUpdatePage={updatePage}
                                onCreateBlock={createBlock}
                                onUpdateBlock={updateBlock}
                                onDeleteBlock={deleteBlock}
                                onAddTextBlock={handleAddTextBlock}
                                onAddImageBlock={handleAddImageBlock}
                                onUploadImageForBlock={handleImageUploadForBlock}
                                uploadImage={uploadImage}
                                isAdmin={isAdmin}
                                proposalVars={proposalVars}
                            />
                        ) : (
                            <LockedPageView page={activePage} />
                        )
                    ) : (
                        <div className="bg-white rounded-[2.5rem] p-32 text-center border-2 border-dashed border-slate-100">
                            <BookOpen className="h-20 w-20 mx-auto text-slate-100 mb-6" />
                            <h4 className="text-xl font-black text-slate-300 uppercase tracking-tight">
                                Seleccione una página para editar su contenido.
                            </h4>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ── City Combobox (searchable dropdown) ──────────────────────

function CityCombobox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    const [query, setQuery] = useState(value);
    const [open, setOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    const filtered = useMemo(() => {
        if (!query.trim()) return COLOMBIAN_CAPITAL_CITIES;
        const lower = query.toLowerCase();
        return COLOMBIAN_CAPITAL_CITIES.filter(c => c.toLowerCase().includes(lower));
    }, [query]);

    // Sync external value changes
    useEffect(() => { setQuery(value); }, [value]);

    // Close on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
                setOpen(false);
                // Reset query to current value if nothing selected
                setQuery(value);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [value]);

    const handleSelect = (city: string) => {
        onChange(city);
        setQuery(city);
        setOpen(false);
    };

    return (
        <div ref={wrapperRef} className="relative">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
                Ciudad de emisión
            </label>
            <div className="flex items-center mt-0.5">
                <input
                    id="city-selector"
                    type="text"
                    value={query}
                    onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
                    onFocus={() => setOpen(true)}
                    onKeyDown={(e) => {
                        if (e.key === 'Escape') { setOpen(false); setQuery(value); }
                        if (e.key === 'Enter' && filtered.length > 0) {
                            e.preventDefault();
                            handleSelect(filtered[0]);
                        }
                    }}
                    placeholder="Buscar ciudad..."
                    className="bg-transparent border-none text-sm font-bold text-slate-800 focus:ring-0 p-0 w-44 placeholder:text-slate-300 placeholder:font-normal"
                    autoComplete="off"
                />
                <button
                    type="button"
                    onClick={() => setOpen(!open)}
                    className="p-0.5 text-slate-400 hover:text-indigo-600 transition-colors"
                >
                    <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
                </button>
            </div>

            <AnimatePresence>
                {open && filtered.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.15 }}
                        className="absolute z-50 top-full left-0 mt-2 w-64 max-h-56 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-xl shadow-slate-200/50"
                    >
                        {filtered.map(city => (
                            <button
                                key={city}
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => handleSelect(city)}
                                className={cn(
                                    "w-full text-left px-4 py-2.5 text-sm transition-colors",
                                    city === value
                                        ? "bg-indigo-50 text-indigo-700 font-bold"
                                        : "text-slate-700 hover:bg-slate-50 font-medium"
                                )}
                            >
                                {city}
                            </button>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>

            {open && filtered.length === 0 && (
                <div className="absolute z-50 top-full left-0 mt-2 w-64 bg-white border border-slate-200 rounded-xl shadow-xl p-4 text-center">
                    <p className="text-xs text-slate-400 font-medium">No se encontraron ciudades</p>
                </div>
            )}
        </div>
    );
}

// ── Locked Page View (read-only for non-admins) ──────────────

function LockedPageView({ page }: { page: ProposalPage }) {
    const style = PAGE_TYPE_STYLES[page.pageType] || PAGE_TYPE_STYLES.CUSTOM;
    const IconComponent = style.icon;

    return (
        <div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-100 border border-slate-100">
            <div className="p-8 bg-slate-50/50 border-b border-slate-100">
                <div className="flex items-center space-x-4">
                    <div className={cn("p-3 rounded-2xl shadow-lg", style.bg, style.border, "border")}>
                        <IconComponent className={cn("h-6 w-6", style.text)} />
                    </div>
                    <div>
                        <h4 className="text-xl font-black text-slate-900 tracking-tight">
                            {page.title || PAGE_TYPE_LABELS[page.pageType]}
                        </h4>
                        <div className="flex items-center space-x-2 mt-1">
                            <span className={cn("text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg", style.bg, style.text)}>
                                {PAGE_TYPE_LABELS[page.pageType]}
                            </span>
                            <Lock className="h-3 w-3 text-slate-400" />
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Solo Administrador</span>
                        </div>
                    </div>
                </div>
            </div>
            <div className="p-16 text-center">
                <ShieldAlert className="h-16 w-16 mx-auto text-amber-200 mb-4" />
                <h4 className="text-lg font-black text-slate-300">Página Predeterminada</h4>
                <p className="text-sm text-slate-400 mt-2 max-w-sm mx-auto">
                    Esta página es parte de la estructura base del documento. Solo un administrador puede modificar su contenido y orden.
                </p>
            </div>
        </div>
    );
}

// ── Page Editor Sub-Component ────────────────────────────────

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
    onAddTextBlock, onAddImageBlock, onUploadImageForBlock, uploadImage, isAdmin,
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

// ── Block Editor Sub-Component ───────────────────────────────

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

function BlockEditor({ block, index, totalBlocks, onUpdate, onDelete, onUploadImage, uploadImage, proposalVars }: BlockEditorProps) {
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
