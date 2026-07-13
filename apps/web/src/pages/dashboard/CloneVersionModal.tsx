import type { Dispatch, SetStateAction } from 'react';
import type { CloneVersionForm } from '../../hooks/useCloneVersion';
import { STATUS_CONFIG, ALL_STATUSES, ACQUISITION_CONFIG } from '../../lib/constants';

interface CloneVersionModalProps {
    form: CloneVersionForm;
    setForm: Dispatch<SetStateAction<CloneVersionForm>>;
    saving: boolean;
    onSave: () => void;
    onClose: () => void;
}

export default function CloneVersionModal({ form, setForm, saving, onSave, onClose }: CloneVersionModalProps) {
    const canSave = form.acquisitionType !== '' && form.closeDate !== '' && !saving;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
            <div className="w-full max-w-md rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between rounded-t-2xl bg-blue-600 px-5 py-4">
                    <h2 className="text-base font-semibold text-white">Clonar versión</h2>
                    <button onClick={onClose} className="text-white/70 transition-colors hover:text-white">✕</button>
                </div>
                <div className="space-y-4 px-5 py-5">
                    <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">Estado</label>
                        <select
                            value={form.status}
                            onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as CloneVersionForm['status'] }))}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                        >
                            {ALL_STATUSES.map((s) => (<option key={s} value={s}>{STATUS_CONFIG[s].label}</option>))}
                        </select>
                    </div>
                    <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">Adquisición</label>
                        <select
                            value={form.acquisitionType}
                            onChange={(e) => setForm((prev) => ({ ...prev, acquisitionType: e.target.value as CloneVersionForm['acquisitionType'] }))}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                        >
                            <option value="">Selecciona una opción</option>
                            <option value="VENTA">{ACQUISITION_CONFIG.VENTA.label}</option>
                            <option value="DAAS">{ACQUISITION_CONFIG.DAAS.label}</option>
                        </select>
                    </div>
                    <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">Fecha de cierre</label>
                        <input
                            type="date"
                            value={form.closeDate}
                            onChange={(e) => setForm((prev) => ({ ...prev, closeDate: e.target.value }))}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                        />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <button onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50">Cancelar</button>
                        <button onClick={onSave} disabled={!canSave} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">Clonar</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
