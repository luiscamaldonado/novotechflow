import { useEffect, useState, useRef, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    FileText, Plus, Trash2, Loader2,
    Lock, GripVertical,
    BookOpen, Eye, ShieldAlert,
    ChevronUp, ChevronDown, MapPin, Cpu, DollarSign,
    Folder,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useProposalPages, type ProposalPage } from '../../hooks/useProposalPages';
import { useProposalReadOnly } from '../../hooks/useProposalReadOnly';
import ReadOnlyBanner from '../../components/proposals/ReadOnlyBanner';
import { useProposalScenarios } from '../../hooks/useProposalScenarios';
import { consolidateTechnicalItems } from '../../lib/consolidateTechnicalItems';
import { useAuthStore } from '../../store/authStore';
import PdfPreviewModal from '../../components/proposals/PdfPreviewModal';
import PriceWarningModal from '../../components/proposals/PriceWarningModal';
import { usePriceThresholds } from '../../hooks/usePriceThresholds';
import { findProposalPriceWarnings } from '../../lib/priceValidation';
import { resolveSheetHeading } from '../../lib/resolveSheetHeading';
import { api } from '../../lib/api';
import { validateImageFile, ACCEPT_IMAGES } from '../../lib/file-validation';
import type { ProposalDetail } from '../../lib/types';
import { type ProposalVariables, formatDateSpanish, buildGarantiaLines } from '../../lib/proposalVariables';
import { PAGE_TYPE_LABELS, VIRTUAL_TECH_SPEC_ID, VIRTUAL_ECONOMIC_ID } from '../../lib/constants';
import CityCombobox from './components/CityCombobox';
import LockedPageView from './components/LockedPageView';
import VirtualSectionPreview from './components/VirtualSectionPreview';
import PageEditor from './components/PageEditor';
import PageSheetsPreview from './components/PageSheetsPreview';
import SectionView from './components/SectionView';
import ProposalStepper from '../../components/proposals/ProposalStepper';
import ProposalNavBar from '../../components/proposals/ProposalNavBar';

/** Sección del modelo nuevo: página contenedora sin padre */
const isSectionPage = (page: ProposalPage): boolean => page.isSectionModel && !page.parentPageId;

/** Entrada del sidebar: página top-level con sus hojas hijas (vacío si no es sección) */
interface SidebarEntry {
    page: ProposalPage;
    children: ProposalPage[];
}

