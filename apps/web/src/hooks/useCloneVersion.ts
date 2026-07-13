import { useState } from 'react';
import { api } from '../lib/api';
import type { ProposalStatus } from '../lib/types';

export interface CloneVersionForm {
    closeDate: string;
    acquisitionType: '' | 'VENTA' | 'DAAS';
    status: ProposalStatus;
}

export function useCloneVersion(reload: () => Promise<void>) {
    const [showCloneVersionModal, setShowCloneVersionModal] = useState(false);
    const [cloneVersionProposalId, setCloneVersionProposalId] = useState<string | null>(null);
    const [cloneVersionForm, setCloneVersionForm] = useState<CloneVersionForm>({
        closeDate: '', acquisitionType: '', status: 'ELABORACION',
    });
    const [cloningVersion, setCloningVersion] = useState(false);

    const openCloneVersionModal = (id: string) => {
        setCloneVersionProposalId(id);
        setCloneVersionForm({ closeDate: '', acquisitionType: '', status: 'ELABORACION' });
        setShowCloneVersionModal(true);
    };

    const handleSaveCloneVersion = async () => {
        if (!cloneVersionProposalId) return;
        if (cloneVersionForm.acquisitionType === '' || cloneVersionForm.closeDate === '') return;
        setCloningVersion(true);
        try {
            await api.post(`/proposals/${cloneVersionProposalId}/clone`, {
                cloneType: 'NEW_VERSION',
                status: cloneVersionForm.status,
                acquisitionType: cloneVersionForm.acquisitionType,
                closeDate: cloneVersionForm.closeDate,
            });
            await reload();
            setShowCloneVersionModal(false);
        } catch (error) {
            console.error(error);
            alert('No se pudo clonar la propuesta.');
        } finally {
            setCloningVersion(false);
        }
    };

    return {
        showCloneVersionModal, setShowCloneVersionModal,
        cloneVersionForm, setCloneVersionForm, cloningVersion,
        openCloneVersionModal, handleSaveCloneVersion,
    };
}
