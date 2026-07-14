import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { LABEL_CLASS, CONTROL_CLASS, RequiredMark } from './supplierFieldStyles';
import type { SupplierContact, SupplierFieldRequirements } from '../../../lib/types';

/** Debe coincidir con el @IsEmail del backend: un correo mal formado devuelve 400. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface NewContactForm {
    name: string;
    phone: string;
    email: string;
}

const EMPTY_CONTACT: NewContactForm = { name: '', phone: '', email: '' };

interface NewContactFieldsProps {
    companyId: string;
    requirements: SupplierFieldRequirements;
    disabled?: boolean;
    createContact: (companyId: string, contact: { name: string; phone?: string; email?: string }) => Promise<SupplierContact>;
    onCreated: (contact: SupplierContact) => void;
    onCancel: () => void;
}

export default function NewContactFields({
    companyId,
    requirements,
    disabled = false,
    createContact,
    onCreated,
    onCancel,
}: NewContactFieldsProps) {
    const [newContact, setNewContact] = useState<NewContactForm>(EMPTY_CONTACT);
    const [isSavingContact, setIsSavingContact] = useState(false);
    const [contactError, setContactError] = useState<string | null>(null);

    const emailValue = newContact.email.trim();
    const isNewContactValid =
        newContact.name.trim().length > 0 &&
        (!requirements.phoneRequired || newContact.phone.trim().length > 0) &&
        (!requirements.emailRequired || emailValue.length > 0) &&
        (emailValue.length === 0 || EMAIL_PATTERN.test(emailValue));

    const handleSaveContact = async () => {
        setIsSavingContact(true);
        setContactError(null);
        try {
            const contact = await createContact(companyId, {
                name: newContact.name.trim(),
                phone: newContact.phone.trim() || undefined,
                email: newContact.email.trim() || undefined,
            });
            onCreated(contact);
            setNewContact(EMPTY_CONTACT);
        } catch {
            setContactError('No se pudo guardar el contacto. Intente de nuevo.');
        } finally {
            setIsSavingContact(false);
        }
    };

    return (
        <>
            <div className="space-y-2">
                <label className={LABEL_CLASS}>
                    Teléfono
                    {requirements.phoneRequired && <RequiredMark />}
                </label>
                <input
                    type="text"
                    value={newContact.phone}
                    onChange={e => setNewContact(prev => ({ ...prev, phone: e.target.value }))}
                    disabled={disabled || isSavingContact}
                    placeholder="Teléfono del contacto"
                    className={CONTROL_CLASS}
                />
            </div>

            <div className="space-y-2">
                <label className={LABEL_CLASS}>
                    Correo
                    {requirements.emailRequired && <RequiredMark />}
                </label>
                <input
                    type="text"
                    value={newContact.email}
                    onChange={e => setNewContact(prev => ({ ...prev, email: e.target.value }))}
                    disabled={disabled || isSavingContact}
                    placeholder="Correo del contacto"
                    className={CONTROL_CLASS}
                />
            </div>

            <div className="space-y-2 md:col-span-2">
                <label className={LABEL_CLASS}>
                    Nombre del contacto
                    <RequiredMark />
                </label>
                <input
                    type="text"
                    value={newContact.name}
                    onChange={e => setNewContact(prev => ({ ...prev, name: e.target.value }))}
                    disabled={disabled || isSavingContact}
                    placeholder="escriba el gerente de producto o comercial del tercero"
                    className={CONTROL_CLASS}
                    autoFocus
                />
            </div>

            <div className="md:col-span-2 flex items-end justify-end gap-3">
                <button
                    type="button"
                    onClick={onCancel}
                    disabled={disabled || isSavingContact}
                    className="px-5 py-2.5 text-slate-400 font-black text-[10px] uppercase tracking-widest hover:text-slate-200 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                    Cancelar
                </button>
                <button
                    type="button"
                    onClick={handleSaveContact}
                    disabled={disabled || isSavingContact || !isNewContactValid}
                    className="flex items-center gap-2 px-6 py-2.5 bg-indigo-500 hover:bg-indigo-400 text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                >
                    {isSavingContact && <Loader2 className="h-3 w-3 animate-spin" />}
                    <span>Guardar contacto</span>
                </button>
            </div>

            {contactError && (
                <p className="col-span-full text-xs font-bold text-red-400 ml-1">{contactError}</p>
            )}
        </>
    );
}
