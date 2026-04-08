# Campo Editable de TRM de Conversión en Ventana de Cálculos

## Resumen

Se agregó un campo editable de TRM de conversión al `ScenarioHeader`, al lado del selector de moneda COP/USD, permitiendo que cada escenario tenga su propia TRM de conversión para modelar escenarios optimistas/pesimistas.

## Archivos Modificados

### [format-utils.ts](file:///d:/novotechflow/apps/web/src/lib/format-utils.ts)

Nuevas funciones para formateo de TRM con soporte de decimales (formato colombiano: punto como separador de miles, coma como decimal):
- `formatTrmValue(4250.37)` → `"4.250,37"`
- `parseTrmValue("4.250,37")` → `4250.37`

```diff:format-utils.ts
/**
 * Utility functions for formatting and parsing numeric values in inputs.
 * Uses Colombian format: dot (.) as thousands separator, no decimal separator.
 */

/**
 * Formats a number with thousands separators for display in inputs.
 * Uses Colombian standard: dot as thousands separator.
 * @example formatNumberWithThousands(1234567) → "1.234.567"
 * @example formatNumberWithThousands("1234567") → "1.234.567"
 * @example formatNumberWithThousands("") → ""
 */
export function formatNumberWithThousands(value: number | string): string {
    const cleaned = String(value).replace(/\D/g, '');
    if (!cleaned) return '';

    return cleaned.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Parses a string formatted with thousands separators back to a number.
 * Strips all non-digit characters before parsing.
 * @example parseFormattedNumber("1.234.567") → 1234567
 * @example parseFormattedNumber("") → 0
 */
export function parseFormattedNumber(formatted: string): number {
    const cleaned = formatted.replace(/\D/g, '');
    return Number(cleaned) || 0;
}
===
/**
 * Utility functions for formatting and parsing numeric values in inputs.
 * Uses Colombian format: dot (.) as thousands separator, no decimal separator.
 */

/**
 * Formats a number with thousands separators for display in inputs.
 * Uses Colombian standard: dot as thousands separator.
 * @example formatNumberWithThousands(1234567) → "1.234.567"
 * @example formatNumberWithThousands("1234567") → "1.234.567"
 * @example formatNumberWithThousands("") → ""
 */
export function formatNumberWithThousands(value: number | string): string {
    const cleaned = String(value).replace(/\D/g, '');
    if (!cleaned) return '';

    return cleaned.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Parses a string formatted with thousands separators back to a number.
 * Strips all non-digit characters before parsing.
 * @example parseFormattedNumber("1.234.567") → 1234567
 * @example parseFormattedNumber("") → 0
 */
export function parseFormattedNumber(formatted: string): number {
    const cleaned = formatted.replace(/\D/g, '');
    return Number(cleaned) || 0;
}

/**
 * Formats a TRM value with thousands separators and 2 decimal places.
 * Uses Colombian standard: dot as thousands separator, comma as decimal separator.
 * @example formatTrmValue(4250.37) → "4.250,37"
 * @example formatTrmValue("4250") → "4.250,00"
 */
export function formatTrmValue(value: number | string): string {
    const num = typeof value === 'string' ? parseFloat(value.replace(/\./g, '').replace(',', '.')) : value;
    if (isNaN(num) || num === 0) return '';

    const fixed = num.toFixed(2);
    const [intPart, decPart] = fixed.split('.');
    const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `${formattedInt},${decPart}`;
}

/**
 * Parses a Colombian-formatted TRM string back to a number.
 * Handles dot as thousands separator and comma as decimal separator.
 * @example parseTrmValue("4.250,37") → 4250.37
 * @example parseTrmValue("4250") → 4250
 */
export function parseTrmValue(formatted: string): number {
    if (!formatted.trim()) return 0;
    const normalized = formatted.replace(/\./g, '').replace(',', '.');
    return parseFloat(normalized) || 0;
}
```

---

### [useScenarios.ts](file:///d:/novotechflow/apps/web/src/hooks/useScenarios.ts)

Nueva función `updateConversionTrm(value: number)`:
- Hace `api.patch` al escenario con el nuevo `conversionTrm`
- Actualiza estado local del escenario
- Exportada en el return del hook

