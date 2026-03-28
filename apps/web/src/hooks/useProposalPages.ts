import { useState, useCallback, useRef } from 'react';
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

    const loadPages = useCallback(async () => {
        if (!proposalId || initializingRef.current) return;
        try {
            initializingRef.current = true;
            setLoading(true);
            // Initialize defaults if none exist, then load
            await api.post(`/proposals/${proposalId}/pages/initialize`);
            const res = await api.get(`/proposals/${proposalId}/pages`);
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

    // ── Page CRUD ────────────────────────────────────────────

    const createPage = async (title: string) => {
        if (!title.trim() || !proposalId) return;
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
            const res = await api.patch(`/proposals/pages/${pageId}`, data);
            setPages(prev => prev.map(p => (p.id === pageId ? res.data : p)));
        } catch (error) {
            console.error(error);
        }
    };

    const deletePage = async (pageId: string) => {
        const page = pages.find(p => p.id === pageId);
        if (!page || page.isLocked) return;
        if (!confirm('¿Eliminar esta página?')) return;
        try {
            await api.delete(`/proposals/pages/${pageId}`);
            setPages(prev => prev.filter(p => p.id !== pageId));
            if (activePageId === pageId) setActivePageId(pages[0]?.id ?? null);
        } catch (error) {
            console.error(error);
        }
    };

    const reorderPages = async (pageIds: string[]) => {
        if (!proposalId) return;
        try {
            const res = await api.patch(`/proposals/${proposalId}/pages/reorder`, { pageIds });
            setPages(res.data);
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
            const res = await api.patch(`/proposals/pages/blocks/${blockId}`, { content });
            setPages(prev =>
                prev.map(p => ({
                    ...p,
                    blocks: p.blocks.map(b => (b.id === blockId ? res.data : b)),
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
        createPage,
        updatePage,
        deletePage,
        reorderPages,
        createBlock,
        updateBlock,
        deleteBlock,
        uploadImage,
    };
}
