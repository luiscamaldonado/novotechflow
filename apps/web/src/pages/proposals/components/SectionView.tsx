import { useEffect, useState } from 'react';
import { Folder, Plus, FileText, ChevronRight } from 'lucide-react';
import { type ProposalPage } from '../../../hooks/useProposalPages';

interface SectionViewProps {
    section: ProposalPage;
    sheets: ProposalPage[];
    isReadOnly: boolean;
    onUpdateTitle: (title: string) => void;
    onAddSheet: () => void;
    onOpenSheet: (id: string) => void;
}

function SectionView({ section, sheets, isReadOnly, onUpdateTitle, onAddSheet, onOpenSheet }: SectionViewProps) {
    const [titleBuffer, setTitleBuffer] = useState(section.title || '');

    // Re-sincroniza el buffer solo al cambiar de sección
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- sync props->estado al cambiar de seccion: pendiente del tratamiento de ADR-086 (remontaje con key o estado derivado)
        setTitleBuffer(section.title || '');
    }, [section.id]); // eslint-disable-line react-hooks/exhaustive-deps

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

            {/* Hojas de la sección */}
            <div className="p-8 space-y-3">
                {sheets.map((sheet, idx) => (
                    <button
                        key={sheet.id}
                        type="button"
                        onClick={() => onOpenSheet(sheet.id)}
                        className="w-full flex items-center justify-between p-4 rounded-2xl bg-slate-50 border-2 border-transparent hover:bg-white hover:border-indigo-100 transition-all text-left"
                    >
                        <div className="flex items-center space-x-3 min-w-0">
                            <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                            <span className="text-sm font-black tracking-tight text-slate-700">
                                Hoja {idx + 1}
                            </span>
                            <span className="text-xs text-slate-400 font-medium">
                                · {sheet.blocks.length} bloque{sheet.blocks.length !== 1 ? 's' : ''}
                            </span>
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
                    </button>
                ))}

                {sheets.length === 0 && (
                    <div className="py-10 text-center">
                        <FileText className="h-12 w-12 mx-auto text-slate-100 mb-3" />
                        <p className="text-sm font-bold text-slate-400">
                            Esta sección no tiene hojas aún.
                        </p>
                    </div>
                )}

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
