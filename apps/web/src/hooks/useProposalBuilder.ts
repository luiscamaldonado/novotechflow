import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import type { ProposalItem, ProposalDetail } from '../lib/types';
import { MAYORISTA_FLETE_PCT, PROVEEDOR_MAYORISTA } from '../lib/constants';

/** Estado y lógica del builder de propuestas (carga de datos + CRUD de items). */
export function useProposalBuilder(proposalId: string | undefined) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [catalogs, setCatalogs] = useState<Record<string, string[]>>({});
    const [proposal, setProposal] = useState<ProposalDetail | null>(null);
    const [items, setItems] = useState<ProposalItem[]>([]);

    const initialItemForm: ProposalItem = {
        itemType: 'PCS',
        name: '',
        description: '',
        brand: '',
        partNumber: '',
        quantity: 1,
        unitCost: '',
        marginPct: 20,
        unitPrice: '',
        technicalSpecs: {},
        isTaxable: true,
        internalCosts: {
            proveedor: PROVEEDOR_MAYORISTA,
            fletePct: MAYORISTA_FLETE_PCT,
        },
    };

    const loadProposalData = useCallback(async () => {
        if (!proposalId) return;
        try {
            setLoading(true);
            const res = await api.get(`/proposals/${proposalId}`);
            const data = res.data;
            if (data.issueDate) data.issueDate = data.issueDate.split('T')[0];
            if (data.validityDate) data.validityDate = data.validityDate.split('T')[0];
            setProposal(data);
            setItems(data.proposalItems || []);
        } catch (error) {
            console.error(error);
            alert('No se pudo cargar la propuesta');
        } finally {
            setLoading(false);
        }
    }, [proposalId]);

    const loadCatalogs = useCallback(async () => {
        try {
            const res = await api.get('/catalogs/pc-specs');
            setCatalogs(res.data);
        } catch (error) {
            console.error('Error cargando catálogos', error);
        }
    }, []);

    useEffect(() => {
        loadProposalData();
        loadCatalogs();
    }, [loadProposalData, loadCatalogs]);

    /** Guardar/actualizar un item (POST si nuevo, PATCH si edición). */
    const saveItem = async (itemForm: ProposalItem, editingItemId: string | null) => {
        setSaving(true);
        try {
            // Normalizar tipos: los inputs HTML siempre devuelven strings,
            // pero el backend DTO espera números.
            // Only send fields accepted by CreateProposalItemDto / UpdateProposalItemDto
            const payload = {
                itemType: itemForm.itemType,
                name: itemForm.name,
                description: itemForm.description,
                brand: itemForm.brand,
                partNumber: itemForm.partNumber,
                quantity: Number(itemForm.quantity) || 1,
                unitCost: Number(itemForm.unitCost) || 0,
                marginPct: Number(itemForm.marginPct) || 0,
                unitPrice: Number(itemForm.unitPrice) || 0,
                isTaxable: itemForm.isTaxable,
                technicalSpecs: itemForm.technicalSpecs,
                internalCosts: itemForm.internalCosts,
            };

            if (editingItemId) {
                const res = await api.patch(`/proposals/items/${editingItemId}`, payload);
                setItems(prev => prev.map(i => i.id === editingItemId ? res.data : i));
            } else {
                const res = await api.post(`/proposals/${proposalId}/items`, payload);
                setItems(prev => [...prev, res.data]);
            }
            return true;
        } catch (error) {
            console.error(error);
            alert(`Error al ${editingItemId ? 'actualizar' : 'agregar'} artículo.`);
            return false;
        } finally {
            setSaving(false);
        }
    };

    /** Eliminar un item por ID. */
    const deleteItem = async (itemId: string) => {
        if (!window.confirm('¿Segura que deseas eliminar este item?')) return;
        try {
            await api.delete(`/proposals/items/${itemId}`);
            setItems(prev => prev.filter(i => i.id !== itemId));
        } catch (error) {
            console.error(error);
            alert('Error al eliminar el item.');
        }
    };

    /** Actualizar campos de la propuesta (asunto, fechas). */
    const updateProposal = async (data: Partial<ProposalDetail>) => {
        if (!proposal) return;
        setSaving(true);
        try {
            // Only send fields accepted by UpdateProposalDto
            const allowed = [
                'subject', 'issueDate', 'validityDays', 'validityDate',
                'status', 'closeDate', 'billingDate', 'acquisitionType',
            ];
            const cleanData: Record<string, unknown> = {};
            const anyData = data as Record<string, unknown>;
            for (const key of allowed) {
                if (key in anyData) cleanData[key] = anyData[key];
            }
            await api.patch(`/proposals/${proposalId}`, cleanData);
        } catch (error) {
            console.error(error);
            alert('Error al actualizar la propuesta.');
        } finally {
            setSaving(false);
        }
    };

    return {
        loading,
        saving,
        catalogs,
        proposal,
        setProposal,
        items,
        initialItemForm,
        saveItem,
        deleteItem,
        updateProposal,
    };
}