export default function ProposalDocBuilder() {
    const { id } = useParams<{ id: string }>();
    const { user } = useAuthStore();
    const isAdmin = user?.role === 'ADMIN';

    const {
        loading, saving, pages, activePageId, setActivePageId, activePage,
        loadPages, createSection, addSheet, updatePage, deletePage, reorderPages,
        createBlock, updateBlock, deleteBlock, reorderBlocks, uploadImage,
    } = useProposalPages(id);

    const { processedScenarios, loading: scenariosLoading } = useProposalScenarios(id);
    const { thresholds } = usePriceThresholds();

    const consolidatedTechCount = useMemo(
        () => consolidateTechnicalItems(processedScenarios).items.length,
        [processedScenarios],
    );

    const priceWarnings = useMemo(
        () => findProposalPriceWarnings(processedScenarios, thresholds),
        [processedScenarios, thresholds],
    );

    const [showPriceWarning, setShowPriceWarning] = useState(false);
    const priceWarningEvaluatedRef = useRef(false);

    useEffect(() => {
        if (scenariosLoading) return;
        if (priceWarningEvaluatedRef.current) return;
        priceWarningEvaluatedRef.current = true;
        if (priceWarnings.length > 0) {
            // eslint-disable-next-line react-hooks/set-state-in-effect -- latch de advertencia unica con guarda useRef
            setShowPriceWarning(true);
        }
    }, [scenariosLoading, priceWarnings]);


    /** Jerarquía derivada de la lista plana: top-level en su orden, cada sección con sus hojas en el suyo */
    const topLevel = useMemo<SidebarEntry[]>(
        () => pages
            .filter(p => !p.parentPageId)
            .map(page => ({
                page,
                children: pages.filter(c => c.parentPageId === page.id),
            })),
        [pages],
    );

    const activeSectionSheets = useMemo(
        () => (activePage && isSectionPage(activePage)
            ? pages.filter(p => p.parentPageId === activePage.id)
            : []),
        [pages, activePage],
    );

    /** Encabezado de una hoja hija activa: titulo de la seccion padre + numero de hoja (B1: la seccion es dueña del titulo) */
    const resolvedSheetHeading = useMemo(
        () => (activePage ? resolveSheetHeading(activePage, pages) : undefined),
        [pages, activePage],
    );

    /** Encabezados de las hojas de la seccion activa para sus miniaturas, misma fuente que el PDF (resolveSheetHeading) */
    const activeSectionSheetHeadings = useMemo(
        () => activeSectionSheets.map(sheet => resolveSheetHeading(sheet, pages) ?? ''),
        [activeSectionSheets, pages],
    );

    /** Aplana la jerarquía al orden plano que espera el PATCH de reorder (sección seguida de sus hojas) */
    const flattenPageIds = (entries: SidebarEntry[]): string[] =>
        entries.flatMap(entry => [entry.page.id, ...entry.children.map(c => c.id)]);

    const moveTopLevel = (index: number, direction: 'up' | 'down') => {
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= topLevel.length) return;
        // Las predeterminadas (COVER, INDEX, TERMS) conservan su posición:
        // ni se mueven ni se les pasa por encima.
        if (topLevel[index].page.isLocked || topLevel[newIndex].page.isLocked) return;
        const entries = [...topLevel];
        [entries[index], entries[newIndex]] = [entries[newIndex], entries[index]];
        reorderPages(flattenPageIds(entries));
    };

    const moveSheet = (sectionId: string, index: number, direction: 'up' | 'down') => {
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        const entries = topLevel.map(entry =>
            entry.page.id === sectionId ? { ...entry, children: [...entry.children] } : entry,
        );
        const section = entries.find(entry => entry.page.id === sectionId);
        if (!section || newIndex < 0 || newIndex >= section.children.length) return;
        [section.children[index], section.children[newIndex]] =
            [section.children[newIndex], section.children[index]];
        reorderPages(flattenPageIds(entries));
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
    const [selectedCity, setSelectedCity] = useState<string>('');
    const [savedCity, setSavedCity] = useState<string>('');
    const [savingCity, setSavingCity] = useState<boolean>(false);

    const { isReadOnly } = useProposalReadOnly(proposal);

    useEffect(() => {
        if (!id) return;
        api.get(`/proposals/${id}`).then(res => {
            const data = res.data;
            if (data.issueDate) data.issueDate = data.issueDate.split('T')[0];
            if (data.validityDate) data.validityDate = data.validityDate.split('T')[0];
            setProposal(data);
            const initialCity = data.issueCity || '';
            setSelectedCity(initialCity);
            setSavedCity(initialCity);
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
        const created = await createSection(newPageTitle);
        if (created) {
            setNewPageTitle('');
            setIsCreatingPage(false);
            // Toda sección nace con su primera hoja; addSheet deja la hoja activa.
            // Si falla, la sección queda sin hojas (sin rollback): se puede agregar desde la vista de sección.
            await addSheet(created.id);
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

        const validation = await validateImageFile(file);
        if (!validation.valid) {
            alert(validation.error);
            setUploadingBlockId(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }

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

    const handleSaveCity = async () => {
        if (!id || selectedCity === savedCity) return;
        setSavingCity(true);
        try {
            await api.patch(`/proposals/${id}`, { issueCity: selectedCity });
            setSavedCity(selectedCity);
            setProposal(prev => prev ? { ...prev, issueCity: selectedCity } : prev);
        } catch (error) {
            console.error(error);
            alert('Error al guardar la ciudad de emisión.');
        } finally {
            setSavingCity(false);
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
            {/* Hidden file input for image upload */}
            <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPT_IMAGES}
                className="hidden"
                onChange={handleFileChange}
            />

            <ProposalStepper proposalId={id!} currentStep={3} />

            {isReadOnly && <ReadOnlyBanner />}

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
                    disabled={!selectedCity}
                    title={!selectedCity ? 'Selecciona la ciudad de emisi\u00f3n antes de generar el PDF' : undefined}
                    className="flex items-center space-x-3 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl shadow-lg shadow-indigo-200 transition-all font-black text-[10px] uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
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
                    <div className="flex items-center gap-2">
                        <CityCombobox value={selectedCity} onChange={setSelectedCity} disabled={isReadOnly} required={!isReadOnly} />
                        {!isReadOnly && selectedCity !== savedCity && (
                            <button
                                type="button"
                                onClick={handleSaveCity}
                                disabled={savingCity}
                                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                ✓ Guardar
                            </button>
                        )}
                    </div>
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
                        enableExcelExport
                        ownerSignatureUrl={proposal?.user?.signatureUrl}
                    />
                )}
                {showPriceWarning && (
                    <PriceWarningModal
                        scenarioWarnings={priceWarnings}
                        onClose={() => setShowPriceWarning(false)}
                    />
                )}
            </AnimatePresence>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Sidebar — Pages */}
                <div className="lg:col-span-3 space-y-4">
                    <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Páginas</h3>
                            {!isReadOnly && (
                                <button
                                    onClick={() => setIsCreatingPage(true)}
                                    className="p-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-all scale-90"
                                    title="Agregar página personalizada"
                                >
                                    <Plus className="h-4 w-4" />
                                </button>
                            )}
                        </div>

                        <div className="space-y-2">
                            <AnimatePresence mode="popLayout">
                                {topLevel.map(({ page, children }, idx) => {
                                    const isActive = activePageId === page.id;
                                    const isSection = isSectionPage(page);

                                    // Insert virtual sections after INDEX page
                                    const isIndex = page.pageType === 'INDEX';

                                    return (
                                        <motion.div key={page.id} layout>
                                        <motion.div
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
                                                {isSection ? (
                                                    <Folder className={cn("h-4 w-4 shrink-0", isActive ? "text-indigo-200" : "text-slate-400")} />
                                                ) : page.isLocked ? (
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
                                                        {isSection ? 'Secci\u00f3n' : PAGE_TYPE_LABELS[page.pageType]}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex items-center shrink-0 gap-0.5">
                                                {!isReadOnly && (
                                                    <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); moveTopLevel(idx, 'up'); }}
                                                            disabled={idx === 0 || page.isLocked || topLevel[idx - 1].page.isLocked}
                                                            className={cn(
                                                                "p-0.5 rounded transition-colors disabled:opacity-30",
                                                                isActive ? "text-indigo-200 hover:bg-indigo-500" : "text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                                                            )}
                                                            title="Subir"
                                                        >
                                                            <ChevronUp className="h-3.5 w-3.5" />
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); moveTopLevel(idx, 'down'); }}
                                                            disabled={idx === topLevel.length - 1 || page.isLocked || topLevel[idx + 1].page.isLocked}
                                                            className={cn(
                                                                "p-0.5 rounded transition-colors disabled:opacity-30",
                                                                isActive ? "text-indigo-200 hover:bg-indigo-500" : "text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                                                            )}
                                                            title="Bajar"
                                                        >
                                                            <ChevronDown className="h-3.5 w-3.5" />
                                                        </button>
                                                    </div>
                                                )}
                                                {!page.isLocked && !isReadOnly && (
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
                                                        {consolidatedTechCount} págs
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

                                        {/* Hojas hijas de la sección */}
                                        {isSection && (
                                            <div className="ml-7 mt-2 space-y-1.5">
                                                {children.map((sheet, sheetIdx) => {
                                                    const sheetActive = activePageId === sheet.id;
                                                    return (
                                                        <div
                                                            key={sheet.id}
                                                            onClick={() => { setActivePageId(sheet.id); setSelectedVirtualSection(null); }}
                                                            className={cn(
                                                                "group/sheet flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition-all border-2",
                                                                sheetActive
                                                                    ? "bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100"
                                                                    : "bg-slate-50 border-transparent hover:bg-white hover:border-indigo-100 text-slate-600"
                                                            )}
                                                        >
                                                            <div className="flex items-center space-x-2 min-w-0 flex-1">
                                                                <FileText className={cn("h-3.5 w-3.5 shrink-0", sheetActive ? "text-indigo-200" : "text-slate-400")} />
                                                                <span className="text-xs font-black tracking-tight truncate">
                                                                    Hoja {sheetIdx + 1}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center shrink-0 gap-0.5">
                                                                {!isReadOnly && (
                                                                    <div className="flex flex-col opacity-0 group-hover/sheet:opacity-100 transition-opacity">
                                                                        <button
                                                                            onClick={(e) => { e.stopPropagation(); moveSheet(page.id, sheetIdx, 'up'); }}
                                                                            disabled={sheetIdx === 0}
                                                                            className={cn(
                                                                                "p-0.5 rounded transition-colors disabled:opacity-30",
                                                                                sheetActive ? "text-indigo-200 hover:bg-indigo-500" : "text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                                                                            )}
                                                                            title="Subir"
                                                                        >
                                                                            <ChevronUp className="h-3 w-3" />
                                                                        </button>
                                                                        <button
                                                                            onClick={(e) => { e.stopPropagation(); moveSheet(page.id, sheetIdx, 'down'); }}
                                                                            disabled={sheetIdx === children.length - 1}
                                                                            className={cn(
                                                                                "p-0.5 rounded transition-colors disabled:opacity-30",
                                                                                sheetActive ? "text-indigo-200 hover:bg-indigo-500" : "text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                                                                            )}
                                                                            title="Bajar"
                                                                        >
                                                                            <ChevronDown className="h-3 w-3" />
                                                                        </button>
                                                                    </div>
                                                                )}
                                                                {!isReadOnly && (
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); deletePage(sheet.id); }}
                                                                        className={cn(
                                                                            "p-1 rounded-lg opacity-0 group-hover/sheet:opacity-100 transition-opacity",
                                                                            sheetActive ? "hover:bg-indigo-500 text-indigo-200" : "hover:bg-red-50 text-slate-400 hover:text-red-500"
                                                                        )}
                                                                    >
                                                                        <Trash2 className="h-3 w-3" />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                                {!isReadOnly && (
                                                    <button
                                                        type="button"
                                                        onClick={() => addSheet(page.id)}
                                                        disabled={saving}
                                                        className="w-full flex items-center justify-center space-x-1.5 px-3 py-2 rounded-xl border-2 border-dashed border-indigo-100 text-indigo-500 hover:bg-indigo-50 hover:border-indigo-200 transition-all text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
                                                    >
                                                        <Plus className="h-3 w-3" />
                                                        <span>Agregar hoja</span>
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                        </motion.div>
                                    );
                                })}
                            </AnimatePresence>

                            {!isReadOnly && isCreatingPage && (
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

                {/* Main content — editor, virtual section sheets, or placeholder */}
                {activePage && isSectionPage(activePage) ? (
                    <div className="lg:col-span-9">
                        <SectionView
                            key={activePage.id}
                            section={activePage}
                            sheets={activeSectionSheets}
                            sheetHeadings={activeSectionSheetHeadings}
                            proposalVars={proposalVars}
                            ownerSignatureUrl={proposal?.user?.signatureUrl}
                            isReadOnly={isReadOnly}
                            onUpdateTitle={(title) => updatePage(activePage.id, { title })}
                            onAddSheet={() => addSheet(activePage.id)}
                            onOpenSheet={(sheetId) => { setActivePageId(sheetId); setSelectedVirtualSection(null); }}
                        />
                    </div>
                ) : activePage ? (
                    <div className="lg:col-span-5 space-y-6">
                        {canEditPage(activePage) ? (
                            <PageEditor
                                page={activePage}
                                editingTitle={editingTitle}
                                setEditingTitle={setEditingTitle}
                                isReadOnly={isReadOnly}
                                onUpdatePage={updatePage}
                                onCreateBlock={createBlock}
                                onUpdateBlock={updateBlock}
                                onDeleteBlock={deleteBlock}
                                onReorderBlocks={reorderBlocks}
                                onAddTextBlock={handleAddTextBlock}
                                onAddImageBlock={handleAddImageBlock}
                                onUploadImageForBlock={handleImageUploadForBlock}
                                uploadImage={uploadImage}
                                isAdmin={isAdmin}
                                proposalVars={proposalVars}
                                resolvedSheetHeading={resolvedSheetHeading}
                            />
                        ) : (
                            <LockedPageView page={activePage} />
                        )}
                    </div>
                ) : selectedVirtualSection ? (
                    <div className="lg:col-span-9">
                        <VirtualSectionPreview
                            sectionId={selectedVirtualSection}
                            processedScenarios={processedScenarios}
                        />
                    </div>
                ) : (
                    <div className="lg:col-span-9 space-y-6">
                        <div className="bg-white rounded-[2.5rem] p-32 text-center border-2 border-dashed border-slate-100">
                            <BookOpen className="h-20 w-20 mx-auto text-slate-100 mb-6" />
                            <h4 className="text-xl font-black text-slate-300 uppercase tracking-tight">
                                Seleccione una página para editar su contenido.
                            </h4>
                        </div>
                    </div>
                )}
                {activePage && !isSectionPage(activePage) && (
                    <div className="lg:col-span-4">
                        <PageSheetsPreview page={activePage} proposalVars={proposalVars} ownerSignatureUrl={proposal?.user?.signatureUrl} resolvedSheetHeading={resolvedSheetHeading} />
                    </div>
                )}
            </div>

            <ProposalNavBar proposalId={id!} currentStep={3} />
        </div>
    );
}
