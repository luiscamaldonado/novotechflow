import { useState, useCallback, useRef, useEffect } from 'react';
import { api } from '../lib/api';

// ── Types ────────────────────────────────────────────────────

export interface PageBlock {
    id: string;
    pageId: string;
    blockType: 'RICH_TEXT' | 'IMAGE';
    content: Record<string, unknown> | null;
    sortOrder: number;
}

export interface ProposalPage {
    id: string;
    proposalId: string;
    pageType: 'COVER' | 'PRESENTATION' | 'COMPANY_INFO' | 'INDEX' | 'TERMS' | 'CUSTOM';
    title: string | null;
    variables: Record<string, unknown> | null;
    isLocked: boolean;
    isSectionModel: boolean;
    parentPageId: string | null;
    sortOrder: number;
    blocks: PageBlock[];
}

// ── Hook ─────────────────────────────────────────────────────

export function useProposalPages(proposalId: string | undefined) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [pages, setPages] = useState<ProposalPage[]>([]);
    const [activePageId, setActivePageId] = useState<string | null>(null);
    const initializingRef = useRef(false);

    const activePage = pages.find(p => p.id === activePageId) ?? null;

    // Invariante: activePageId nunca apunta a una página que ya no existe.
    // Cubre borrados (incluida la cascada de secciones) sin depender de closures stale.
    useEffect(() => {
        if (activePageId && pages.length > 0 && !pages.some(p => p.id === activePageId)) {
            setActivePageId(pages[0]?.id ?? null);
        }
    }, [pages, activePageId]);

    const loadPages = useCallback(async () => {
        if (!proposalId || initializingRef.current) return;
        try {
            initializingRef.current = true;
            setLoading(true);
            // Initialize returns existing pages or freshly created defaults (same payload as the GET)
            const res = await api.post(`/proposals/${proposalId}/pages/initialize`);
            setPages(res.data || []);
            if (res.data?.length > 0 && !activePageId) {
                setActivePageId(res.data[0].id);
            }
        } catch (error) {
            console.error('Error loading pages', error);
        } finally {
            setLoading(false);
            initializingRef.current = false;
        }
    }, [proposalId, activePageId]);

    // Explicit reload from the GET endpoint (no initialization side effects)
    const fetchPages = useCallback(async () => {
        if (!proposalId) return;
        try {
            setLoading(true);
            const res = await api.get(`/proposals/${proposalId}/pages`);
            setPages(res.data || []);
            if (res.data?.length > 0 && !activePageId) {
                setActivePageId(res.data[0].id);
            }
        } catch (error) {
            console.error('Error loading pages', error);
        } finally {
            setLoading(false);
        }
    }, [proposalId, activePageId]);

    // ── Page CRUD ────────────────────────────────────────────

    const createSection = async (title: string): Promise<ProposalPage | null> => {
        if (!title.trim() || !proposalId) return null;
        setSaving(true);
        try {
            const res = await api.post(`/proposals/${proposalId}/pages`, { title });
            setPages(prev => {
                // Insert before TERMS (last locked page)
                const termsIdx = prev.findIndex(p => p.pageType === 'TERMS');
                if (termsIdx === -1) return [...prev, res.data];
                const copy = [...prev];
                copy.splice(termsIdx, 0, res.data);
                return copy;
            });
            setActivePageId(res.data.id);
            return res.data as ProposalPage;
        } catch (error) {
            console.error(error);
            return null;
        } finally {
            setSaving(false);
        }
    };

    const addSheet = async (sectionId: string) => {
        setSaving(true);
        try {
            const res = await api.post(`/proposals/pages/${sectionId}/sheets`, {});
            setPages(prev => {
                const sectionIdx = prev.findIndex(p => p.id === sectionId);
                if (sectionIdx === -1) return [...prev, res.data];
                // Insert after the section and its existing child sheets
                let insertIdx = sectionIdx + 1;
                while (insertIdx < prev.length && prev[insertIdx].parentPageId === sectionId) {
                    insertIdx++;
                }
                const copy = [...prev];
                copy.splice(insertIdx, 0, res.data);
                return copy;
            });
            setActivePageId(res.data.id);
            return true;
        } catch (error) {
            console.error(error);
            return false;
        } finally {
            setSaving(false);
        }
    };

    const updatePage = async (pageId: string, data: { title?: string; variables?: Record<string, unknown> }) => {
        try {
            await api.patch(`/proposals/pages/${pageId}`, data);
            setPages(prev => prev.map(p => {
                if (p.id !== pageId) return p;
                return {
                    ...p,
                    ...(data.title !== undefined ? { title: data.title } : {}),
                    ...(data.variables !== undefined ? { variables: data.variables } : {}),
                };
            }));
        } catch (error) {
            console.error(error);
        }
    };

    const deletePage = async (pageId: string) => {
        const page = pages.find(p => p.id === pageId);
        if (!page || page.isLocked) return;
        const isSection = page.isSectionModel && !page.parentPageId;
        const message = isSection
            ? '\u00bfEliminar esta secci\u00f3n? Se eliminar\u00e1n tambi\u00e9n todas sus hojas.'
            : '\u00bfEliminar esta p\u00e1gina?';
        if (!confirm(message)) return;
        try {
            await api.delete(`/proposals/pages/${pageId}`);
            // El backend cascadea (onDelete: Cascade); esto es solo el espejo local.
            // El efecto de invariante reubica activePageId si queda colgando.
            setPages(prev => prev.filter(p => p.id !== pageId && p.parentPageId !== pageId));
        } catch (error) {
            console.error(error);
        }
    };

    const reorderPages = async (pageIds: string[]) => {
        if (!proposalId) return;
        try {
            await api.patch(`/proposals/${proposalId}/pages/reorder`, { pageIds });
            setPages(prev => {
                const byId = new Map(prev.map(p => [p.id, p]));
                return pageIds
                    .map((id, index) => {
                        const page = byId.get(id);
                        return page ? { ...page, sortOrder: index + 1 } : null;
                    })
                    .filter((p): p is ProposalPage => p !== null);
            });
        } catch (error) {
            console.error(error);
        }
    };

    // ── Block CRUD ───────────────────────────────────────────

    const createBlock = async (pageId: string, blockType: 'RICH_TEXT' | 'IMAGE') => {
        try {
            const res = await api.post(`/proposals/pages/${pageId}/blocks`, { blockType });
            setPages(prev =>
                prev.map(p =>
                    p.id === pageId ? { ...p, blocks: [...p.blocks, res.data] } : p,
                ),
            );
            return res.data as PageBlock;
        } catch (error) {
            console.error(error);
            return null;
        }
    };

    const updateBlock = async (blockId: string, content: Record<string, unknown>) => {
        try {
            await api.patch(`/proposals/pages/blocks/${blockId}`, { content });
            // The API sanitizes RICH_TEXT html on save; the local copy keeps the
            // pre-sanitization html until the next full reload.
            setPages(prev =>
                prev.map(p => ({
                    ...p,
                    blocks: p.blocks.map(b => (b.id === blockId ? { ...b, content } : b)),
                })),
            );
        } catch (error) {
            console.error(error);
        }
    };

    const deleteBlock = async (pageId: string, blockId: string) => {
        try {
            await api.delete(`/proposals/pages/blocks/${blockId}`);
            setPages(prev =>
                prev.map(p =>
                    p.id === pageId
                        ? { ...p, blocks: p.blocks.filter(b => b.id !== blockId) }
                        : p,
                ),
            );
        } catch (error) {
            console.error(error);
        }
    };

    const uploadImage = async (file: File): Promise<string | null> => {
        const formData = new FormData();
        formData.append('file', file);
        try {
            const res = await api.post('/proposals/pages/upload-image', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            return res.data.url;
        } catch (error) {
            console.error(error);
            return null;
        }
    };

    return {
        loading,
        saving,
        pages,
        activePageId,
        setActivePageId,
        activePage,
        loadPages,
        fetchPages,
        createSection,
        addSheet,
        updatePage,
        deletePage,
        reorderPages,
        createBlock,
        updateBlock,
        deleteBlock,
        uploadImage,
    };
}
