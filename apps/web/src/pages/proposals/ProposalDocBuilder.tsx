import { useEffect, useState, useRef, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    FileText, Plus, Trash2, Loader2,
    Lock, GripVertical,
    BookOpen, Eye, ShieldAlert,
    ChevronUp, ChevronDown, MapPin, Cpu, DollarSign,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useProposalPages, type ProposalPage } from '../../hooks/useProposalPages';
import { useProposalScenarios } from '../../hooks/useProposalScenarios';
import { useAuthStore } from '../../store/authStore';
import PdfPreviewModal from '../../components/proposals/PdfPreviewModal';
import { api } from '../../lib/api';
import type { ProposalDetail } from '../../lib/types';
import { type ProposalVariables, formatDateSpanish, buildGarantiaLines } from '../../lib/proposalVariables';
import { PAGE_TYPE_LABELS, VIRTUAL_TECH_SPEC_ID, VIRTUAL_ECONOMIC_ID } from '../../lib/constants';
import CityCombobox from './components/CityCombobox';
import LockedPageView from './components/LockedPageView';
import VirtualSectionPreview from './components/VirtualSectionPreview';
import PageEditor from './components/PageEditor';
import ProposalStepper from '../../components/proposals/ProposalStepper';
import ProposalNavBar from '../../components/proposals/ProposalNavBar';

export default function ProposalDocBuilder() {
    const { id } = useParams<{ id: string }>();
    const { user } = useAuthStore();
    const isAdmin = user?.role === 'ADMIN';

    const {
        loading, saving, pages, activePageId, setActivePageId, activePage,
        loadPages, createPage, updatePage, deletePage, reorderPages,
        createBlock, updateBlock, deleteBlock, uploadImage,
    } = useProposalPages(id);

    const { processedScenarios } = useProposalScenarios(id);

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
    const [selectedVirtualSection, setSelectedVirtualSection] = useState<string | null>(null);
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

            <ProposalStepper proposalId={id!} currentStep={3} />

            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
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
                    className="flex items-center space-x-3 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl shadow-lg shadow-indigo-200 transition-all font-black text-[10px] uppercase tracking-widest"
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
                        processedScenarios={processedScenarios}
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
                                    const isActive = activePageId === page.id;

                                    // Insert virtual sections after INDEX page
                                    const isIndex = page.pageType === 'INDEX';

                                    return (
                                        <>
                                        <motion.div
                                            key={page.id}
                                            layout
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -20 }}
                                            onClick={() => { setActivePageId(page.id); setSelectedVirtualSection(null); }}
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

                                        {/* Virtual generated sections after INDEX */}
                                        {isIndex && processedScenarios.length > 0 && (
                                            <>
                                                {/* Tech Spec section */}
                                                <motion.div
                                                    key={VIRTUAL_TECH_SPEC_ID}
                                                    layout
                                                    initial={{ opacity: 0, x: -20 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    onClick={() => {
                                                        setActivePageId(null);
                                                        setSelectedVirtualSection(VIRTUAL_TECH_SPEC_ID);
                                                    }}
                                                    className={cn(
                                                        "group flex items-center justify-between p-4 rounded-2xl cursor-pointer transition-all border-2",
                                                        selectedVirtualSection === VIRTUAL_TECH_SPEC_ID
                                                            ? "bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100"
                                                            : "bg-slate-50 border-transparent hover:bg-white hover:border-cyan-100 text-slate-600"
                                                    )}
                                                >
                                                    <div className="flex items-center space-x-3 min-w-0 flex-1">
                                                        <Cpu className={cn("h-4 w-4 shrink-0", selectedVirtualSection === VIRTUAL_TECH_SPEC_ID ? "text-indigo-200" : "text-cyan-500")} />
                                                        <div className="min-w-0">
                                                            <span className="text-sm font-black tracking-tight truncate block">
                                                                Propuesta Técnica
                                                            </span>
                                                            <span className={cn(
                                                                "text-[9px] font-black uppercase tracking-widest",
                                                                selectedVirtualSection === VIRTUAL_TECH_SPEC_ID ? "text-indigo-200" : "text-cyan-400"
                                                            )}>
                                                                Auto-generada
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <span className={cn(
                                                        "text-[9px] font-black px-2 py-0.5 rounded-lg",
                                                        selectedVirtualSection === VIRTUAL_TECH_SPEC_ID
                                                            ? "bg-indigo-500 text-indigo-200"
                                                            : "bg-cyan-50 text-cyan-600"
                                                    )}>
                                                        {processedScenarios.reduce((acc, s) => acc + s.visibleItems.length, 0)} págs
                                                    </span>
                                                </motion.div>

                                                {/* Economic Proposal section */}
                                                <motion.div
                                                    key={VIRTUAL_ECONOMIC_ID}
                                                    layout
                                                    initial={{ opacity: 0, x: -20 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    onClick={() => {
                                                        setActivePageId(null);
                                                        setSelectedVirtualSection(VIRTUAL_ECONOMIC_ID);
                                                    }}
                                                    className={cn(
                                                        "group flex items-center justify-between p-4 rounded-2xl cursor-pointer transition-all border-2",
                                                        selectedVirtualSection === VIRTUAL_ECONOMIC_ID
                                                            ? "bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100"
                                                            : "bg-slate-50 border-transparent hover:bg-white hover:border-teal-100 text-slate-600"
                                                    )}
                                                >
                                                    <div className="flex items-center space-x-3 min-w-0 flex-1">
                                                        <DollarSign className={cn("h-4 w-4 shrink-0", selectedVirtualSection === VIRTUAL_ECONOMIC_ID ? "text-indigo-200" : "text-teal-500")} />
                                                        <div className="min-w-0">
                                                            <span className="text-sm font-black tracking-tight truncate block">
                                                                Propuesta Económica
                                                            </span>
                                                            <span className={cn(
                                                                "text-[9px] font-black uppercase tracking-widest",
                                                                selectedVirtualSection === VIRTUAL_ECONOMIC_ID ? "text-indigo-200" : "text-teal-400"
                                                            )}>
                                                                Auto-generada
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <span className={cn(
                                                        "text-[9px] font-black px-2 py-0.5 rounded-lg",
                                                        selectedVirtualSection === VIRTUAL_ECONOMIC_ID
                                                            ? "bg-indigo-500 text-indigo-200"
                                                            : "bg-teal-50 text-teal-600"
                                                    )}>
                                                        {processedScenarios.length} esc.
                                                    </span>
                                                </motion.div>
                                            </>
                                        )}
                                        </>
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
                    ) : selectedVirtualSection ? (
                        <VirtualSectionPreview
                            sectionId={selectedVirtualSection}
                            processedScenarios={processedScenarios}
                        />
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

            <ProposalNavBar proposalId={id!} currentStep={3} />
        </div>
    );
}
