import { Lock, ShieldAlert } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { type ProposalPage } from '../../../hooks/useProposalPages';
import { PAGE_TYPE_LABELS, PAGE_TYPE_STYLES } from '../../../lib/constants';

function LockedPageView({ page }: { page: ProposalPage }) {
    const style = PAGE_TYPE_STYLES[page.pageType] || PAGE_TYPE_STYLES.CUSTOM;
    const IconComponent = style.icon;

    return (
        <div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-100 border border-slate-100">
            <div className="p-8 bg-slate-50/50 border-b border-slate-100">
                <div className="flex items-center space-x-4">
                    <div className={cn("p-3 rounded-2xl shadow-lg", style.bg, style.border, "border")}>
                        <IconComponent className={cn("h-6 w-6", style.text)} />
                    </div>
                    <div>
                        <h4 className="text-xl font-black text-slate-900 tracking-tight">
                            {page.title || PAGE_TYPE_LABELS[page.pageType]}
                        </h4>
                        <div className="flex items-center space-x-2 mt-1">
                            <span className={cn("text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg", style.bg, style.text)}>
                                {PAGE_TYPE_LABELS[page.pageType]}
                            </span>
                            <Lock className="h-3 w-3 text-slate-400" />
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Solo Administrador</span>
                        </div>
                    </div>
                </div>
            </div>
            <div className="p-16 text-center">
                <ShieldAlert className="h-16 w-16 mx-auto text-amber-200 mb-4" />
                <h4 className="text-lg font-black text-slate-300">Página Predeterminada</h4>
                <p className="text-sm text-slate-400 mt-2 max-w-sm mx-auto">
                    Esta página es parte de la estructura base del documento. Solo un administrador puede modificar su contenido y orden.
                </p>
            </div>
        </div>
    );
}

export default LockedPageView;
