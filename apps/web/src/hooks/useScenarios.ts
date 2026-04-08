import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import {
    calculateScenarioTotals,
    calculateParentLandedCost,
    calculateChildrenCostPerUnit,
    calculateBaseLandedCost,
    calculateDilutionPerUnit,
    calculateEffectiveLandedCost,
    calculateTotalDilutedCost,
    calculateTotalNormalSubtotal,
    calculateMarginFromPrice,
    convertCost,
    type ScenarioTotals,
} from '../lib/pricing-engine';

// ── Tipos ────────────────────────────────────────────────────
// ProposalCalcItem is kept here for backward-compat with consumers
// that import it from this file (ItemPickerModal, ProposalCalculations, etc.)
export interface ProposalCalcItem {
    id: string;
    name: string;
    itemType: string;
    unitCost: number;
    costCurrency?: string;
    marginPct: number;
    unitPrice: number;
    quantity: number;
    isTaxable: boolean;
    description?: string;
    internalCosts?: {
        fletePct?: number;
        proveedor?: string;
    };
    technicalSpecs?: Record<string, string | undefined>;
}

export interface ScenarioItem {
    id?: string;
    itemId: string;
    parentId?: string | null;
    quantity: number;
    marginPctOverride?: number;
    isDilpidate?: boolean;
    item: ProposalCalcItem;
    children?: ScenarioItem[];
}

export interface Scenario {
    id: string;
    name: string;
    currency: string;
    conversionTrm?: number | null;
    description?: string;
    scenarioItems: ScenarioItem[];
}

// Re-export ScenarioTotals from pricing-engine for consumers
export type { ScenarioTotals };

