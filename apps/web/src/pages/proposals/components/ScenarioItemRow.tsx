import { motion } from 'framer-motion';
import {
    Trash2, Plus, Percent, ChevronDown, Layers,
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import type { ScenarioItem } from '../../../hooks/useScenarios';
import type { ProposalCalcItem } from '../../../hooks/useScenarios';
import type { ItemDisplayValues } from '../../../lib/pricing-engine';
import { calculateParentLandedCost } from '../../../lib/pricing-engine';
import {
    formatNumberWithThousands,
    formatDecimalWithThousands,
} from '../../../lib/format-utils';

interface ScenarioItemRowProps {
    si: ScenarioItem;
    item: ProposalCalcItem;
    displayValues: ItemDisplayValues;

    displayIdx: number;
    editingCell: { id: string; field: string; value: string } | null;
    setEditingCell: (cell: { id: string; field: string; value: string } | null) => void;
    isExpanded: boolean;
    isDaasMode: boolean;
    toggleExpandItem: (siId: string) => void;
    updateQuantity: (siId: string, value: string) => void;
    updateMargin: (siId: string, value: string) => void;
    updateUnitPrice: (siId: string, value: string) => void;
    toggleDilpidate: (siId: string) => void;
    removeItemFromScenario: (siId: string) => void;
    updateChildQuantity: (parentSiId: string, childId: string, value: string) => void;
    removeChildItem: (parentSiId: string, childId: string) => void;
    setPickingChildrenFor: (siId: string) => void;
    proposal: { proposalItems: ProposalCalcItem[] };
}

export default function ScenarioItemRow({
    si,
    item,
    displayValues,

    displayIdx,
    editingCell,
    setEditingCell,
    isExpanded,
    isDaasMode,
    toggleExpandItem,
    updateQuantity,
    updateMargin,
    updateUnitPrice,
    toggleDilpidate,
    removeItemFromScenario,
    updateChildQuantity,
    removeChildItem,
    setPickingChildrenFor,
    proposal,
}: ScenarioItemRowProps) {
    const { childrenCostPerUnit, margin, unitPrice } = displayValues;
    const children = si.children || [];
    const childCount = children.length;

    return (
        <>
        <tr key={si.id} className={cn(
            "group transition-colors",
            si.isDilpidate
                ? "bg-amber-50/70 hover:bg-amber-50"
                : "hover:bg-slate-50"
        )}>
            <td className="px-8 py-6">
                <div className="flex items-center space-x-2">
                    <button
                        onClick={() => toggleExpandItem(si.id!)}
                        className={cn(
                            "p-1 rounded-lg transition-all",
                            isExpanded ? "bg-indigo-100 text-indigo-600" : "text-slate-300 hover:text-indigo-400 hover:bg-indigo-50"
                        )}
                    >
                        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", isExpanded && "rotate-180")} />
                    </button>
                    <span className="text-[11px] font-black text-indigo-400 bg-indigo-50 px-2 py-1 rounded-lg">#{displayIdx}</span>
                    {childCount > 0 && (
                        <span className="text-[9px] font-black bg-violet-100 text-violet-600 px-1.5 py-0.5 rounded-md">
                            +{childCount}
                        </span>
                    )}
                </div>
            </td>
            <td className="px-4 py-6">
                <div className="flex flex-col">
                    <span className="font-black text-slate-900 text-sm">{item.name}</span>
                    <span className="text-[10px] text-slate-400 font-bold uppercase">{item.itemType} {item.isTaxable ? '(Gravado 19%)' : '(No Gravado)'}</span>
                    {childCount > 0 && (
                        <span className="text-[9px] text-violet-500 font-bold mt-0.5">
                            Incluye {childCount} sub-ítem{childCount > 1 ? 's' : ''} oculto{childCount > 1 ? 's' : ''}
                        </span>
                    )}
                </div>
            </td>
            <td className="px-4 py-6">
                <input 
                    type="text" 
                    value={editingCell?.id === si.id && editingCell?.field === 'quantity'
                        ? editingCell.value
                        : formatNumberWithThousands(si.quantity)}
                    onFocus={() => setEditingCell({ id: si.id!, field: 'quantity', value: String(si.quantity) })}
                    onChange={(e) => setEditingCell({ id: si.id!, field: 'quantity', value: e.target.value })}
                    onBlur={(e) => {
                        const parsed = parseInt(e.target.value.replace(/\D/g, ''), 10);
                        if (!isNaN(parsed) && parsed > 0) {
                            updateQuantity(si.id!, String(parsed));
                        }
                        setEditingCell(null);
                    }}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                        if (e.key === 'Escape') setEditingCell(null);
                    }}
                    className="w-20 mx-auto bg-slate-100 border-none rounded-xl text-center font-black text-xs py-2 focus:ring-2 focus:ring-indigo-600/20"
                />
            </td>
            <td className="px-4 py-6">
                {si.isDilpidate ? (
                    <div className="relative w-24 mx-auto">
                        <input 
                            type="text" 
                            value="0.00"
                            disabled
                            className="w-full bg-amber-50 border-none rounded-xl text-center font-black text-xs py-2 pl-6 text-amber-400 cursor-not-allowed"
                        />
                        <Percent className="absolute left-2 top-2.5 h-3 w-3 text-amber-300" />
                    </div>
                ) : isDaasMode ? (
                    <div className="relative w-24 mx-auto">
                        <input 
                            type="text" 
                            value="0.00"
                            disabled
                            className="w-full bg-pink-50 border-none rounded-xl text-center font-black text-xs py-2 pl-6 text-pink-400 cursor-not-allowed"
                        />
                        <Percent className="absolute left-2 top-2.5 h-3 w-3 text-pink-300" />
                    </div>
                ) : (
                    <div className="relative w-24 mx-auto">
                        <input 
                            type="text" 
                            value={editingCell?.id === si.id && editingCell?.field === 'margin' 
                                ? editingCell.value 
                                : formatDecimalWithThousands(margin.toFixed(2))}
                            onFocus={() => {
                                setEditingCell({ id: si.id!, field: 'margin', value: margin.toFixed(2) });
                            }}
                            onChange={(e) => setEditingCell({ id: si.id!, field: 'margin', value: e.target.value })}
                            onBlur={(e) => {
                                const parsed = parseFloat(e.target.value.replace(',', '.'));
                                if (!isNaN(parsed)) {
                                    updateMargin(si.id!, String(parsed));
                                }
                                setEditingCell(null);
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                if (e.key === 'Escape') setEditingCell(null);
                            }}
                            className={cn(
                                "w-full bg-indigo-50 border-none rounded-xl text-center font-black text-xs py-2 pl-6",
                                (si.marginPctOverride !== undefined && si.marginPctOverride !== null) ? "text-indigo-600" : "text-slate-400"
                            )}
                        />
                        <Percent className="absolute left-2 top-2.5 h-3 w-3 text-indigo-300" />
                    </div>
                )}
            </td>
            <td className="px-4 py-6 text-right font-mono text-xs text-slate-500">
                {si.isDilpidate ? (
                    <span className="text-xs font-black text-amber-400">—</span>
                ) : isDaasMode ? (
                    <span className="text-xs font-black text-pink-400 bg-pink-50 px-3 py-2 rounded-xl">{unitPrice.toFixed(2)}</span>
                ) : (
                    <input 
                        type="text"
                        value={editingCell?.id === si.id && editingCell?.field === 'unitPrice' 
                            ? editingCell.value 
                            : formatDecimalWithThousands(unitPrice.toFixed(2))}
                        onFocus={() => setEditingCell({ id: si.id!, field: 'unitPrice', value: unitPrice.toFixed(2) })}
                        onChange={(e) => setEditingCell({ id: si.id!, field: 'unitPrice', value: e.target.value })}
                        onBlur={(e) => {
                            const parsed = parseFloat(e.target.value.replace(',', '.'));
                            if (!isNaN(parsed) && parsed > 0) {
                                updateUnitPrice(si.id!, String(parsed));
                            }
                            setEditingCell(null);
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                            if (e.key === 'Escape') setEditingCell(null);
                        }}
                        className="w-28 bg-slate-100 border-none rounded-xl text-right font-black text-xs py-2 px-3 focus:ring-2 focus:ring-indigo-600/20"
                    />
                )}
            </td>
            <td className="px-4 py-6 text-right font-mono font-black text-indigo-600">
                {si.isDilpidate ? (
                    <span className="text-[10px] font-black text-amber-600 bg-amber-100 px-3 py-1.5 rounded-lg uppercase tracking-widest">
                        Diluido
                    </span>
                ) : (
                    <>${ (unitPrice * si.quantity).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</>
                )}
            </td>
            <td className="px-4 py-6 text-center">
                <button
                    onClick={() => toggleDilpidate(si.id!)}
                    className={cn(
                        "p-2 rounded-xl transition-all border-2",
                        si.isDilpidate
                            ? "bg-amber-500 border-amber-500 text-white shadow-lg shadow-amber-200 scale-110"
                            : "bg-white border-slate-200 text-slate-300 hover:border-amber-300 hover:text-amber-500"
                    )}
                    title={si.isDilpidate ? 'Quitar dilución de costo' : 'Diluir costo entre los demás ítems'}
                >
                    <Layers className="h-3.5 w-3.5" />
                </button>
            </td>
            <td className="px-8 py-6 text-right">
                <button 
                    onClick={() => removeItemFromScenario(si.id!)}
                    className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                >
                    <Trash2 className="h-4 w-4" />
                </button>
            </td>
        </tr>
        {/* Expanded children section */}
        {isExpanded && (
            <tr key={`${si.id}-children`}>
                <td colSpan={8} className="px-0 py-0">
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="bg-violet-50/50 border-y border-violet-100"
                    >
                        <div className="px-12 py-4 space-y-2">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[9px] font-black text-violet-500 uppercase tracking-widest">Sub-ítems ocultos de #{displayIdx}</span>
                                <button
                                    onClick={() => setPickingChildrenFor(si.id!)}
                                    className="flex items-center space-x-1.5 text-[9px] font-black uppercase tracking-widest text-violet-600 bg-violet-100 hover:bg-violet-200 px-3 py-1.5 rounded-lg transition-colors"
                                >
                                    <Plus className="h-3 w-3" />
                                    <span>Agregar Oculto</span>
                                </button>
                            </div>
                            {children.length === 0 ? (
                                <p className="text-[10px] text-violet-400 font-bold py-3 text-center">No hay sub-ítems ocultos. Agregue artículos cuyo costo se absorba dentro del ítem #{displayIdx}.</p>
                            ) : (
                                children.map(child => {
                                    const childGlobalIdx = proposal?.proposalItems.findIndex((pi: ProposalCalcItem) => pi.id === child.itemId) ?? -1;
                                    const childDisplayIdx = childGlobalIdx !== -1 ? childGlobalIdx + 1 : '?';
                                    const cLanded = calculateParentLandedCost(Number(child.item.unitCost), Number(child.item.internalCosts?.fletePct || 0));
                                    return (
                                        <div key={child.id} className="flex items-center justify-between bg-white px-4 py-3 rounded-xl border border-violet-100 shadow-sm">
                                            <div className="flex items-center space-x-3 flex-1 min-w-0">
                                                <span className="text-[10px] font-black text-violet-400 bg-violet-100 px-1.5 py-0.5 rounded shrink-0">#{childDisplayIdx}</span>
                                                <div className="min-w-0">
                                                    <p className="text-xs font-black text-slate-800 truncate">{child.item.name}</p>
                                                    <p className="text-[9px] text-slate-400 font-bold uppercase">{child.item.itemType}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center space-x-5 shrink-0">
                                                <div className="flex flex-col items-center">
                                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Cant.</span>
                                                    <input
                                                        type="text"
                                                        inputMode="numeric"
                                                        value={child.quantity}
                                                        onChange={(e) => updateChildQuantity(si.id!, child.id!, e.target.value)}
                                                        className="w-14 text-[11px] font-black text-slate-700 bg-slate-100 hover:bg-slate-200 focus:bg-white focus:ring-2 focus:ring-violet-300 border-none px-2 py-1 rounded-lg text-center transition-all"
                                                    />
                                                </div>
                                                <div className="flex flex-col items-end">
                                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Costo Unit.</span>
                                                    <span className="text-[11px] font-mono font-black text-emerald-600">${cLanded.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                </div>
                                                <div className="flex flex-col items-end">
                                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Total</span>
                                                    <span className="text-[11px] font-mono font-black text-violet-600">${(cLanded * child.quantity).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                </div>
                                                <button
                                                    onClick={() => removeChildItem(si.id!, child.id!)}
                                                    className="p-1.5 text-slate-300 hover:text-red-500 transition-colors"
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                            {children.length > 0 && (
                                <div className="flex justify-end pt-1">
                                    <span className="text-[9px] font-black text-violet-600 bg-violet-100 px-3 py-1 rounded-lg">
                                        Costo oculto total: ${childrenCostPerUnit.toLocaleString('es-CO', { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                            )}
                        </div>
                    </motion.div>
                </td>
            </tr>
        )}
        </>
    );
}
