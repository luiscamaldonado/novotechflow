import { useState } from 'react';
import { Folder, Plus } from 'lucide-react';
import { type ProposalPage } from '../../../hooks/useProposalPages';
import { type ProposalVariables } from '../../../lib/proposalVariables';
import SheetThumbnail from './SheetThumbnail';

interface SectionViewProps {
    section: ProposalPage;
    sheets: ProposalPage[];
    /** Encabezados resueltos por resolveSheetHeading, paralelos a sheets */
    sheetHeadings: string[];
    proposalVars: ProposalVariables;
    ownerSignatureUrl?: string;
    isReadOnly: boolean;
    onUpdateTitle: (title: string) => void;
    onAddSheet: () => void;
    onOpenSheet: (id: string) => void;
}

function SectionView({ section, sheets, sheetHeadings, proposalVars, ownerSignatureUrl, isReadOnly, onUpdateTitle, onAddSheet, onOpenSheet }: SectionViewProps) {
    // El consumidor remonta con key compuesto id:titulo (ADR-086): el buffer se
    // inicializa una vez por valor de titulo, sin prop-sync effect; un rename
    // externo (p. ej. desde el sidebar) tambien reinicializa el buffer.
    const [titleBuffer, setTitleBuffer] = useState(section.title || '');

    const commitTitle = () => {
        const trimmed = titleBuffer.trim();
        if (trimmed && trimmed !== section.title) {
            onUpdateTitle(trimmed);
        }
    };

    return (
        <div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-100 border border-slate-100">
            {/* Encabezado de la sección */}
            <div className="p-8 bg-slate-50/50 border-b border-slate-100">
                <div className="flex items-center space-x-4">
                    <div className="p-3 rounded-2xl shadow-lg bg-indigo-50 border border-indigo-200">
                        <Folder className="h-6 w-6 text-indigo-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <input
                            type="text"
                            value={titleBuffer}
                            disabled={isReadOnly}
                            onChange={(e) => setTitleBuffer(e.target.value)}
                            onBlur={commitTitle}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                            }}
                            placeholder={'T\u00edtulo de la secci\u00f3n...'}
                            className="w-full max-w-md text-xl font-black text-slate-900 tracking-tight bg-transparent border-2 border-transparent hover:border-indigo-100 focus:bg-white focus:border-indigo-200 rounded-xl px-3 py-1 outline-none transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                        />
                        <div className="flex items-center space-x-2 mt-1 px-3">
                            <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-600">
                                Sección
                            </span>
                            <span className="text-sm text-slate-400 font-medium">
                                · {sheets.length} hoja{sheets.length !== 1 ? 's' : ''}
                            </span>
                        </div>
                    </div>
                </div>
                <p className="mt-4 text-sm text-slate-500 leading-relaxed">
                    La sección es dueña del título. Cada hoja se imprime tal cual, una por página del PDF.
                </p>
            </div>

            {/* Miniaturas de las hojas: papel real escalado, corte identico al PDF */}
            <div className="p-8 space-y-6">
                <div className="grid grid-cols-2 xl:grid-cols-3 gap-4 justify-items-center">
                    {sheets.map((sheet, idx) => (
                        <SheetThumbnail
                            key={sheet.id}
                            sheet={sheet}
                            heading={sheetHeadings[idx] ?? ''}
                            proposalVars={proposalVars}
                            ownerSignatureUrl={ownerSignatureUrl}
                            onOpen={() => onOpenSheet(sheet.id)}
                        />
                    ))}
                </div>

                <button
                    type="button"
                    onClick={onAddSheet}
                    disabled={isReadOnly}
                    className="w-full flex items-center justify-center space-x-2 px-4 py-3 rounded-2xl border-2 border-dashed border-indigo-200 text-indigo-600 hover:bg-indigo-50 hover:border-indigo-300 transition-all font-black text-[10px] uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Plus className="h-4 w-4" />
                    <span>Agregar hoja</span>
                </button>
            </div>
        </div>
    );
}

export default SectionView;