```diff:useScenarios.ts
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
        updateMargin,
        updateQuantity,
        updateUnitPrice,
        updateGlobalMargin,
        toggleDilpidate,
        renameScenario,
        cloneScenario,
    };
}
===
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
```

---

### [ScenarioHeader.tsx](file:///d:/novotechflow/apps/web/src/pages/proposals/components/ScenarioHeader.tsx)

Nuevo bloque de UI "TRM Conversión":
- **Input numérico** con formato colombiano (separadores de miles + 2 decimales)
- **Pre-poblado** con `conversionTrm` del escenario si existe, o con TRM del día como sugerencia
- **Botón "Hoy"** que rellena con la TRM del día
- **Deshabilitado** con tooltip cuando todos los items están en la misma moneda del escenario
- **Esquema de color amber** para diferenciarlo del margen global (emerald) y la adquisición (sky)
- **Blur-to-save**: guarda al perder foco, Escape cancela

```diff:ScenarioHeader.tsx
import { useState, useRef } from 'react';
import {
    Plus, TrendingUp, Pencil, ShoppingCart,
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import type { Scenario, ScenarioTotals } from '../../../hooks/useScenarios';
import { ACQUISITION_OPTIONS, type AcquisitionMode } from '../../../lib/constants';

interface ScenarioHeaderProps {
    activeScenario: Scenario;
    totals: ScenarioTotals;
    activeScenarioId: string | null;
    isDaasMode: boolean;
    acquisitionModes: Record<string, AcquisitionMode>;
    globalMarginBuffer: string | null;
    setGlobalMarginBuffer: (v: string | null) => void;
    updateGlobalMargin: (v: string) => void;
    handleAcquisitionChange: (mode: AcquisitionMode) => void;
    changeCurrency: (c: string) => void;
    renameScenario: (id: string, name: string) => void;
    setIsPickingItems: (v: boolean) => void;
}

export default function ScenarioHeader({
    activeScenario,
    totals,
    activeScenarioId,
    isDaasMode,
    acquisitionModes,
    globalMarginBuffer,
    setGlobalMarginBuffer,
    updateGlobalMargin,
    handleAcquisitionChange,
    changeCurrency,
    renameScenario,
    setIsPickingItems,
}: ScenarioHeaderProps) {
    const [editingScenarioName, setEditingScenarioName] = useState<string | null>(null);
    const scenarioNameInputRef = useRef<HTMLInputElement>(null);

    return (
        <div className="p-8 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center space-x-4">
                <div className="bg-indigo-600 p-3 rounded-2xl shadow-lg shadow-indigo-200">
                    <TrendingUp className="h-6 w-6 text-white" />
                </div>
                <div>
                    {editingScenarioName !== null ? (
                        <input
                            ref={scenarioNameInputRef}
                            type="text"
                            value={editingScenarioName}
                            onChange={(e) => setEditingScenarioName(e.target.value)}
                            onBlur={() => {
                                if (editingScenarioName.trim() && editingScenarioName.trim() !== activeScenario.name) {
                                    renameScenario(activeScenario.id, editingScenarioName);
                                }
                                setEditingScenarioName(null);
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    (e.target as HTMLInputElement).blur();
                                }
                                if (e.key === 'Escape') {
                                    setEditingScenarioName(null);
                                }
                            }}
                            autoFocus
                            className="text-xl font-black text-slate-900 tracking-tight bg-white border-2 border-indigo-200 rounded-xl px-3 py-1 focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none w-full max-w-md"
                        />
                    ) : (
                        <button
                            onClick={() => setEditingScenarioName(activeScenario.name)}
                            className="group/name flex items-center space-x-2 hover:bg-indigo-50 rounded-xl px-3 py-1 -mx-3 -my-1 transition-colors"
                            title="Haga clic para editar el nombre del escenario"
                        >
                            <h4 className="text-xl font-black text-slate-900 tracking-tight">{activeScenario.name}</h4>
                            <Pencil className="h-3.5 w-3.5 text-slate-300 group-hover/name:text-indigo-500 transition-colors" />
                        </button>
                    )}
                    <p className="text-sm text-slate-500 font-medium mt-0.5">Modelando {activeScenario.scenarioItems.length} ítems en este escenario.</p>
                </div>
            </div>
            <div className="flex items-center space-x-6">
                <div className="flex flex-col items-end mr-4">
                    <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-1">Margen Global</span>
                    <div className={cn(
                        "flex items-center px-4 py-2 rounded-xl border shadow-sm",
                        isDaasMode
                            ? "bg-slate-100 border-slate-200"
                            : "bg-emerald-50 border-emerald-100"
                    )}>
                        <input 
                            type="text"
                            value={globalMarginBuffer !== null ? globalMarginBuffer : totals.globalMarginPct.toFixed(2)}
                            onFocus={() => !isDaasMode && setGlobalMarginBuffer(totals.globalMarginPct.toFixed(2))}
                            onChange={(e) => !isDaasMode && setGlobalMarginBuffer(e.target.value)}
                            onBlur={(e) => {
                                if (!isDaasMode) {
                                    updateGlobalMargin(e.target.value);
                                    setGlobalMarginBuffer(null);
                                }
                            }}
                            disabled={isDaasMode}
                            className={cn(
                                "w-16 bg-transparent border-none text-right font-black p-0 focus:ring-0 text-sm",
                                isDaasMode
                                    ? "text-slate-400 cursor-not-allowed"
                                    : "text-emerald-700"
                            )}
                        />
                        <span className={cn(
                            "ml-1 text-xs font-black",
                            isDaasMode ? "text-slate-400" : "text-emerald-600"
                        )}>%</span>
                    </div>
                </div>

                {/* Acquisition Mode Selector */}
                <div className="flex flex-col items-end mr-4">
                    <span className="text-[9px] font-black text-sky-600 uppercase tracking-widest mb-1">Adquisición</span>
                    <div className="flex items-center bg-sky-50 px-3 py-2 rounded-xl border border-sky-100 shadow-sm">
                        <ShoppingCart className="h-3.5 w-3.5 text-sky-400 mr-2" />
                        <select
                            value={acquisitionModes[activeScenarioId!] || 'VENTA'}
                            onChange={(e) => handleAcquisitionChange(e.target.value as AcquisitionMode)}
                            className={cn(
                                "bg-transparent border-none font-black text-xs focus:ring-0 cursor-pointer pr-6",
                                isDaasMode ? "text-pink-600" : "text-sky-700"
                            )}
                        >
                            {ACQUISITION_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                    <button 
                        onClick={() => changeCurrency('COP')}
                        className={cn(
                            "px-4 py-2 rounded-lg text-[10px] font-black transition-all",
                            activeScenario.currency === 'COP' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                        )}
                    >
                        COP
                    </button>
                    <button 
                        onClick={() => changeCurrency('USD')}
                        className={cn(
                            "px-4 py-2 rounded-lg text-[10px] font-black transition-all",
                            activeScenario.currency === 'USD' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                        )}
                    >
                        USD
                    </button>
                </div>

                <button 
                    onClick={() => setIsPickingItems(true)}
                    className="flex items-center space-x-3 bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-2xl shadow-xl shadow-indigo-100 transition-all font-black text-[11px] uppercase tracking-widest"
                >
                    <Plus className="h-4 w-4" />
                    <span>Pick de Items</span>
                </button>
            </div>
        </div>
    );
}
===
import { useState, useRef, useMemo } from 'react';
import {
    Plus, TrendingUp, Pencil, ShoppingCart, RefreshCw,
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import type { Scenario, ScenarioTotals } from '../../../hooks/useScenarios';
import { ACQUISITION_OPTIONS, type AcquisitionMode } from '../../../lib/constants';
import { formatTrmValue, parseTrmValue } from '../../../lib/format-utils';

interface TrmData {
    valor: number;
    fechaActualizacion: string;
}

interface ScenarioHeaderProps {
    activeScenario: Scenario;
    totals: ScenarioTotals;
    activeScenarioId: string | null;
    isDaasMode: boolean;
    acquisitionModes: Record<string, AcquisitionMode>;
    globalMarginBuffer: string | null;
    setGlobalMarginBuffer: (v: string | null) => void;
    updateGlobalMargin: (v: string) => void;
    handleAcquisitionChange: (mode: AcquisitionMode) => void;
    changeCurrency: (c: string) => void;
    renameScenario: (id: string, name: string) => void;
    setIsPickingItems: (v: boolean) => void;
    updateConversionTrm: (value: number) => Promise<void>;
    trm: TrmData | null;
    conversionTrm: number | null;
}

export default function ScenarioHeader({
    activeScenario,
    totals,
    activeScenarioId,
    isDaasMode,
    acquisitionModes,
    globalMarginBuffer,
    setGlobalMarginBuffer,
    updateGlobalMargin,
    handleAcquisitionChange,
    changeCurrency,
    renameScenario,
    setIsPickingItems,
    updateConversionTrm,
    trm,
    conversionTrm,
}: ScenarioHeaderProps) {
    const [editingScenarioName, setEditingScenarioName] = useState<string | null>(null);
    const scenarioNameInputRef = useRef<HTMLInputElement>(null);
    const [trmBuffer, setTrmBuffer] = useState<string | null>(null);

    /** Whether all items in the scenario share the same currency as the scenario */
    const isConversionUnnecessary = useMemo(() => {
        const scenarioCurrency = activeScenario.currency || 'COP';
        const items = activeScenario.scenarioItems;
        if (items.length === 0) return false;
        return items.every(si => (si.item.costCurrency || 'COP') === scenarioCurrency);
    }, [activeScenario.currency, activeScenario.scenarioItems]);

    const effectiveTrm = conversionTrm ?? trm?.valor ?? null;

    const handleTrmBlur = () => {
        if (trmBuffer === null) return;
        const parsed = parseTrmValue(trmBuffer);
        if (parsed > 0) {
            updateConversionTrm(parsed);
        }
        setTrmBuffer(null);
    };

    const handleFillTodayTrm = () => {
        if (!trm) return;
        updateConversionTrm(trm.valor);
        setTrmBuffer(null);
    };

    const displayTrmValue = (): string => {
        if (trmBuffer !== null) return trmBuffer;
        if (effectiveTrm !== null) return formatTrmValue(effectiveTrm);
        return '';
    };

    return (
        <div className="p-8 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center space-x-4">
                <div className="bg-indigo-600 p-3 rounded-2xl shadow-lg shadow-indigo-200">
                    <TrendingUp className="h-6 w-6 text-white" />
                </div>
                <div>
                    {editingScenarioName !== null ? (
                        <input
                            ref={scenarioNameInputRef}
                            type="text"
                            value={editingScenarioName}
                            onChange={(e) => setEditingScenarioName(e.target.value)}
                            onBlur={() => {
                                if (editingScenarioName.trim() && editingScenarioName.trim() !== activeScenario.name) {
                                    renameScenario(activeScenario.id, editingScenarioName);
                                }
                                setEditingScenarioName(null);
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    (e.target as HTMLInputElement).blur();
                                }
                                if (e.key === 'Escape') {
                                    setEditingScenarioName(null);
                                }
                            }}
                            autoFocus
                            className="text-xl font-black text-slate-900 tracking-tight bg-white border-2 border-indigo-200 rounded-xl px-3 py-1 focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none w-full max-w-md"
                        />
                    ) : (
                        <button
                            onClick={() => setEditingScenarioName(activeScenario.name)}
                            className="group/name flex items-center space-x-2 hover:bg-indigo-50 rounded-xl px-3 py-1 -mx-3 -my-1 transition-colors"
                            title="Haga clic para editar el nombre del escenario"
                        >
                            <h4 className="text-xl font-black text-slate-900 tracking-tight">{activeScenario.name}</h4>
                            <Pencil className="h-3.5 w-3.5 text-slate-300 group-hover/name:text-indigo-500 transition-colors" />
                        </button>
                    )}
                    <p className="text-sm text-slate-500 font-medium mt-0.5">Modelando {activeScenario.scenarioItems.length} ítems en este escenario.</p>
                </div>
            </div>
            <div className="flex items-center space-x-6">
                <div className="flex flex-col items-end mr-4">
                    <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-1">Margen Global</span>
                    <div className={cn(
                        "flex items-center px-4 py-2 rounded-xl border shadow-sm",
                        isDaasMode
                            ? "bg-slate-100 border-slate-200"
                            : "bg-emerald-50 border-emerald-100"
                    )}>
                        <input 
                            type="text"
                            value={globalMarginBuffer !== null ? globalMarginBuffer : totals.globalMarginPct.toFixed(2)}
                            onFocus={() => !isDaasMode && setGlobalMarginBuffer(totals.globalMarginPct.toFixed(2))}
                            onChange={(e) => !isDaasMode && setGlobalMarginBuffer(e.target.value)}
                            onBlur={(e) => {
                                if (!isDaasMode) {
                                    updateGlobalMargin(e.target.value);
                                    setGlobalMarginBuffer(null);
                                }
                            }}
                            disabled={isDaasMode}
                            className={cn(
                                "w-16 bg-transparent border-none text-right font-black p-0 focus:ring-0 text-sm",
                                isDaasMode
                                    ? "text-slate-400 cursor-not-allowed"
                                    : "text-emerald-700"
                            )}
                        />
                        <span className={cn(
                            "ml-1 text-xs font-black",
                            isDaasMode ? "text-slate-400" : "text-emerald-600"
                        )}>%</span>
                    </div>
                </div>

                {/* Acquisition Mode Selector */}
                <div className="flex flex-col items-end mr-4">
                    <span className="text-[9px] font-black text-sky-600 uppercase tracking-widest mb-1">Adquisición</span>
                    <div className="flex items-center bg-sky-50 px-3 py-2 rounded-xl border border-sky-100 shadow-sm">
                        <ShoppingCart className="h-3.5 w-3.5 text-sky-400 mr-2" />
                        <select
                            value={acquisitionModes[activeScenarioId!] || 'VENTA'}
                            onChange={(e) => handleAcquisitionChange(e.target.value as AcquisitionMode)}
                            className={cn(
                                "bg-transparent border-none font-black text-xs focus:ring-0 cursor-pointer pr-6",
                                isDaasMode ? "text-pink-600" : "text-sky-700"
                            )}
                        >
                            {ACQUISITION_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                    <button 
                        onClick={() => changeCurrency('COP')}
                        className={cn(
                            "px-4 py-2 rounded-lg text-[10px] font-black transition-all",
                            activeScenario.currency === 'COP' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                        )}
                    >
                        COP
                    </button>
                    <button 
                        onClick={() => changeCurrency('USD')}
                        className={cn(
                            "px-4 py-2 rounded-lg text-[10px] font-black transition-all",
                            activeScenario.currency === 'USD' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                        )}
                    >
                        USD
                    </button>
                </div>

                {/* TRM Conversion Input */}
                <div className="flex flex-col items-end" title={isConversionUnnecessary ? 'Todos los items están en la misma moneda — no se requiere conversión' : undefined}>
                    <span className={cn(
                        "text-[9px] font-black uppercase tracking-widest mb-1",
                        isConversionUnnecessary ? "text-slate-400" : "text-amber-600"
                    )}>TRM Conversión</span>
                    <div className={cn(
                        "flex items-center px-4 py-2 rounded-xl border shadow-sm",
                        isConversionUnnecessary
                            ? "bg-slate-100 border-slate-200"
                            : "bg-amber-50 border-amber-100"
                    )}>
                        <span className={cn(
                            "text-xs font-black mr-1",
                            isConversionUnnecessary ? "text-slate-400" : "text-amber-500"
                        )}>$</span>
                        <input
                            type="text"
                            value={displayTrmValue()}
                            placeholder={trm ? formatTrmValue(trm.valor) : '—'}
                            onFocus={() => {
                                if (isConversionUnnecessary) return;
                                const current = effectiveTrm ?? trm?.valor ?? 0;
                                setTrmBuffer(current > 0 ? formatTrmValue(current) : '');
                            }}
                            onChange={(e) => {
                                if (isConversionUnnecessary) return;
                                setTrmBuffer(e.target.value);
                            }}
                            onBlur={handleTrmBlur}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    (e.target as HTMLInputElement).blur();
                                }
                                if (e.key === 'Escape') {
                                    setTrmBuffer(null);
                                }
                            }}
                            disabled={isConversionUnnecessary}
                            className={cn(
                                "w-24 bg-transparent border-none text-right font-black p-0 focus:ring-0 text-sm",
                                isConversionUnnecessary
                                    ? "text-slate-400 cursor-not-allowed"
                                    : "text-amber-700"
                            )}
                        />
                        {!isConversionUnnecessary && trm && (
                            <button
                                onClick={handleFillTodayTrm}
                                className="ml-2 flex items-center space-x-1 px-2 py-1 text-[9px] font-black text-amber-600 bg-white hover:bg-amber-100 rounded-lg border border-amber-200 transition-colors whitespace-nowrap"
                                title={`Usar TRM del día: $${trm.valor.toLocaleString('es-CO', { minimumFractionDigits: 2 })}`}
                            >
                                <RefreshCw className="h-3 w-3" />
                                <span>Hoy</span>
                            </button>
                        )}
                    </div>
                </div>

                <button 
                    onClick={() => setIsPickingItems(true)}
                    className="flex items-center space-x-3 bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-2xl shadow-xl shadow-indigo-100 transition-all font-black text-[11px] uppercase tracking-widest"
                >
                    <Plus className="h-4 w-4" />
                    <span>Pick de Items</span>
                </button>
            </div>
        </div>
    );
}

```

