import { motion, AnimatePresence } from 'framer-motion';
import { Package, ChevronRight, CheckCircle2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { ProposalCalcItem, ScenarioItem } from '../../hooks/useScenarios';

interface ItemPickerModalProps {
    isOpen: boolean;
    onClose: () => void;
    proposalItems: ProposalCalcItem[];
    scenarioItems: ScenarioItem[] | undefined;
    onAddItem: (itemId: string) => void;
}

/** Modal animado para seleccionar artículos de la propuesta base e incluirlos en un escenario. */
export default function ItemPickerModal({ isOpen, onClose, proposalItems, scenarioItems, onAddItem }: ItemPickerModalProps) {
    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
                >
                    <motion.div 
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        className="bg-white w-full max-w-4xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
                    >
                        <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                            <div>
                                <h3 className="text-2xl font-black text-slate-900 tracking-tight flex items-center">
                                    <Package className="h-6 w-6 mr-3 text-indigo-600" />
                                    Picking de Artículos
                                </h3>
                                <p className="text-sm text-slate-500 font-medium">Seleccione los artículos de la propuesta original para incluir en este escenario.</p>
                            </div>
                            <button 
                                onClick={onClose}
                                className="p-4 rounded-2xl hover:bg-white transition-colors text-slate-400"
                            >
                                <ChevronRight className="h-6 w-6 rotate-90" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-8 space-y-4">
                            {proposalItems.map(item => {
                                const isAlreadyIn = scenarioItems?.some(si => si.itemId === item.id);
                                return (
                                    <div 
                                        key={item.id}
                                        className={cn(
                                            "flex items-center justify-between p-6 rounded-[2rem] border-2 transition-all",
                                            isAlreadyIn 
                                                ? "bg-emerald-50 border-emerald-100 opacity-60" 
                                                : "bg-white border-slate-100 hover:border-indigo-200"
                                        )}
                                    >
                                        <div className="flex items-center space-x-6">
                                            <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-50">
                                                <Package className="h-6 w-6 text-indigo-600" />
                                            </div>
                                            <div>
                                                <p className="text-lg font-black text-slate-900 leading-tight">{item.name}</p>
                                                <div className="flex items-center space-x-3 mt-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                                    <span>{item.itemType}</span>
                                                    <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
                                                    <span>Cost Landed: ${Number(item.unitCost).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                    <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
                                                    <span>Cant. Orig: {item.quantity}</span>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        {isAlreadyIn ? (
                                            <div className="flex items-center space-x-2 text-emerald-600 font-black text-[10px] uppercase tracking-widest px-6 py-3 bg-white rounded-xl shadow-sm">
                                                <CheckCircle2 className="h-4 w-4" />
                                                <span>Incluido</span>
                                            </div>
                                        ) : (
                                            <button 
                                                onClick={() => onAddItem(item.id)}
                                                className="px-8 py-3 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-600 transition-all active:scale-95 shadow-lg shadow-slate-200"
                                            >
                                                Agregar
                                            </button>
                                        )}
                                    </div>
                                );
                            })}

                            {proposalItems.length === 0 && (
                                <div className="text-center py-20 opacity-30">
                                    <Package className="h-20 w-20 mx-auto text-slate-400 mb-4" />
                                    <p className="text-lg font-bold text-slate-500">No hay ítems en la propuesta base.</p>
                                </div>
                            )}
                        </div>

                        <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-end">
                            <button 
                                onClick={onClose}
                                className="px-12 py-4 bg-white border-2 border-slate-200 rounded-2xl font-black text-[11px] uppercase tracking-widest text-slate-600 hover:border-slate-300 transition-all"
                            >
                                Cerrar Picking
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
