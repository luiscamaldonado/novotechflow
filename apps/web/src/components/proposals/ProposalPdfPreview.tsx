import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { api } from '../../lib/api';
import type { ProposalDetail } from '../../lib/types';
import type { ProposalPage } from '../../hooks/useProposalPages';
import { useProposalScenarios } from '../../hooks/useProposalScenarios';
import { buildProposalVariables } from '../../lib/proposalVariables';
import { PDF_PREVIEW_EXCEL_EXPORT } from '../../lib/constants';
import PdfPreviewModal from './PdfPreviewModal';

interface ProposalPdfPreviewProps {
    proposalId: string;
    onClose: () => void;
}

/** Contenido de un estado interstitial: titulo, linea secundaria y spinner. */
interface NoticeContent {
    title: string;
    detail?: string;
    spinner?: boolean;
}

/**
 * Tarjeta a pantalla completa para los estados previos al visor.
 * Reusa el velo del propio PdfPreviewModal para que la transicion
 * al documento no parpadee.
 */
function PreviewNotice({ title, detail, spinner, onClose }: NoticeContent & { onClose: () => void }) {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-4"
        >
            <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl shadow-black/30 px-8 py-7 text-center">
                {spinner && <Loader2 className="h-8 w-8 animate-spin text-indigo-500 mx-auto mb-4" />}
                <p className="text-base font-black text-slate-900 tracking-tight">{title}</p>
                {detail && <p className="mt-2 text-sm font-medium text-slate-500">{detail}</p>}
                <button
                    onClick={onClose}
                    className="mt-6 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-black tracking-tight hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-600/30"
                >
                    Cerrar
                </button>
            </div>
        </motion.div>
    );
}

/**
 * Visor de PDF autonomo: dado el id de una propuesta carga por su cuenta
 * el detalle, las paginas del documento y los escenarios procesados, arma
 * las variables de marcadores y monta el visor.
 *
 * Las paginas se leen con el GET puro; nunca con el POST de initialize,
 * que crearia las paginas por defecto. Abrir una vista previa no escribe.
 */
export default function ProposalPdfPreview({ proposalId, onClose }: ProposalPdfPreviewProps) {
    const [proposal, setProposal] = useState<ProposalDetail | null>(null);
    const [loadingProposal, setLoadingProposal] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const [pages, setPages] = useState<ProposalPage[]>([]);
    const [loadingPages, setLoadingPages] = useState(true);

    useEffect(() => {
        api.get(`/proposals/${proposalId}`).then(res => {
            const data = res.data;
            if (data.issueDate) data.issueDate = data.issueDate.split('T')[0];
            if (data.validityDate) data.validityDate = data.validityDate.split('T')[0];
            setProposal(data);
        }).catch(err => {
            console.error('Error loading proposal for preview', err);
            setLoadError(true);
        }).finally(() => setLoadingProposal(false));
    }, [proposalId]);

    useEffect(() => {
        api.get(`/proposals/${proposalId}/pages`).then(res => {
            setPages(res.data || []);
        }).catch(err => {
            console.error('Error loading proposal pages for preview', err);
            setLoadError(true);
        }).finally(() => setLoadingPages(false));
    }, [proposalId]);

    const { loading: loadingScenarios, processedScenarios } = useProposalScenarios(proposalId);

    const proposalVars = useMemo(() => buildProposalVariables(proposal, proposal?.issueCity || ''), [proposal]);

    // Esperar a las tres cargas es deliberado: montar el visor antes de tener
    // los escenarios pinta la propuesta economica vacia.
    const isLoading = loadingProposal || loadingPages || loadingScenarios;

    // Orden deliberado: cargando -> error -> sin ciudad -> sin documento -> visor.
    let notice: NoticeContent | null = null;
    if (isLoading) {
        notice = { title: 'Preparando la vista previa…', spinner: true };
    } else if (loadError) {
        notice = {
            title: 'No se pudo cargar la propuesta.',
            detail: 'Revisa tu conexión y vuelve a intentarlo.',
        };
    } else if (!proposal?.issueCity) {
        // Misma regla que ADR-059 aplica en el constructor deshabilitando el
        // boton de vista previa: sin ciudad el PDF sale con µCiudad sin reemplazar.
        notice = {
            title: 'Esta propuesta no tiene ciudad de emisión.',
            detail: 'Ábrela en Construcción del Documento y selecciónala antes de generar el PDF.',
        };
    } else if (pages.length === 0) {
        notice = {
            title: 'Esta propuesta todavía no tiene documento construido.',
            detail: 'Ábrela en Construcción del Documento para armarlo.',
        };
    }

    return (
        <AnimatePresence>
            {notice ? (
                <PreviewNotice key="notice" {...notice} onClose={onClose} />
            ) : (
                <PdfPreviewModal
                    key="preview"
                    pages={pages}
                    onClose={onClose}
                    proposalVars={proposalVars}
                    processedScenarios={processedScenarios}
                    ownerSignatureUrl={proposal?.user?.signatureUrl}
                    enableExcelExport={PDF_PREVIEW_EXCEL_EXPORT}
                />
            )}
        </AnimatePresence>
    );
}