---

### [ProposalCalculations.tsx](file:///d:/novotechflow/apps/web/src/pages/proposals/ProposalCalculations.tsx)

- Destructura `updateConversionTrm` del hook
- Pasa `updateConversionTrm`, `trm`, y `conversionTrm` como props a `ScenarioHeader`

```diff:ProposalCalculations.tsx
import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Calculator, Loader2, Package,
    ArrowLeft, RotateCcw, Layers, BookOpen, FileSpreadsheet
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

export default function ProposalCalculations() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const {
        loading, saving, proposal, proposalItems, scenarios,
        activeScenarioId, setActiveScenarioId, activeScenario, totals,
        trm, extraTrm, loadData,
        createScenario, deleteScenario,
        addItemToScenario, removeItemFromScenario,
        addChildItem, removeChildItem, updateChildQuantity,
        changeCurrency, updateMargin, updateQuantity,
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
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <button 
                        onClick={() => navigate(`/proposals/${id}/builder`)}
                        className="p-3 bg-white border border-slate-100 rounded-2xl shadow-sm text-slate-400 hover:text-indigo-600 transition-colors"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </button>
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

            {/* Navigation to Document Builder + Export */}
            <div className="flex justify-end space-x-3">
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
                <button 
                    onClick={() => navigate(`/proposals/${id}/document`)}
                    className="flex items-center space-x-3 px-6 py-3 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all font-black text-[10px] uppercase tracking-widest"
                >
                    <BookOpen className="h-4 w-4" />
                    <span>Construir Documento</span>
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
        </div>
    );
}
===
import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Calculator, Loader2, Package,
    ArrowLeft, RotateCcw, Layers, BookOpen, FileSpreadsheet
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

export default function ProposalCalculations() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

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
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <button 
                        onClick={() => navigate(`/proposals/${id}/builder`)}
                        className="p-3 bg-white border border-slate-100 rounded-2xl shadow-sm text-slate-400 hover:text-indigo-600 transition-colors"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </button>
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

            {/* Navigation to Document Builder + Export */}
            <div className="flex justify-end space-x-3">
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
                <button 
                    onClick={() => navigate(`/proposals/${id}/document`)}
                    className="flex items-center space-x-3 px-6 py-3 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all font-black text-[10px] uppercase tracking-widest"
                >
                    <BookOpen className="h-4 w-4" />
                    <span>Construir Documento</span>
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
        </div>
    );
}
```

## Comportamiento

1. El comercial abre la ventana de cálculos
2. Ve el campo TRM con la TRM del día como sugerencia
3. Puede cambiarlo a una TRM proyectada (ej: 4.500 para escenario pesimista)
4. Al cambiar, los precios de items en moneda diferente se recalculan automáticamente (porque el pricing-engine ya consume `conversionTrm`)
5. Puede crear Escenario 1 con TRM 4.200 y Escenario 2 con TRM 4.500 para comparar
6. El valor se persiste en BD — al reabrir la propuesta estará ahí

## Verificación

> [!NOTE]
> No se pudo ejecutar `tsc --noEmit` por problemas de sandbox. Verificación manual recomendada.