// ── Hook ─────────────────────────────────────────────────────
export function useScenarios(proposalId: string | undefined) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [proposal, setProposal] = useState<any>(null);
    const [proposalItems, setProposalItems] = useState<ProposalCalcItem[]>([]);
    const [scenarios, setScenarios] = useState<Scenario[]>([]);
    const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null);
    const [trm, setTrm] = useState<{ valor: number; fechaActualizacion: string } | null>(null);
    const [extraTrm, setExtraTrm] = useState<{ setIcapAverage: number | null; wilkinsonSpot: number | null } | null>(null);

    const loadData = useCallback(async () => {
        if (!proposalId) return;
        try {
            setLoading(true);
            const [propRes, scenariosRes] = await Promise.all([
                api.get(`/proposals/${proposalId}`),
                api.get(`/proposals/${proposalId}/scenarios`),
            ]);

            setProposal(propRes.data);
            setProposalItems(propRes.data.proposalItems || []);
            setScenarios(scenariosRes.data || []);

            if (scenariosRes.data?.length > 0 && !activeScenarioId) {
                setActiveScenarioId(scenariosRes.data[0].id);
            }
        } catch (error) {
            console.error('Error loading calculations data', error);
        } finally {
            setLoading(false);
        }

        // TRM oficial
        try {
            const trmRes = await fetch('https://co.dolarapi.com/v1/trm');
            const trmData = await trmRes.json();
            setTrm({ valor: trmData.valor, fechaActualizacion: trmData.fechaActualizacion });
        } catch (error) {
            console.error('Error fetching TRM', error);
        }

        // TRM extras (SET-ICAP & Wilkinson)
        try {
            const extraRes = await api.get('/proposals/trm-extra');
            setExtraTrm(extraRes.data);
        } catch (error) {
            console.error('Error fetching extra TRM', error);
        }
    }, [proposalId, activeScenarioId]);

    useEffect(() => {
        loadData();
    }, [proposalId]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Escenarios CRUD ──────────────────────────────────────
    const createScenario = async (name: string) => {
        if (!name.trim()) return;
        setSaving(true);
        try {
            const res = await api.post(`/proposals/${proposalId}/scenarios`, {
                name,
                description: '',
            });
            setScenarios(prev => [...prev, { ...res.data, scenarioItems: [] }]);
            setActiveScenarioId(res.data.id);
            return true;
        } catch (error) {
            console.error(error);
            alert('No se pudo crear el escenario');
            return false;
        } finally {
            setSaving(false);
        }
    };

    const deleteScenario = async (sid: string) => {
        if (!confirm('¿Eliminar este escenario?')) return;
        try {
            await api.delete(`/proposals/scenarios/${sid}`);
            setScenarios(prev => prev.filter(s => s.id !== sid));
            if (activeScenarioId === sid) setActiveScenarioId(null);
        } catch (error) {
            console.error(error);
        }
    };

    // ── Items en escenario ───────────────────────────────────
    const addItemToScenario = async (itemId: string) => {
        if (!activeScenarioId) return;
        const item = proposalItems.find(i => i.id === itemId);
        if (!item) return;

        try {
            const res = await api.post(`/proposals/scenarios/${activeScenarioId}/items`, {
                itemId,
                quantity: Number(item.quantity) || 1,
                marginPct: Number(item.marginPct) || 0,
            });
            setScenarios(prev =>
                prev.map(s =>
                    s.id === activeScenarioId
                        ? { ...s, scenarioItems: [...s.scenarioItems, { ...res.data, item }] }
                        : s,
                ),
            );
        } catch (error) {
            console.error(error);
        }
    };

    const removeItemFromScenario = async (siId: string) => {
        try {
            await api.delete(`/proposals/scenarios/items/${siId}`);
            setScenarios(prev =>
                prev.map(s =>
                    s.id === activeScenarioId
                        ? { ...s, scenarioItems: s.scenarioItems.filter(si => si.id !== siId) }
                        : s,
                ),
            );
        } catch (error) {
            console.error(error);
        }
    };

    const addChildItem = async (parentScenarioItemId: string, proposalItemId: string) => {
        if (!activeScenarioId) return;
        const item = proposalItems.find(i => i.id === proposalItemId);
        if (!item) return;

        try {
            const res = await api.post(`/proposals/scenarios/${activeScenarioId}/items`, {
                itemId: proposalItemId,
                parentId: parentScenarioItemId,
                quantity: Number(item.quantity) || 1,
                marginPct: Number(item.marginPct) || 0,
            });
            const newChild: ScenarioItem = { ...res.data, item };
            setScenarios(prev =>
                prev.map(s =>
                    s.id === activeScenarioId
                        ? {
                              ...s,
                              scenarioItems: s.scenarioItems.map(si =>
                                  si.id === parentScenarioItemId
                                      ? { ...si, children: [...(si.children || []), newChild] }
                                      : si,
                              ),
                          }
                        : s,
                ),
            );
        } catch (error) {
            console.error(error);
        }
    };

    const removeChildItem = async (parentScenarioItemId: string, childId: string) => {
        try {
            await api.delete(`/proposals/scenarios/items/${childId}`);
            setScenarios(prev =>
                prev.map(s =>
                    s.id === activeScenarioId
                        ? {
                              ...s,
                              scenarioItems: s.scenarioItems.map(si =>
                                  si.id === parentScenarioItemId
                                      ? { ...si, children: (si.children || []).filter(c => c.id !== childId) }
                                      : si,
                              ),
                          }
                        : s,
                ),
            );
        } catch (error) {
            console.error(error);
        }
    };

    const updateChildQuantity = async (parentSiId: string, childId: string, qty: string) => {
        const val = parseInt(qty, 10);
        if (isNaN(val) || val < 0) return;
        try {
            await api.patch(`/proposals/scenarios/items/${childId}`, { quantity: val });
            setScenarios(prev =>
                prev.map(s =>
                    s.id === activeScenarioId
                        ? {
                              ...s,
                              scenarioItems: s.scenarioItems.map(si =>
                                  si.id === parentSiId
                                      ? {
                                            ...si,
                                            children: (si.children || []).map(c =>
                                                c.id === childId ? { ...c, quantity: val } : c,
                                            ),
                                        }
                                      : si,
                              ),
                          }
                        : s,
                ),
            );
        } catch (error) {
            console.error(error);
        }
    };

    const changeCurrency = async (currency: string) => {
        if (!activeScenarioId) return;
        try {
            await api.patch(`/proposals/scenarios/${activeScenarioId}`, { currency });
            setScenarios(prev => prev.map(s => (s.id === activeScenarioId ? { ...s, currency } : s)));
        } catch (error) {
            console.error(error);
        }
    };

    const updateConversionTrm = async (value: number) => {
        if (!activeScenarioId) return;
        try {
            await api.patch(`/proposals/scenarios/${activeScenarioId}`, { conversionTrm: value });
            setScenarios(prev =>
                prev.map(s => (s.id === activeScenarioId ? { ...s, conversionTrm: value } : s)),
            );
        } catch (error) {
            console.error('Error updating conversion TRM', error);
        }
    };

    const renameScenario = async (scenarioId: string, name: string) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        try {
            await api.patch(`/proposals/scenarios/${scenarioId}`, { name: trimmed });
            setScenarios(prev => prev.map(s => (s.id === scenarioId ? { ...s, name: trimmed } : s)));
        } catch (error) {
            console.error(error);
        }
    };

    const cloneScenario = async (scenarioId: string) => {
        try {
            setSaving(true);
            const res = await api.post(`/proposals/scenarios/${scenarioId}/clone`);
            setScenarios(prev => [...prev, res.data]);
            setActiveScenarioId(res.data.id);
        } catch (error) {
            console.error(error);
            alert('No se pudo clonar el escenario');
        } finally {
            setSaving(false);
        }
    };

    const updateMargin = async (siId: string, margin: string) => {
        const val = parseFloat(margin.replace(',', '.'));
        if (isNaN(val)) return;
        try {
            await api.patch(`/proposals/scenarios/items/${siId}`, { marginPct: val });
            setScenarios(prev =>
                prev.map(s => ({
                    ...s,
                    scenarioItems: s.scenarioItems.map(si => (si.id === siId ? { ...si, marginPctOverride: val } : si)),
                })),
            );
        } catch (error) {
            console.error(error);
        }
    };

    const updateQuantity = async (siId: string, qty: string) => {
        const val = parseInt(qty, 10);
        if (isNaN(val)) return;
        try {
            await api.patch(`/proposals/scenarios/items/${siId}`, { quantity: val });
            setScenarios(prev =>
                prev.map(s => ({
                    ...s,
                    scenarioItems: s.scenarioItems.map(si => (si.id === siId ? { ...si, quantity: val } : si)),
                })),
            );
        } catch (error) {
            console.error(error);
        }
    };

    const toggleDilpidate = async (siId: string) => {
        const scenario = scenarios.find(s => s.scenarioItems.some(si => si.id === siId));
        if (!scenario) return;
        const si = scenario.scenarioItems.find(i => i.id === siId);
        if (!si) return;
        const newVal = !si.isDilpidate;
        try {
            // When enabling dilute, force margin to 0
            const patchData: Record<string, unknown> = { isDilpidate: newVal };
            if (newVal) patchData.marginPct = 0;
            await api.patch(`/proposals/scenarios/items/${siId}`, patchData);
            setScenarios(prev =>
                prev.map(s => ({
                    ...s,
                    scenarioItems: s.scenarioItems.map(item =>
                        item.id === siId
                            ? { ...item, isDilpidate: newVal, ...(newVal ? { marginPctOverride: 0 } : {}) }
                            : item,
                    ),
                })),
            );
        } catch (error) {
            console.error(error);
        }
    };

    const updateUnitPrice = async (siId: string, price: string) => {
        const val = parseFloat(price.replace(',', '.'));
        if (isNaN(val) || val <= 0) return;

        const scenario = scenarios.find(s => s.scenarioItems.some(si => si.id === siId));
        if (!scenario) return;
        const si = scenario.scenarioItems.find(i => i.id === siId);
        if (!si) return;

        const rawCost = Number(si.item.unitCost);
        const cost = convertCost(rawCost, si.item.costCurrency || 'COP', scenario.currency || 'COP', scenario.conversionTrm);
        const flete = Number(si.item.internalCosts?.fletePct || 0);
        const parentLanded = calculateParentLandedCost(cost, flete);
        const childrenCost = calculateChildrenCostPerUnit(si.children || [], scenario.currency, scenario.conversionTrm);
        const baseLanded = calculateBaseLandedCost(parentLanded, childrenCost, si.quantity);

        // Include dilution in effective cost for accurate margin reverse-calc
        const totalDilutedCost = calculateTotalDilutedCost(scenario.scenarioItems, scenario.currency, scenario.conversionTrm);
        const totalNormalSub = calculateTotalNormalSubtotal(scenario.scenarioItems, scenario.currency, scenario.conversionTrm);
        const dilution = calculateDilutionPerUnit(cost, si.quantity, totalNormalSub, totalDilutedCost);
        const effectiveLanded = calculateEffectiveLandedCost(baseLanded, dilution);
        const newMargin = calculateMarginFromPrice(val, effectiveLanded);

        try {
            await api.patch(`/proposals/scenarios/items/${siId}`, { marginPct: newMargin });
            setScenarios(prev =>
                prev.map(s => ({
                    ...s,
                    scenarioItems: s.scenarioItems.map(i => (i.id === siId ? { ...i, marginPctOverride: newMargin } : i)),
                })),
            );
        } catch (error) {
            console.error(error);
        }
    };

    const updateGlobalMargin = async (margin: string) => {
        const val = parseFloat(margin.replace(',', '.'));
        if (isNaN(val) || !activeScenarioId) return;
        try {
            await api.patch(`/proposals/scenarios/${activeScenarioId}/apply-margin`, { marginPct: val });
            setScenarios(prev =>
                prev.map(s =>
                    s.id === activeScenarioId
                        ? { ...s, scenarioItems: s.scenarioItems.map(si => ({ ...si, marginPctOverride: val })) }
                        : s,
                ),
            );
        } catch (error) {
            console.error(error);
            alert('No se pudo aplicar el margen global.');
        }
    };

    // ── Cálculos (delegated to pricing-engine) ────────────────
    const calculateTotals = (scenario: Scenario): ScenarioTotals => {
        return calculateScenarioTotals(scenario.scenarioItems, scenario.currency, scenario.conversionTrm);
    };

    const activeScenario = scenarios.find(s => s.id === activeScenarioId) ?? null;
    const totals: ScenarioTotals = activeScenario
        ? calculateTotals(activeScenario)
        : { beforeVat: 0, nonTaxed: 0, subtotal: 0, vat: 0, total: 0, globalMarginPct: 0 };

    return {
        loading,
        saving,
        proposal,
        proposalItems,
        scenarios,
        activeScenarioId,
        setActiveScenarioId,
        activeScenario,
        totals,
        trm,
        extraTrm,
        loadData,
        createScenario,
        deleteScenario,
        addItemToScenario,
        removeItemFromScenario,
        addChildItem,
        removeChildItem,
        updateChildQuantity,
        changeCurrency,
        updateConversionTrm,
        updateMargin,
        updateQuantity,
        updateUnitPrice,
        updateGlobalMargin,
        toggleDilpidate,
        renameScenario,
        cloneScenario,
    };
}
