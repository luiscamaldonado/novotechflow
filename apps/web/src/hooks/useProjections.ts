import { useState } from 'react';
import { api } from '../lib/api';
import type { BillingProjection } from '../lib/types';

export interface ProjForm {
    clientName: string;
    subtotal: string;
    status: 'PENDIENTE_FACTURAR' | 'FACTURADA';
    billingDate: string;
    acquisitionType: '' | 'VENTA' | 'DAAS';
    currency: 'COP' | 'USD';
}

export function useProjections(
    setProjections: React.Dispatch<React.SetStateAction<BillingProjection[]>>,
) {
    const [showProjectionModal, setShowProjectionModal] = useState(false);
    const [editingProjection, setEditingProjection] = useState<BillingProjection | null>(null);
    const [projForm, setProjForm] = useState<ProjForm>({
        clientName: '',
        subtotal: '',
        status: 'PENDIENTE_FACTURAR',
        billingDate: '',
        acquisitionType: '',
        currency: 'COP',
    });
    const [savingProjection, setSavingProjection] = useState(false);

    const openNewProjectionModal = () => {
        setEditingProjection(null);
        setProjForm({ clientName: '', subtotal: '', status: 'PENDIENTE_FACTURAR', billingDate: '', acquisitionType: '', currency: 'COP' });
        setShowProjectionModal(true);
    };

    const openEditProjectionModal = (pr: BillingProjection) => {
        setEditingProjection(pr);
        setProjForm({
            clientName: pr.clientName,
            subtotal: String(pr.subtotal),
            status: pr.status,
            billingDate: pr.billingDate ? new Date(pr.billingDate).toISOString().split('T')[0] : '',
            acquisitionType: (pr.acquisitionType || '') as '' | 'VENTA' | 'DAAS',
            currency: (pr.currency === 'USD' ? 'USD' : 'COP') as 'COP' | 'USD',
        });
        setShowProjectionModal(true);
    };

    const handleSaveProjection = async () => {
        if (!projForm.clientName.trim() || !projForm.subtotal) return;
        setSavingProjection(true);
        try {
            if (editingProjection) {
                const res = await api.patch(`/billing-projections/${editingProjection.id}`, {
                    clientName: projForm.clientName,
                    subtotal: parseFloat(projForm.subtotal),
                    status: projForm.status,
                    billingDate: projForm.billingDate || null,
                    acquisitionType: projForm.acquisitionType || undefined,
                    currency: projForm.currency,
                });
                setProjections(prev => prev.map(pr => pr.id === editingProjection.id ? res.data : pr));
            } else {
                const res = await api.post('/billing-projections', {
                    clientName: projForm.clientName,
                    subtotal: parseFloat(projForm.subtotal),
                    status: projForm.status,
                    billingDate: projForm.billingDate || null,
                    acquisitionType: projForm.acquisitionType || undefined,
                    currency: projForm.currency,
                });
                setProjections(prev => [res.data, ...prev]);
            }
            setShowProjectionModal(false);
        } catch (error) {
            console.error(error);
            alert('Error al guardar la proyección.');
        } finally {
            setSavingProjection(false);
        }
    };

    const handleDeleteProjection = async (id: string, code: string) => {
        if (!window.confirm(`⚠️ ¿Estás seguro de que deseas eliminar la proyección ${code}?`)) return;

        try {
            await api.delete(`/billing-projections/${id}`);
            setProjections(prev => prev.filter(pr => pr.id !== id));
        } catch (error) {
            console.error(error);
            alert("No se pudo eliminar la proyección.");
        }
    };

    return {
        showProjectionModal,
        setShowProjectionModal,
        editingProjection,
        projForm,
        setProjForm,
        savingProjection,
        openNewProjectionModal,
        openEditProjectionModal,
        handleSaveProjection,
        handleDeleteProjection,
    };
}
