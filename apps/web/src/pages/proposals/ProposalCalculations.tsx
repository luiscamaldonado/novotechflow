import { useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import {
    Calculator, Loader2, Package,
    RotateCcw, Layers, FileSpreadsheet
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useScenarios, type ProposalCalcItem } from '../../hooks/useScenarios';
import ItemPickerModal from '../../components/proposals/ItemPickerModal';
import ScenarioTotalsCards from '../../components/proposals/ScenarioTotalsCards';
import { exportToExcel } from '../../lib/exportExcel';
import { useAuthStore } from '../../store/authStore';
import { calculateItemDisplayValues } from '../../lib/pricing-engine';
import { type AcquisitionMode } from '../../lib/constants';
import { resolveMargin } from '../../lib/pricing-engine';
import ScenarioItemRow from './components/ScenarioItemRow';
import ScenarioSidebar from './components/ScenarioSidebar';
import ScenarioHeader from './components/ScenarioHeader';
import ProposalStepper from '../../components/proposals/ProposalStepper';
import ProposalNavBar from '../../components/proposals/ProposalNavBar';

export default function ProposalCalculations() {
    const { id } = useParams<{ id: string }>();

    const {
        loading, saving, proposal, proposalItems, scenarios,
        activeScenarioId, setActiveScenarioId, activeScenario, totals,
        trm, extraTrm, loadData,
        createScenario, deleteScenario,
        addItemToScenario, removeItemFromScenario,
        addChildItem, removeChildItem, updateChildQuantity,
        changeCurrency, updateConversionTrm, updateMargin, updateQuantity,
        updateUnitPrice, updateGlobalMargin, toggleDilpidate,
        renameScenario,
        cloneScenario,
    } = useScenarios(id);

    // UI-only state
    const [isPickingItems, setIsPickingItems] = useState(false);
    const [editingCell, setEditingCell] = useState<{ id: string; field: string; value: string } | null>(null);
    const [globalMarginBuffer, setGlobalMarginBuffer] = useState<string | null>(null);
    const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
    const [pickingChildrenFor, setPickingChildrenFor] = useState<string | null>(null);

    // ── Acquisition mode per scenario (VENTA / DAAS) ──
    const [acquisitionModes, setAcquisitionModes] = useState<Record<string, AcquisitionMode>>({});
    const savedMarginsRef = useRef<Record<string, { global: number; items: Record<string, number> }>>({});

    const isDaasMode = (scenarioId: string | null) => {
        if (!scenarioId) return false;
        return (acquisitionModes[scenarioId] || 'VENTA') !== 'VENTA';
    };

    const handleAcquisitionChange = async (newMode: AcquisitionMode) => {
        if (!activeScenarioId || !activeScenario) return;
        const currentMode = acquisitionModes[activeScenarioId] || 'VENTA';
        if (newMode === currentMode) return;

        if (newMode !== 'VENTA' && currentMode === 'VENTA') {
            // Switching TO DaaS → save current margins, then set all to 0
            const marginSnapshot: Record<string, number> = {};
            activeScenario.scenarioItems.forEach(si => {
                const margin = resolveMargin(si.marginPctOverride, si.item.marginPct);
                marginSnapshot[si.id!] = margin;
            });
            savedMarginsRef.current[activeScenarioId] = {
                global: totals.globalMarginPct,
                items: marginSnapshot,
            };
            await updateGlobalMargin('0');
        } else if (newMode === 'VENTA' && currentMode !== 'VENTA') {
            // Switching BACK to VENTA → restore saved margins
            const saved = savedMarginsRef.current[activeScenarioId];
            if (saved) {
                for (const [siId, margin] of Object.entries(saved.items)) {
                    await updateMargin(siId, margin.toString());
                }
                delete savedMarginsRef.current[activeScenarioId];
            }
        }
        // Switching between DaaS modes — margins stay at 0, just update the mode

        setAcquisitionModes(prev => ({ ...prev, [activeScenarioId]: newMode }));
    };

    const toggleExpandItem = (siId: string) => {
        setExpandedItems(prev => {
            const next = new Set(prev);
            if (next.has(siId)) next.delete(siId);
            else next.add(siId);
            return next;
        });
    };

    if (loading || !proposal) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
            </div>
        );
    }

    return (
        <div className="max-w-[1600px] mx-auto space-y-6 px-4 pb-20">
            <ProposalStepper proposalId={id!} currentStep={2} />

            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <div>
                        <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 flex items-center">
                            <Calculator className="h-8 w-8 mr-3 text-indigo-600" />
                            Ventana de Cálculos
                        </h2>
                        <div className="flex items-center space-x-4 mt-1">
                            <p className="text-slate-500 text-sm font-medium">Modelación de Escenarios y Proyecciones Financieras</p>
                            {trm && (
                                <div className="flex items-center space-x-4 bg-emerald-50 px-6 py-4 rounded-[2rem] border-2 border-emerald-200 shadow-xl ml-6">
                                    <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
                                    <div className="flex flex-col justify-center">
                                        <div className="flex items-center space-x-2 mb-1">
                                            <span className="text-2xl font-black text-emerald-900 leading-none">
                                                ${trm.valor.toLocaleString('es-CO', { minimumFractionDigits: 2 })}
                                            </span>
                                            <span className="text-[10px] font-black text-emerald-600 bg-white px-2 py-0.5 rounded-lg border border-emerald-100 uppercase tracking-tighter">TRM USD/COP</span>
                                        </div>
                                        <div className="flex items-center space-x-1.5">
                                            <span className="text-[11px] font-black text-slate-900 uppercase tracking-[0.1em]">
                                                Vigencia Oficial:
                                            </span>
                                            <span className="text-[11px] font-bold text-indigo-600">
                                                {new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })}
                                            </span>
                                        </div>
                                    </div>

                                    <button 
                                        onClick={loadData}
                                        disabled={loading}
                                        className="p-3 bg-white hover:bg-emerald-100 text-emerald-600 rounded-2xl border border-emerald-100 shadow-sm transition-all active:scale-95 disabled:opacity-50"
                                        title="Actualizar TRM"
                                    >
                                        <RotateCcw className={cn("h-4 w-4", loading && "animate-spin")} />
                                    </button>
                                    
                                    {(extraTrm?.setIcapAverage || extraTrm?.wilkinsonSpot) && (
                                        <>
                                            <div className="w-px h-10 bg-emerald-200 mx-2 hidden md:block"></div>
                                            <div className="flex flex-col justify-center">
                                                <span className="text-[9px] font-black text-rose-500 uppercase tracking-widest leading-none mb-1">Dólar Mañana (Est.)</span>
                                                <div className="flex items-baseline space-x-3">
                                                    {extraTrm.setIcapAverage && (
                                                        <div className="flex flex-col">
                                                            <span className="text-lg font-black text-slate-800 leading-none">
                                                                ${extraTrm.setIcapAverage.toLocaleString('es-CO', { minimumFractionDigits: 2 })}
                                                            </span>
                                                            <span className="text-[8px] font-black text-slate-400 uppercase">SET-ICAP</span>
                                                        </div>
                                                    )}
                                                    {extraTrm.wilkinsonSpot && (
                                                        <div className="flex flex-col">
                                                            <span className="text-lg font-black text-slate-800 leading-none">
                                                                ${extraTrm.wilkinsonSpot.toLocaleString('es-CO', { minimumFractionDigits: 2 })}
                                                            </span>
                                                            <span className="text-[8px] font-black text-slate-400 uppercase">SPOT</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                <div className="bg-white px-6 py-3 rounded-2xl border border-slate-100 shadow-sm text-right ring-1 ring-slate-100">
                    <span className="text-[10px] text-slate-400 uppercase font-black tracking-[0.2em]">Propuesta No.</span>
                    <p className="text-2xl font-mono font-black text-indigo-600 leading-tight">{proposal.proposalCode}</p>
                </div>
            </div>

            {/* Export */}
            <div className="flex justify-end">
                <button 
                    onClick={async () => {
                        const { user } = useAuthStore.getState();
                        await exportToExcel({
                            proposalCode: proposal.proposalCode,
                            clientName: proposal.clientName,
                            userName: user?.name || 'Usuario',
                            scenarios,
                            proposalItems,
                            acquisitionModes,
                        });
                    }}
                    disabled={scenarios.length === 0}
                    className="flex items-center space-x-3 px-6 py-3 bg-emerald-600 text-white rounded-2xl shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all font-black text-[10px] uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    <FileSpreadsheet className="h-4 w-4" />
                    <span>Exportar Excel</span>
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Sidebar de Escenarios */}
                <ScenarioSidebar
                    scenarios={scenarios}
                    activeScenarioId={activeScenarioId}
                    saving={saving}
                    setActiveScenarioId={setActiveScenarioId}
                    createScenario={createScenario}
                    deleteScenario={deleteScenario}
                    cloneScenario={cloneScenario}
                />

                {/* Contenido Principal */}
                <div className="lg:col-span-9 space-y-6">
                    {activeScenario ? (
                        <>
                            {/* Editor de Escenario */}
                            <div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-100 border border-slate-100 overflow-hidden min-h-[500px] flex flex-col">
                                <ScenarioHeader
                                    activeScenario={activeScenario}
                                    totals={totals}
                                    activeScenarioId={activeScenarioId}
                                    isDaasMode={isDaasMode(activeScenarioId)}
                                    acquisitionModes={acquisitionModes}
                                    globalMarginBuffer={globalMarginBuffer}
                                    setGlobalMarginBuffer={setGlobalMarginBuffer}
                                    updateGlobalMargin={updateGlobalMargin}
                                    handleAcquisitionChange={handleAcquisitionChange}
                                    changeCurrency={changeCurrency}
                                    renameScenario={renameScenario}
                                    setIsPickingItems={setIsPickingItems}
                                    updateConversionTrm={updateConversionTrm}
                                    trm={trm}
                                    conversionTrm={activeScenario?.conversionTrm ?? null}
                                />

                                <div className="flex-1 overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="bg-slate-50 border-y border-slate-100">
                                            <tr>
                                                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">ITEM #</th>
                                                <th className="px-4 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Configuración de Item</th>
                                                <th className="px-4 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Cant.</th>
                                                <th className="px-4 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Margen (%)</th>
                                                <th className="px-4 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Unitario ($)</th>
                                                <th className="px-4 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Total ($)</th>
                                                <th className="px-4 py-6 text-[10px] font-black text-amber-500 uppercase tracking-[0.2em] text-center" title="Diluir el costo de este ítem entre los demás">
                                                    <div className="flex items-center justify-center space-x-1">
                                                        <Layers className="h-3 w-3" />
                                                        <span>Diluir</span>
                                                    </div>
                                                </th>
                                                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {activeScenario.scenarioItems.length === 0 ? (
                                                <tr>
                                                    <td colSpan={8} className="px-8 py-24 text-center">
                                                        <div className="max-w-xs mx-auto space-y-4 opacity-30 grayscale">
                                                            <Package className="h-16 w-16 mx-auto text-slate-400" />
                                                            <p className="text-sm font-bold text-slate-500">No hay ítems en este escenario. Realice un picking para empezar.</p>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ) : (
                                                [...activeScenario.scenarioItems]
                                                    .sort((a, b) => {
                                                        if (a.isDilpidate && !b.isDilpidate) return -1;
                                                        if (!a.isDilpidate && b.isDilpidate) return 1;
                                                        return 0;
                                                    })
                                                    .map((si, idx) => {
                                                    const displayValues = calculateItemDisplayValues(si, activeScenario.scenarioItems, activeScenario.currency, activeScenario.conversionTrm);
                                                    const item = si.item;
                                                    const globalItemIdx = proposal?.proposalItems.findIndex((pi: ProposalCalcItem) => pi.id === si.itemId) ?? -1;
                                                    const displayIdx = globalItemIdx !== -1 ? globalItemIdx + 1 : idx + 1;

                                                    return (
                                                        <ScenarioItemRow
                                                            key={si.id}
                                                            si={si}
                                                            item={item}
                                                            displayValues={displayValues}
                                                            displayIdx={displayIdx}
                                                            editingCell={editingCell}
                                                            setEditingCell={setEditingCell}
                                                            isExpanded={expandedItems.has(si.id!)}
                                                            isDaasMode={isDaasMode(activeScenarioId)}
                                                            toggleExpandItem={toggleExpandItem}
                                                            updateQuantity={updateQuantity}
                                                            updateMargin={updateMargin}
                                                            updateUnitPrice={updateUnitPrice}
                                                            toggleDilpidate={toggleDilpidate}
                                                            removeItemFromScenario={removeItemFromScenario}
                                                            updateChildQuantity={updateChildQuantity}
                                                            removeChildItem={removeChildItem}
                                                            setPickingChildrenFor={setPickingChildrenFor}
                                                            proposal={proposal}
                                                        />
                                                    );
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <ScenarioTotalsCards totals={totals} currency={activeScenario.currency} />
                        </>
                    ) : (
                        <div className="bg-white rounded-[2.5rem] p-32 text-center border-2 border-dashed border-slate-100">
                             <Calculator className="h-20 w-20 mx-auto text-slate-100 mb-6" />
                             <h4 className="text-xl font-black text-slate-300 uppercase tracking-tight">Seleccione o cree un escenario para modelar costos.</h4>
                        </div>
                    )}
                </div>
            </div>

            <ItemPickerModal
                isOpen={isPickingItems}
                onClose={() => setIsPickingItems(false)}
                proposalItems={proposalItems}
                scenarioItems={activeScenario?.scenarioItems}
                onAddItem={addItemToScenario}
            />

            {/* Child item picker — filters out the parent itself and items already added as children */}
            <ItemPickerModal
                isOpen={pickingChildrenFor !== null}
                onClose={() => setPickingChildrenFor(null)}
                proposalItems={proposalItems.filter(pi => {
                    const parentSi = activeScenario?.scenarioItems.find(si => si.id === pickingChildrenFor);
                    if (!parentSi) return true;
                    if (pi.id === parentSi.itemId) return false;
                    return true;
                })}
                scenarioItems={(() => {
                    const parentSi = activeScenario?.scenarioItems.find(si => si.id === pickingChildrenFor);
                    return parentSi?.children?.map(c => ({ ...c, itemId: c.itemId })) || [];
                })()}
                onAddItem={(itemId) => {
                    if (pickingChildrenFor) {
                        addChildItem(pickingChildrenFor, itemId);
                    }
                }}
            />

            <ProposalNavBar proposalId={id!} currentStep={2} />
        </div>
    );
}
