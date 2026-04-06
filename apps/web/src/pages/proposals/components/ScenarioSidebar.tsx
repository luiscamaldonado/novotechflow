import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Plus, Trash2, Loader2, AlertCircle,
    TrendingUp, Copy,
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import type { Scenario } from '../../../hooks/useScenarios';

interface ScenarioSidebarProps {
    scenarios: Scenario[];
    activeScenarioId: string | null;
    saving: boolean;
    setActiveScenarioId: (id: string) => void;
    createScenario: (name: string) => Promise<boolean | undefined>;
    deleteScenario: (id: string) => Promise<void>;
    cloneScenario: (id: string) => Promise<void>;
}

export default function ScenarioSidebar({
    scenarios,
    activeScenarioId,
    saving,
    setActiveScenarioId,
    createScenario,
    deleteScenario,
    cloneScenario,
}: ScenarioSidebarProps) {
    const [isCreatingScenario, setIsCreatingScenario] = useState(false);
    const [newScenarioName, setNewScenarioName] = useState('');

    const handleCreateScenario = async (e: React.FormEvent) => {
        e.preventDefault();
        const ok = await createScenario(newScenarioName);
        if (ok) {
            setNewScenarioName('');
            setIsCreatingScenario(false);
        }
    };

    return (
        <div className="lg:col-span-3 space-y-4">
            <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Escenarios</h3>
                    <button 
                        onClick={() => setIsCreatingScenario(true)}
                        className="p-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-all scale-90"
                    >
                        <Plus className="h-4 w-4" />
                    </button>
                </div>

                <div className="space-y-2">
                    <AnimatePresence mode="popLayout">
                        {scenarios.map(s => (
                            <motion.div 
                                key={s.id}
                                layout
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                onClick={() => setActiveScenarioId(s.id)}
                                className={cn(
                                    "group flex items-center justify-between p-4 rounded-2xl cursor-pointer transition-all border-2",
                                    activeScenarioId === s.id 
                                        ? "bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100" 
                                        : "bg-slate-50 border-transparent hover:bg-white hover:border-indigo-100 text-slate-600"
                                )}
                            >
                                <div className="flex items-center space-x-3">
                                    <TrendingUp className={cn("h-4 w-4", activeScenarioId === s.id ? "text-indigo-200" : "text-slate-400")} />
                                    <span className="text-sm font-black tracking-tight">{s.name}</span>
                                </div>
                                <div className="flex items-center space-x-1">
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); cloneScenario(s.id); }}
                                        className={cn(
                                            "p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity",
                                            activeScenarioId === s.id ? "hover:bg-indigo-500 text-indigo-200" : "hover:bg-indigo-50 text-slate-400 hover:text-indigo-500"
                                        )}
                                        title="Clonar escenario"
                                    >
                                        <Copy className="h-3.5 w-3.5" />
                                    </button>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); deleteScenario(s.id); }}
                                        className={cn(
                                            "p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity",
                                            activeScenarioId === s.id ? "hover:bg-indigo-500 text-indigo-200" : "hover:bg-red-50 text-slate-400 hover:text-red-500"
                                        )}
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>

                    {isCreatingScenario && (
                        <motion.form 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            onSubmit={handleCreateScenario}
                            className="p-2 space-y-3"
                        >
                            <input 
                                autoFocus
                                type="text" 
                                placeholder="Nombre del escenario..."
                                value={newScenarioName}
                                onChange={(e) => setNewScenarioName(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl bg-white border-2 border-indigo-100 text-sm font-bold focus:ring-0"
                            />
                            <div className="flex space-x-2">
                                <button 
                                    type="submit" 
                                    disabled={saving}
                                    className="flex-1 bg-indigo-600 text-white py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex justify-center items-center"
                                >
                                    {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Crear"}
                                </button>
                                <button type="button" onClick={() => setIsCreatingScenario(false)} className="px-4 py-2 text-slate-400 text-[10px] font-black uppercase tracking-widest">Cancelar</button>
                            </div>
                        </motion.form>
                    )}

                    {scenarios.length === 0 && !isCreatingScenario && (
                        <div className="py-8 text-center px-4">
                            <AlertCircle className="h-10 w-10 mx-auto text-slate-200 mb-3" />
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">No hay escenarios activos.<br/>Cree uno para comenzar.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
