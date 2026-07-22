import { useState, useMemo } from 'react';
import SupplierPicker from './SupplierPicker';
import NewSupplierModal from './NewSupplierModal';
import NewContactFields from './NewContactFields';
import { LABEL_CLASS, CONTROL_CLASS, READONLY_CLASS, RequiredMark } from './supplierFieldStyles';
import { PROVEEDOR_NOVOTECHNO, PROVEEDOR_OTROS } from '../../../lib/constants';
import type { SupplierCompany, SupplierContact, SupplierFieldRequirements } from '../../../lib/types';

/** Valor centinela del <select> de contacto para entrar en modo alta. */
const NEW_CONTACT_VALUE = '__NEW__';

interface SupplierSectionProps {
    origen: string;
    companies: SupplierCompany[];
    isLoadingCompanies: boolean;
    supplierCompanyId: string | null | undefined;
    supplierContactId: string | null | undefined;
    onChange: (next: { supplierCompanyId: string | null; supplierContactId: string | null }) => void;
    requirements: SupplierFieldRequirements;
    enforceRequired: boolean;
    disabled?: boolean;
    createCompany: (name: string) => Promise<SupplierCompany>;
    createContact: (companyId: string, contact: { name: string; phone?: string; email?: string }) => Promise<SupplierContact>;
}

export default function SupplierSection({
    origen,
    companies,
    isLoadingCompanies,
    supplierCompanyId,
    supplierContactId,
    onChange,
    requirements,
    enforceRequired,
    disabled = false,
    createCompany,
    createContact,
}: SupplierSectionProps) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [pendingName, setPendingName] = useState('');
    const [isCreatingContact, setIsCreatingContact] = useState(false);

    const selectedCompany = useMemo(
        () => companies.find(c => c.id === supplierCompanyId),
        [companies, supplierCompanyId],
    );
    const selectedContact = useMemo(
        () => selectedCompany?.contacts.find(c => c.id === supplierContactId),
        [selectedCompany, supplierContactId],
    );

    // NOVOTECHNO no lleva empresa ni contacto (su campo OC llega en un paso posterior).
    if (origen === PROVEEDOR_NOVOTECHNO) return null;

    const handleCreateRequest = (name: string) => {
        setPendingName(name);
        setIsModalOpen(true);
    };

    const handleCompanyChange = (companyId: string | null) => {
        // Cambiar de empresa siempre resetea el contacto: el backend rechaza con 400 un
        // contacto que no pertenece a la empresa.
        setIsCreatingContact(false);
        onChange({ supplierCompanyId: companyId, supplierContactId: null });
    };

    const handleContactSelect = (value: string) => {
        if (value === NEW_CONTACT_VALUE) {
            setIsCreatingContact(true);
            onChange({ supplierCompanyId: supplierCompanyId ?? null, supplierContactId: null });
            return;
        }
        onChange({
            supplierCompanyId: supplierCompanyId ?? null,
            supplierContactId: value === '' ? null : value,
        });
    };

    const handleCancelContact = () => {
        setIsCreatingContact(false);
    };

    const contactSelectDisabled = disabled || !selectedCompany || isCreatingContact;

    return (
        <div className="col-span-full border-t border-slate-800 pt-6 mt-2">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <SupplierPicker
                    companies={companies}
                    value={supplierCompanyId ?? null}
                    onChange={handleCompanyChange}
                    disabled={disabled}
                    required={enforceRequired}
                    isLoading={isLoadingCompanies}
                    allowCreate={origen === PROVEEDOR_OTROS}
                    onCreateRequest={handleCreateRequest}
                />

                <div className="space-y-2">
                    <label className={LABEL_CLASS}>
                        Contacto
                        {enforceRequired && requirements.nameRequired && <RequiredMark />}
                    </label>
                    <select
                        value={isCreatingContact ? NEW_CONTACT_VALUE : (supplierContactId ?? '')}
                        onChange={e => handleContactSelect(e.target.value)}
                        disabled={contactSelectDisabled}
                        className={`${CONTROL_CLASS} appearance-none`}
                    >
                        {!selectedCompany ? (
                            <option value="">Seleccione primero la empresa</option>
                        ) : (
                            <>
                                <option value="">Sin contacto</option>
                                {selectedCompany.contacts.map(contact => (
                                    <option key={contact.id} value={contact.id}>{contact.name}</option>
                                ))}
                                <option value={NEW_CONTACT_VALUE}>+ Nuevo contacto</option>
                            </>
                        )}
                    </select>
                </div>

                {isCreatingContact && selectedCompany ? (
                    <NewContactFields
                        companyId={selectedCompany.id}
                        requirements={requirements}
                        disabled={disabled}
                        createContact={createContact}
                        onCreated={contact => {
                            onChange({ supplierCompanyId: selectedCompany.id, supplierContactId: contact.id });
                            setIsCreatingContact(false);
                        }}
                        onCancel={handleCancelContact}
                    />
                ) : (
                    <>
                        <div className="space-y-2">
                            <label className={LABEL_CLASS}>Teléfono</label>
                            <input type="text" readOnly value={selectedContact?.phone ?? '—'} className={READONLY_CLASS} />
                        </div>

                        <div className="space-y-2">
                            <label className={LABEL_CLASS}>Correo</label>
                            <input type="text" readOnly value={selectedContact?.email ?? '—'} className={READONLY_CLASS} />
                        </div>
                    </>
                )}
            </div>

            <NewSupplierModal
                isOpen={isModalOpen}
                initialName={pendingName}
                companies={companies}
                createCompany={createCompany}
                onClose={() => setIsModalOpen(false)}
                onCreated={company => onChange({ supplierCompanyId: company.id, supplierContactId: null })}
                onSelectExisting={company => onChange({ supplierCompanyId: company.id, supplierContactId: null })}
            />
        </div>
    );
}
