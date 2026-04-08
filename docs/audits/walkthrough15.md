# Dashboard Corrections: Legacy Filter Removal + Thousands Formatting

## Changes Made

### 1. Removed Legacy Subtotal Min/Max Filter

The old "Subtotal mín." / "Subtotal máx." filter in the status filters panel was redundant — the advanced "Rango USD Est." filter in `DashboardFilters.tsx` already provides equivalent (and superior, USD-converted) filtering.

**Removed from:**

#### [useDashboard.ts](file:///d:/novotechflow/apps/web/src/hooks/useDashboard.ts)
- `subtotalMin`/`subtotalMax` state declarations
- Legacy filter logic in the `filtered` useMemo (lines that compared `row.minSubtotal` against `parseFloat(subtotalMin/subtotalMax)`)
- References in `clearFilters()`, `hasActiveFilters`, dependency array, and return object

```diff:useDashboard.ts
import { useState, useEffect, useMemo } from 'react';
import { api } from '../lib/api';
import { TRM_API_URL } from '../lib/constants';
import { calculateScenarioTotals } from '../lib/pricing-engine';
import { getTrmMonthlyAverage } from '../lib/trm-service';
import type { ProposalSummary, ProposalStatus, BillingProjection, AcquisitionType, ItemType } from '../lib/types';
import type { DateRange } from '../pages/dashboard/DashboardFilters';

// ── Types ────────────────────────────────────────────────────

type CurrencyCode = 'COP' | 'USD';

interface MinSubtotalResult {
    subtotal: number | null;
    currency: CurrencyCode | null;
}

type ProposalWithSubtotal = ProposalSummary & MinSubtotalResult;

export interface DashboardRow {
    id: string;
    code: string;
    clientName: string;
    subject: string;
    minSubtotal: number | null;
    minSubtotalCurrency: CurrencyCode | null;
    status: ProposalStatus;
    closeDate?: string | null;
    billingDate?: string | null;
    acquisitionType?: AcquisitionType | null;
    updatedAt: string;
    user?: { name: string; nomenclature: string };
    isProjection: boolean;
    originalProposal?: ProposalWithSubtotal;
    originalProjection?: BillingProjection;
}

export interface BillingCards {
    facturadoMesAnterior: number;
    facturadoMesActual: number;
    facturadoTrimestreActual: number;
    proyeccionTrimestreSiguiente: number;
    pendFactMesActual: number;
    pendFactMesSiguiente: number;
}

// ── Pure helpers ─────────────────────────────────────────────

/** Find the scenario with the minimum subtotal and return its value + currency. */
function computeMinSubtotal(proposal: ProposalSummary): MinSubtotalResult {
    if (!proposal.scenarios || proposal.scenarios.length === 0) {
        return { subtotal: null, currency: null };
    }

    let minSubtotal: number | null = null;
    let minCurrency: CurrencyCode | null = null;

    for (const scenario of proposal.scenarios) {
        const totals = calculateScenarioTotals(scenario.scenarioItems);
        const sub = totals.subtotal;

        if (minSubtotal === null || sub < minSubtotal) {
            minSubtotal = sub;
            minCurrency = (scenario.currency === 'USD' ? 'USD' : 'COP') as CurrencyCode;
        }
    }

    return { subtotal: minSubtotal, currency: minCurrency };
}

/**
 * Convert a subtotal to USD.
 * - If already in USD → return as-is.
 * - If COP and trmRate > 0 → divide.
 * - Otherwise → null.
 */
export function getSubtotalUsd(
    subtotal: number | null,
    currency: CurrencyCode | null,
    trmRate: number | null,
): number | null {
    if (subtotal === null || currency === null) return null;
    if (currency === 'USD') return subtotal;
    if (currency === 'COP' && trmRate && trmRate > 0) return subtotal / trmRate;
    return null;
}

/** Parse ISO date → { month (0-indexed), year } without timezone shift. */
function parseDate(dateStr: string): { month: number; year: number } {
    const [datePart] = dateStr.split('T');
    const [y, m] = datePart.split('-').map(Number);
    return { month: m - 1, year: y };
}

/** Compute billing cards for a single acquisition type. All subtotals converted to USD. */
function computeBillingCards(
    proposals: ProposalWithSubtotal[],
    projections: BillingProjection[],
    acquisitionFilter: AcquisitionType,
    trmRate: number | null,
): BillingCards {
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();
    const prevMonth = thisMonth === 0 ? 11 : thisMonth - 1;
    const prevMonthYear = thisMonth === 0 ? thisYear - 1 : thisYear;
    const currentQuarter = Math.floor(thisMonth / 3);
    const nextQuarter = (currentQuarter + 1) % 4;
    const nextQuarterYear = nextQuarter === 0 ? thisYear + 1 : thisYear;
    const nextMonth = thisMonth === 11 ? 0 : thisMonth + 1;
    const nextMonthYear = thisMonth === 11 ? thisYear + 1 : thisYear;

    let facturadoMesAnterior = 0;
    let facturadoMesActual = 0;
    let facturadoTrimestreActual = 0;
    let proyeccionTrimestreSiguiente = 0;
    let pendFactMesActual = 0;
    let pendFactMesSiguiente = 0;

    const filteredProposals = proposals.filter(p => p.acquisitionType === acquisitionFilter);
    const filteredProjections = projections.filter(pr => pr.acquisitionType === acquisitionFilter);

    for (const p of filteredProposals) {
        const sub = getSubtotalUsd(p.subtotal, p.currency, trmRate) ?? 0;

        if (p.status === 'FACTURADA' && p.billingDate) {
            const { month, year } = parseDate(p.billingDate);
            if (month === prevMonth && year === prevMonthYear) facturadoMesAnterior += sub;
            if (month === thisMonth && year === thisYear) facturadoMesActual += sub;
            if (Math.floor(month / 3) === currentQuarter && year === thisYear) facturadoTrimestreActual += sub;
        }

        if (p.status === 'PENDIENTE_FACTURAR' && p.billingDate) {
            const { month, year } = parseDate(p.billingDate);
            if (Math.floor(month / 3) === currentQuarter && year === thisYear) facturadoTrimestreActual += sub;
            if (Math.floor(month / 3) === nextQuarter && year === nextQuarterYear) proyeccionTrimestreSiguiente += sub;
            if (month === thisMonth && year === thisYear) pendFactMesActual += sub;
            if (month === nextMonth && year === nextMonthYear) pendFactMesSiguiente += sub;
        }

        if (p.status === 'GANADA' && p.closeDate) {
            const { month, year } = parseDate(p.closeDate);
            if (Math.floor(month / 3) === nextQuarter && year === nextQuarterYear) proyeccionTrimestreSiguiente += sub;
        }
    }

    // Projections: use stored currency for conversion
    for (const pr of filteredProjections) {
        const rawSub = Number(pr.subtotal) || 0;
        const prCurrency: CurrencyCode = pr.currency === 'USD' ? 'USD' : 'COP';
        const sub = getSubtotalUsd(rawSub, prCurrency, trmRate) ?? 0;

        if (pr.status === 'FACTURADA' && pr.billingDate) {
            const { month, year } = parseDate(pr.billingDate);
            if (month === prevMonth && year === prevMonthYear) facturadoMesAnterior += sub;
            if (month === thisMonth && year === thisYear) facturadoMesActual += sub;
            if (Math.floor(month / 3) === currentQuarter && year === thisYear) facturadoTrimestreActual += sub;
        }

        if (pr.status === 'PENDIENTE_FACTURAR' && pr.billingDate) {
            const { month, year } = parseDate(pr.billingDate);
            if (Math.floor(month / 3) === currentQuarter && year === thisYear) facturadoTrimestreActual += sub;
            if (Math.floor(month / 3) === nextQuarter && year === nextQuarterYear) proyeccionTrimestreSiguiente += sub;
            if (month === thisMonth && year === thisYear) pendFactMesActual += sub;
            if (month === nextMonth && year === nextMonthYear) pendFactMesSiguiente += sub;
        }
    }

    return { facturadoMesAnterior, facturadoMesActual, facturadoTrimestreActual, proyeccionTrimestreSiguiente, pendFactMesActual, pendFactMesSiguiente };
}

// ── Hook ─────────────────────────────────────────────────────

export function useDashboard() {
    const [proposals, setProposals] = useState<ProposalSummary[]>([]);
    const [projections, setProjections] = useState<BillingProjection[]>([]);
    const [loading, setLoading] = useState(true);

    // TRM (frontend-only, editable)
    const [trmRate, setTrmRate] = useState<number | null>(null);

    // TRM historical averages
    const [trmCurrentMonthAvg, setTrmCurrentMonthAvg] = useState<number | null>(null);
    const [trmPreviousMonthAvg, setTrmPreviousMonthAvg] = useState<number | null>(null);
    const [isLoadingTrmAverages, setIsLoadingTrmAverages] = useState(true);

    // Filter state
    const [showFilters, setShowFilters] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilters, setStatusFilters] = useState<Set<ProposalStatus>>(new Set());
    const [subtotalMin, setSubtotalMin] = useState('');
    const [subtotalMax, setSubtotalMax] = useState('');

    // Advanced filter state
    const [closeDateRange, setCloseDateRange] = useState<DateRange>({ from: '', to: '' });
    const [billingDateRange, setBillingDateRange] = useState<DateRange>({ from: '', to: '' });
    const [categoryFilter, setCategoryFilter] = useState<Set<ItemType>>(new Set());
    const [manufacturerFilter, setManufacturerFilter] = useState('');
    const [subtotalUsdMin, setSubtotalUsdMin] = useState('');
    const [subtotalUsdMax, setSubtotalUsdMax] = useState('');
    const [acquisitionFilter, setAcquisitionFilter] = useState<AcquisitionType | 'ALL'>('ALL');

    // Clone action state
    const [cloning, setCloning] = useState<string | null>(null);

    useEffect(() => {
        loadData();
        fetchTrm();
        fetchTrmAverages();
    }, []);

    const loadData = async () => {
        try {
            const [proposalsRes, projectionsRes] = await Promise.all([
                api.get('/proposals'),
                api.get('/billing-projections'),
            ]);
            setProposals(proposalsRes.data);
            setProjections(projectionsRes.data);
        } catch (error) {
            console.error("Error cargando datos:", error);
        } finally {
            setLoading(false);
        }
    };

    /** Fetch TRM once on mount as suggested default value. */
    const fetchTrm = async () => {
        try {
            const res = await fetch(TRM_API_URL);
            const data = await res.json();
            setTrmRate(data.valor ?? null);
        } catch (error) {
            console.error('Error fetching TRM:', error);
        }
    };

    /** Fetch current and previous month TRM averages in parallel. */
    const fetchTrmAverages = async () => {
        setIsLoadingTrmAverages(true);

        const now = new Date();
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();
        const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
        const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;

        try {
            const [currentAvg, previousAvg] = await Promise.all([
                getTrmMonthlyAverage(currentYear, currentMonth),
                getTrmMonthlyAverage(prevYear, prevMonth),
            ]);

            setTrmCurrentMonthAvg(currentAvg);
            setTrmPreviousMonthAvg(previousAvg);
        } catch (error) {
            console.error('Error fetching TRM averages:', error);
        } finally {
            setIsLoadingTrmAverages(false);
        }
    };

    const loadProposals = async () => {
        try {
            const res = await api.get('/proposals');
            setProposals(res.data);
        } catch (error) {
            console.error("Error cargando propuestas:", error);
        }
    };

    // ── Computed values ──
    const proposalsWithSubtotals = useMemo(() => {
        return proposals.map(p => {
            const { subtotal, currency } = computeMinSubtotal(p);
            return { ...p, subtotal, currency };
        });
    }, [proposals]);

    // ── Unified rows (proposals + projections) ──
    const allRows: DashboardRow[] = useMemo(() => {
        const proposalRows: DashboardRow[] = proposalsWithSubtotals.map(p => ({
            id: p.id,
            code: p.proposalCode,
            clientName: p.clientName,
            subject: p.subject,
            minSubtotal: p.subtotal,
            minSubtotalCurrency: p.currency,
            status: p.status,
            closeDate: p.closeDate,
            billingDate: p.billingDate,
            acquisitionType: p.acquisitionType,
            updatedAt: p.updatedAt,
            user: p.user,
            isProjection: false,
            originalProposal: p,
        }));

        const projectionRows: DashboardRow[] = projections.map(pr => ({
            id: pr.id,
            code: pr.projectionCode,
            clientName: pr.clientName,
            subject: '',
            minSubtotal: Number(pr.subtotal),
            minSubtotalCurrency: (pr.currency === 'USD' ? 'USD' : 'COP') as CurrencyCode,
            status: pr.status as ProposalStatus,
            closeDate: null,
            billingDate: pr.billingDate,
            acquisitionType: pr.acquisitionType,
            updatedAt: pr.updatedAt,
            user: pr.user,
            isProjection: true,
            originalProjection: pr,
        }));

        return [...proposalRows, ...projectionRows];
    }, [proposalsWithSubtotals, projections]);

    /** Unique fabricante/responsable values from all proposals for autocomplete. */
    const manufacturerSuggestions = useMemo(() => {
        const values = new Set<string>();
        for (const p of proposals) {
            const scenarioItems = p.scenarios?.flatMap(s => s.scenarioItems) ?? [];
            for (const si of scenarioItems) {
                const specs = si.item.technicalSpecs;
                if (specs?.fabricante) values.add(specs.fabricante);
                if (specs?.responsable) values.add(specs.responsable);
            }
        }
        return Array.from(values).sort();
    }, [proposals]);

    const filtered = useMemo(() => {
        return allRows.filter(row => {
            // Search term
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                const isMatch = row.code?.toLowerCase().includes(term) ||
                    row.clientName.toLowerCase().includes(term) ||
                    row.subject.toLowerCase().includes(term);
                if (!isMatch) return false;
            }

            // Status
            if (statusFilters.size > 0 && !statusFilters.has(row.status)) return false;

            // Original subtotal range (legacy)
            if (subtotalMin && row.minSubtotal !== null && row.minSubtotal < parseFloat(subtotalMin)) return false;
            if (subtotalMax && row.minSubtotal !== null && row.minSubtotal > parseFloat(subtotalMax)) return false;

            // Close date range
            if (closeDateRange.from || closeDateRange.to) {
                const raw = row.closeDate;
                if (!raw) return false;
                const dateStr = raw.split('T')[0];
                if (closeDateRange.from && dateStr < closeDateRange.from) return false;
                if (closeDateRange.to && dateStr > closeDateRange.to) return false;
            }

            // Billing date range
            if (billingDateRange.from || billingDateRange.to) {
                const raw = row.billingDate;
                if (!raw) return false;
                const dateStr = raw.split('T')[0];
                if (billingDateRange.from && dateStr < billingDateRange.from) return false;
                if (billingDateRange.to && dateStr > billingDateRange.to) return false;
            }

            // Category filter
            if (categoryFilter.size > 0) {
                const itemTypes = row.originalProposal?.scenarios
                    ?.flatMap(s => s.scenarioItems)
                    ?.map(si => si.item.itemType as ItemType) ?? [];
                const hasMatch = itemTypes.some(t => categoryFilter.has(t));
                if (!hasMatch) return false;
            }

            // Manufacturer / Responsable
            if (manufacturerFilter) {
                const term = manufacturerFilter.toLowerCase();
                const items = row.originalProposal?.scenarios
                    ?.flatMap(s => s.scenarioItems)
                    ?.map(si => si.item) ?? [];
                const hasMatch = items.some(item => {
                    const specs = item.technicalSpecs;
                    return specs?.fabricante?.toLowerCase().includes(term) ||
                        specs?.responsable?.toLowerCase().includes(term);
                });
                if (!hasMatch) return false;
            }

            // USD Subtotal range
            if (subtotalUsdMin || subtotalUsdMax) {
                const usd = getSubtotalUsd(row.minSubtotal, row.minSubtotalCurrency, trmRate);
                if (usd === null) return false;
                if (subtotalUsdMin && usd < parseFloat(subtotalUsdMin)) return false;
                if (subtotalUsdMax && usd > parseFloat(subtotalUsdMax)) return false;
            }

            // Acquisition type
            if (acquisitionFilter !== 'ALL' && row.acquisitionType !== acquisitionFilter) return false;

            return true;
        });
    }, [
        allRows, searchTerm, statusFilters, subtotalMin, subtotalMax,
        closeDateRange, billingDateRange, categoryFilter, manufacturerFilter,
        subtotalUsdMin, subtotalUsdMax, acquisitionFilter, trmRate,
    ]);

    // ── Billing summary cards per acquisition type (values in USD) ──
    const billingCardsVenta: BillingCards = useMemo(
        () => computeBillingCards(proposalsWithSubtotals, projections, 'VENTA', trmRate),
        [proposalsWithSubtotals, projections, trmRate],
    );

    const billingCardsDaas: BillingCards = useMemo(
        () => computeBillingCards(proposalsWithSubtotals, projections, 'DAAS', trmRate),
        [proposalsWithSubtotals, projections, trmRate],
    );

    // ── Actions ──
    const handleStatusChange = async (id: string, newStatus: ProposalStatus) => {
        try {
            await api.patch(`/proposals/${id}`, { status: newStatus });
            setProposals(prev => prev.map(p => p.id === id ? { ...p, status: newStatus } : p));
        } catch (error) {
            console.error(error);
        }
    };

    const handleDateChange = async (id: string, field: 'closeDate' | 'billingDate', value: string) => {
        try {
            await api.patch(`/proposals/${id}`, { [field]: value || null });
            setProposals(prev => prev.map(p => p.id === id ? { ...p, [field]: value || null } : p));
        } catch (error) {
            console.error(error);
        }
    };

    const handleClone = async (id: string, cloneType: 'NEW_VERSION' | 'NEW_PROPOSAL') => {
        setCloning(id);
        try {
            await api.post(`/proposals/${id}/clone`, { cloneType });
            await loadProposals();
        } catch (error) {
            console.error(error);
            alert('No se pudo clonar la propuesta.');
        } finally {
            setCloning(null);
        }
    };

    const handleDelete = async (id: string, code: string) => {
        if (!window.confirm(`⚠️ ¿Estás seguro de que deseas eliminar permanentemente la propuesta ${code}?\n\nEsta acción no se puede deshacer. Se eliminarán todos los ítems, escenarios y datos asociados.`)) return;

        try {
            await api.delete(`/proposals/${id}`);
            setProposals(proposals.filter(p => p.id !== id));
        } catch (error) {
            console.error(error);
            alert("No se pudo eliminar la propuesta.");
        }
    };

    const handleAcquisitionChange = async (id: string, value: AcquisitionType) => {
        try {
            await api.patch(`/proposals/${id}`, { acquisitionType: value });
            setProposals(prev => prev.map(p => p.id === id ? { ...p, acquisitionType: value } : p));
        } catch (error) {
            console.error(error);
        }
    };

    const handleProjectionAcquisitionChange = async (id: string, value: AcquisitionType) => {
        try {
            await api.patch(`/billing-projections/${id}`, { acquisitionType: value });
            setProjections(prev => prev.map(pr => pr.id === id ? { ...pr, acquisitionType: value } : pr));
        } catch (error) {
            console.error(error);
        }
    };

    const handleProjectionStatusChange = async (id: string, newStatus: ProposalStatus) => {
        try {
            await api.patch(`/billing-projections/${id}`, { status: newStatus });
            setProjections(prev => prev.map(pr => pr.id === id ? { ...pr, status: newStatus as 'PENDIENTE_FACTURAR' | 'FACTURADA' } : pr));
        } catch (error) {
            console.error(error);
        }
    };

    const handleProjectionDateChange = async (id: string, value: string) => {
        try {
            await api.patch(`/billing-projections/${id}`, { billingDate: value || null });
            setProjections(prev => prev.map(pr => pr.id === id ? { ...pr, billingDate: value || null } : pr));
        } catch (error) {
            console.error(error);
        }
    };

    const toggleStatusFilter = (status: ProposalStatus) => {
        setStatusFilters(prev => {
            const next = new Set(prev);
            if (next.has(status)) next.delete(status);
            else next.add(status);
            return next;
        });
    };

    const clearFilters = () => {
        setSearchTerm('');
        setStatusFilters(new Set());
        setSubtotalMin('');
        setSubtotalMax('');
        setCloseDateRange({ from: '', to: '' });
        setBillingDateRange({ from: '', to: '' });
        setCategoryFilter(new Set());
        setManufacturerFilter('');
        setSubtotalUsdMin('');
        setSubtotalUsdMax('');
        setAcquisitionFilter('ALL');
    };

    const hasActiveFilters = searchTerm || statusFilters.size > 0 || subtotalMin || subtotalMax
        || closeDateRange.from || closeDateRange.to
        || billingDateRange.from || billingDateRange.to
        || categoryFilter.size > 0 || manufacturerFilter
        || subtotalUsdMin || subtotalUsdMax || acquisitionFilter !== 'ALL';

    return {
        // State
        loading,
        filtered,
        billingCardsVenta,
        billingCardsDaas,
        cloning,
        setProjections,
        trmRate,
        setTrmRate,
        trmCurrentMonthAvg,
        trmPreviousMonthAvg,
        isLoadingTrmAverages,

        // Filter state
        showFilters,
        setShowFilters,
        searchTerm,
        setSearchTerm,
        statusFilters,
        subtotalMin,
        setSubtotalMin,
        subtotalMax,
        setSubtotalMax,
        hasActiveFilters,

        // Advanced filter state
        closeDateRange,
        setCloseDateRange,
        billingDateRange,
        setBillingDateRange,
        categoryFilter,
        setCategoryFilter,
        manufacturerFilter,
        setManufacturerFilter,
        subtotalUsdMin,
        setSubtotalUsdMin,
        subtotalUsdMax,
        setSubtotalUsdMax,
        acquisitionFilter,
        setAcquisitionFilter,
        manufacturerSuggestions,

        // Actions
        handleStatusChange,
        handleDateChange,
        handleClone,
        handleDelete,
        handleAcquisitionChange,
        handleProjectionAcquisitionChange,
        handleProjectionStatusChange,
        handleProjectionDateChange,
        toggleStatusFilter,
        clearFilters,
    };
}
===
import { useState, useEffect, useMemo } from 'react';
import { api } from '../lib/api';
import { TRM_API_URL } from '../lib/constants';
import { calculateScenarioTotals } from '../lib/pricing-engine';
import { getTrmMonthlyAverage } from '../lib/trm-service';
import type { ProposalSummary, ProposalStatus, BillingProjection, AcquisitionType, ItemType } from '../lib/types';
import type { DateRange } from '../pages/dashboard/DashboardFilters';

// ── Types ────────────────────────────────────────────────────

type CurrencyCode = 'COP' | 'USD';

interface MinSubtotalResult {
    subtotal: number | null;
    currency: CurrencyCode | null;
}

type ProposalWithSubtotal = ProposalSummary & MinSubtotalResult;

export interface DashboardRow {
    id: string;
    code: string;
    clientName: string;
    subject: string;
    minSubtotal: number | null;
    minSubtotalCurrency: CurrencyCode | null;
    status: ProposalStatus;
    closeDate?: string | null;
    billingDate?: string | null;
    acquisitionType?: AcquisitionType | null;
    updatedAt: string;
    user?: { name: string; nomenclature: string };
    isProjection: boolean;
    originalProposal?: ProposalWithSubtotal;
    originalProjection?: BillingProjection;
}

export interface BillingCards {
    facturadoMesAnterior: number;
    facturadoMesActual: number;
    facturadoTrimestreActual: number;
    proyeccionTrimestreSiguiente: number;
    pendFactMesActual: number;
    pendFactMesSiguiente: number;
}

// ── Pure helpers ─────────────────────────────────────────────

/** Find the scenario with the minimum subtotal and return its value + currency. */
function computeMinSubtotal(proposal: ProposalSummary): MinSubtotalResult {
    if (!proposal.scenarios || proposal.scenarios.length === 0) {
        return { subtotal: null, currency: null };
    }

    let minSubtotal: number | null = null;
    let minCurrency: CurrencyCode | null = null;

    for (const scenario of proposal.scenarios) {
        const totals = calculateScenarioTotals(scenario.scenarioItems);
        const sub = totals.subtotal;

        if (minSubtotal === null || sub < minSubtotal) {
            minSubtotal = sub;
            minCurrency = (scenario.currency === 'USD' ? 'USD' : 'COP') as CurrencyCode;
        }
    }

    return { subtotal: minSubtotal, currency: minCurrency };
}

/**
 * Convert a subtotal to USD.
 * - If already in USD → return as-is.
 * - If COP and trmRate > 0 → divide.
 * - Otherwise → null.
 */
export function getSubtotalUsd(
    subtotal: number | null,
    currency: CurrencyCode | null,
    trmRate: number | null,
): number | null {
    if (subtotal === null || currency === null) return null;
    if (currency === 'USD') return subtotal;
    if (currency === 'COP' && trmRate && trmRate > 0) return subtotal / trmRate;
    return null;
}

/** Parse ISO date → { month (0-indexed), year } without timezone shift. */
function parseDate(dateStr: string): { month: number; year: number } {
    const [datePart] = dateStr.split('T');
    const [y, m] = datePart.split('-').map(Number);
    return { month: m - 1, year: y };
}

/** Compute billing cards for a single acquisition type. All subtotals converted to USD. */
function computeBillingCards(
    proposals: ProposalWithSubtotal[],
    projections: BillingProjection[],
    acquisitionFilter: AcquisitionType,
    trmRate: number | null,
): BillingCards {
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();
    const prevMonth = thisMonth === 0 ? 11 : thisMonth - 1;
    const prevMonthYear = thisMonth === 0 ? thisYear - 1 : thisYear;
    const currentQuarter = Math.floor(thisMonth / 3);
    const nextQuarter = (currentQuarter + 1) % 4;
    const nextQuarterYear = nextQuarter === 0 ? thisYear + 1 : thisYear;
    const nextMonth = thisMonth === 11 ? 0 : thisMonth + 1;
    const nextMonthYear = thisMonth === 11 ? thisYear + 1 : thisYear;

    let facturadoMesAnterior = 0;
    let facturadoMesActual = 0;
    let facturadoTrimestreActual = 0;
    let proyeccionTrimestreSiguiente = 0;
    let pendFactMesActual = 0;
    let pendFactMesSiguiente = 0;

    const filteredProposals = proposals.filter(p => p.acquisitionType === acquisitionFilter);
    const filteredProjections = projections.filter(pr => pr.acquisitionType === acquisitionFilter);

    for (const p of filteredProposals) {
        const sub = getSubtotalUsd(p.subtotal, p.currency, trmRate) ?? 0;

        if (p.status === 'FACTURADA' && p.billingDate) {
            const { month, year } = parseDate(p.billingDate);
            if (month === prevMonth && year === prevMonthYear) facturadoMesAnterior += sub;
            if (month === thisMonth && year === thisYear) facturadoMesActual += sub;
            if (Math.floor(month / 3) === currentQuarter && year === thisYear) facturadoTrimestreActual += sub;
        }

        if (p.status === 'PENDIENTE_FACTURAR' && p.billingDate) {
            const { month, year } = parseDate(p.billingDate);
            if (Math.floor(month / 3) === currentQuarter && year === thisYear) facturadoTrimestreActual += sub;
            if (Math.floor(month / 3) === nextQuarter && year === nextQuarterYear) proyeccionTrimestreSiguiente += sub;
            if (month === thisMonth && year === thisYear) pendFactMesActual += sub;
            if (month === nextMonth && year === nextMonthYear) pendFactMesSiguiente += sub;
        }

        if (p.status === 'GANADA' && p.closeDate) {
            const { month, year } = parseDate(p.closeDate);
            if (Math.floor(month / 3) === nextQuarter && year === nextQuarterYear) proyeccionTrimestreSiguiente += sub;
        }
    }

    // Projections: use stored currency for conversion
    for (const pr of filteredProjections) {
        const rawSub = Number(pr.subtotal) || 0;
        const prCurrency: CurrencyCode = pr.currency === 'USD' ? 'USD' : 'COP';
        const sub = getSubtotalUsd(rawSub, prCurrency, trmRate) ?? 0;

        if (pr.status === 'FACTURADA' && pr.billingDate) {
            const { month, year } = parseDate(pr.billingDate);
            if (month === prevMonth && year === prevMonthYear) facturadoMesAnterior += sub;
            if (month === thisMonth && year === thisYear) facturadoMesActual += sub;
            if (Math.floor(month / 3) === currentQuarter && year === thisYear) facturadoTrimestreActual += sub;
        }

        if (pr.status === 'PENDIENTE_FACTURAR' && pr.billingDate) {
            const { month, year } = parseDate(pr.billingDate);
            if (Math.floor(month / 3) === currentQuarter && year === thisYear) facturadoTrimestreActual += sub;
            if (Math.floor(month / 3) === nextQuarter && year === nextQuarterYear) proyeccionTrimestreSiguiente += sub;
            if (month === thisMonth && year === thisYear) pendFactMesActual += sub;
            if (month === nextMonth && year === nextMonthYear) pendFactMesSiguiente += sub;
        }
    }

    return { facturadoMesAnterior, facturadoMesActual, facturadoTrimestreActual, proyeccionTrimestreSiguiente, pendFactMesActual, pendFactMesSiguiente };
}

// ── Hook ─────────────────────────────────────────────────────

export function useDashboard() {
    const [proposals, setProposals] = useState<ProposalSummary[]>([]);
    const [projections, setProjections] = useState<BillingProjection[]>([]);
    const [loading, setLoading] = useState(true);

    // TRM (frontend-only, editable)
    const [trmRate, setTrmRate] = useState<number | null>(null);

    // TRM historical averages
    const [trmCurrentMonthAvg, setTrmCurrentMonthAvg] = useState<number | null>(null);
    const [trmPreviousMonthAvg, setTrmPreviousMonthAvg] = useState<number | null>(null);
    const [isLoadingTrmAverages, setIsLoadingTrmAverages] = useState(true);

    // Filter state
    const [showFilters, setShowFilters] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilters, setStatusFilters] = useState<Set<ProposalStatus>>(new Set());


    // Advanced filter state
    const [closeDateRange, setCloseDateRange] = useState<DateRange>({ from: '', to: '' });
    const [billingDateRange, setBillingDateRange] = useState<DateRange>({ from: '', to: '' });
    const [categoryFilter, setCategoryFilter] = useState<Set<ItemType>>(new Set());
    const [manufacturerFilter, setManufacturerFilter] = useState('');
    const [subtotalUsdMin, setSubtotalUsdMin] = useState('');
    const [subtotalUsdMax, setSubtotalUsdMax] = useState('');
    const [acquisitionFilter, setAcquisitionFilter] = useState<AcquisitionType | 'ALL'>('ALL');

    // Clone action state
    const [cloning, setCloning] = useState<string | null>(null);

    useEffect(() => {
        loadData();
        fetchTrm();
        fetchTrmAverages();
    }, []);

    const loadData = async () => {
        try {
            const [proposalsRes, projectionsRes] = await Promise.all([
                api.get('/proposals'),
                api.get('/billing-projections'),
            ]);
            setProposals(proposalsRes.data);
            setProjections(projectionsRes.data);
        } catch (error) {
            console.error("Error cargando datos:", error);
        } finally {
            setLoading(false);
        }
    };

    /** Fetch TRM once on mount as suggested default value. */
    const fetchTrm = async () => {
        try {
            const res = await fetch(TRM_API_URL);
            const data = await res.json();
            setTrmRate(data.valor ?? null);
        } catch (error) {
            console.error('Error fetching TRM:', error);
        }
    };

    /** Fetch current and previous month TRM averages in parallel. */
    const fetchTrmAverages = async () => {
        setIsLoadingTrmAverages(true);

        const now = new Date();
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();
        const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
        const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;

        try {
            const [currentAvg, previousAvg] = await Promise.all([
                getTrmMonthlyAverage(currentYear, currentMonth),
                getTrmMonthlyAverage(prevYear, prevMonth),
            ]);

            setTrmCurrentMonthAvg(currentAvg);
            setTrmPreviousMonthAvg(previousAvg);
        } catch (error) {
            console.error('Error fetching TRM averages:', error);
        } finally {
            setIsLoadingTrmAverages(false);
        }
    };

    const loadProposals = async () => {
        try {
            const res = await api.get('/proposals');
            setProposals(res.data);
        } catch (error) {
            console.error("Error cargando propuestas:", error);
        }
    };

    // ── Computed values ──
    const proposalsWithSubtotals = useMemo(() => {
        return proposals.map(p => {
            const { subtotal, currency } = computeMinSubtotal(p);
            return { ...p, subtotal, currency };
        });
    }, [proposals]);

    // ── Unified rows (proposals + projections) ──
    const allRows: DashboardRow[] = useMemo(() => {
        const proposalRows: DashboardRow[] = proposalsWithSubtotals.map(p => ({
            id: p.id,
            code: p.proposalCode,
            clientName: p.clientName,
            subject: p.subject,
            minSubtotal: p.subtotal,
            minSubtotalCurrency: p.currency,
            status: p.status,
            closeDate: p.closeDate,
            billingDate: p.billingDate,
            acquisitionType: p.acquisitionType,
            updatedAt: p.updatedAt,
            user: p.user,
            isProjection: false,
            originalProposal: p,
        }));

        const projectionRows: DashboardRow[] = projections.map(pr => ({
            id: pr.id,
            code: pr.projectionCode,
            clientName: pr.clientName,
            subject: '',
            minSubtotal: Number(pr.subtotal),
            minSubtotalCurrency: (pr.currency === 'USD' ? 'USD' : 'COP') as CurrencyCode,
            status: pr.status as ProposalStatus,
            closeDate: null,
            billingDate: pr.billingDate,
            acquisitionType: pr.acquisitionType,
            updatedAt: pr.updatedAt,
            user: pr.user,
            isProjection: true,
            originalProjection: pr,
        }));

        return [...proposalRows, ...projectionRows];
    }, [proposalsWithSubtotals, projections]);

    /** Unique fabricante/responsable values from all proposals for autocomplete. */
    const manufacturerSuggestions = useMemo(() => {
        const values = new Set<string>();
        for (const p of proposals) {
            const scenarioItems = p.scenarios?.flatMap(s => s.scenarioItems) ?? [];
            for (const si of scenarioItems) {
                const specs = si.item.technicalSpecs;
                if (specs?.fabricante) values.add(specs.fabricante);
                if (specs?.responsable) values.add(specs.responsable);
            }
        }
        return Array.from(values).sort();
    }, [proposals]);

    const filtered = useMemo(() => {
        return allRows.filter(row => {
            // Search term
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                const isMatch = row.code?.toLowerCase().includes(term) ||
                    row.clientName.toLowerCase().includes(term) ||
                    row.subject.toLowerCase().includes(term);
                if (!isMatch) return false;
            }

            // Status
            if (statusFilters.size > 0 && !statusFilters.has(row.status)) return false;



            // Close date range
            if (closeDateRange.from || closeDateRange.to) {
                const raw = row.closeDate;
                if (!raw) return false;
                const dateStr = raw.split('T')[0];
                if (closeDateRange.from && dateStr < closeDateRange.from) return false;
                if (closeDateRange.to && dateStr > closeDateRange.to) return false;
            }

            // Billing date range
            if (billingDateRange.from || billingDateRange.to) {
                const raw = row.billingDate;
                if (!raw) return false;
                const dateStr = raw.split('T')[0];
                if (billingDateRange.from && dateStr < billingDateRange.from) return false;
                if (billingDateRange.to && dateStr > billingDateRange.to) return false;
            }

            // Category filter
            if (categoryFilter.size > 0) {
                const itemTypes = row.originalProposal?.scenarios
                    ?.flatMap(s => s.scenarioItems)
                    ?.map(si => si.item.itemType as ItemType) ?? [];
                const hasMatch = itemTypes.some(t => categoryFilter.has(t));
                if (!hasMatch) return false;
            }

            // Manufacturer / Responsable
            if (manufacturerFilter) {
                const term = manufacturerFilter.toLowerCase();
                const items = row.originalProposal?.scenarios
                    ?.flatMap(s => s.scenarioItems)
                    ?.map(si => si.item) ?? [];
                const hasMatch = items.some(item => {
                    const specs = item.technicalSpecs;
                    return specs?.fabricante?.toLowerCase().includes(term) ||
                        specs?.responsable?.toLowerCase().includes(term);
                });
                if (!hasMatch) return false;
            }

            // USD Subtotal range
            if (subtotalUsdMin || subtotalUsdMax) {
                const usd = getSubtotalUsd(row.minSubtotal, row.minSubtotalCurrency, trmRate);
                if (usd === null) return false;
                if (subtotalUsdMin && usd < parseFloat(subtotalUsdMin)) return false;
                if (subtotalUsdMax && usd > parseFloat(subtotalUsdMax)) return false;
            }

            // Acquisition type
            if (acquisitionFilter !== 'ALL' && row.acquisitionType !== acquisitionFilter) return false;

            return true;
        });
    }, [
        allRows, searchTerm, statusFilters,
        closeDateRange, billingDateRange, categoryFilter, manufacturerFilter,
        subtotalUsdMin, subtotalUsdMax, acquisitionFilter, trmRate,
    ]);

    // ── Billing summary cards per acquisition type (values in USD) ──
    const billingCardsVenta: BillingCards = useMemo(
        () => computeBillingCards(proposalsWithSubtotals, projections, 'VENTA', trmRate),
        [proposalsWithSubtotals, projections, trmRate],
    );

    const billingCardsDaas: BillingCards = useMemo(
        () => computeBillingCards(proposalsWithSubtotals, projections, 'DAAS', trmRate),
        [proposalsWithSubtotals, projections, trmRate],
    );

    // ── Actions ──
    const handleStatusChange = async (id: string, newStatus: ProposalStatus) => {
        try {
            await api.patch(`/proposals/${id}`, { status: newStatus });
            setProposals(prev => prev.map(p => p.id === id ? { ...p, status: newStatus } : p));
        } catch (error) {
            console.error(error);
        }
    };

    const handleDateChange = async (id: string, field: 'closeDate' | 'billingDate', value: string) => {
        try {
            await api.patch(`/proposals/${id}`, { [field]: value || null });
            setProposals(prev => prev.map(p => p.id === id ? { ...p, [field]: value || null } : p));
        } catch (error) {
            console.error(error);
        }
    };

    const handleClone = async (id: string, cloneType: 'NEW_VERSION' | 'NEW_PROPOSAL') => {
        setCloning(id);
        try {
            await api.post(`/proposals/${id}/clone`, { cloneType });
            await loadProposals();
        } catch (error) {
            console.error(error);
            alert('No se pudo clonar la propuesta.');
        } finally {
            setCloning(null);
        }
    };

    const handleDelete = async (id: string, code: string) => {
        if (!window.confirm(`⚠️ ¿Estás seguro de que deseas eliminar permanentemente la propuesta ${code}?\n\nEsta acción no se puede deshacer. Se eliminarán todos los ítems, escenarios y datos asociados.`)) return;

        try {
            await api.delete(`/proposals/${id}`);
            setProposals(proposals.filter(p => p.id !== id));
        } catch (error) {
            console.error(error);
            alert("No se pudo eliminar la propuesta.");
        }
    };

    const handleAcquisitionChange = async (id: string, value: AcquisitionType) => {
        try {
            await api.patch(`/proposals/${id}`, { acquisitionType: value });
            setProposals(prev => prev.map(p => p.id === id ? { ...p, acquisitionType: value } : p));
        } catch (error) {
            console.error(error);
        }
    };

    const handleProjectionAcquisitionChange = async (id: string, value: AcquisitionType) => {
        try {
            await api.patch(`/billing-projections/${id}`, { acquisitionType: value });
            setProjections(prev => prev.map(pr => pr.id === id ? { ...pr, acquisitionType: value } : pr));
        } catch (error) {
            console.error(error);
        }
    };

    const handleProjectionStatusChange = async (id: string, newStatus: ProposalStatus) => {
        try {
            await api.patch(`/billing-projections/${id}`, { status: newStatus });
            setProjections(prev => prev.map(pr => pr.id === id ? { ...pr, status: newStatus as 'PENDIENTE_FACTURAR' | 'FACTURADA' } : pr));
        } catch (error) {
            console.error(error);
        }
    };

    const handleProjectionDateChange = async (id: string, value: string) => {
        try {
            await api.patch(`/billing-projections/${id}`, { billingDate: value || null });
            setProjections(prev => prev.map(pr => pr.id === id ? { ...pr, billingDate: value || null } : pr));
        } catch (error) {
            console.error(error);
        }
    };

    const toggleStatusFilter = (status: ProposalStatus) => {
        setStatusFilters(prev => {
            const next = new Set(prev);
            if (next.has(status)) next.delete(status);
            else next.add(status);
            return next;
        });
    };

    const clearFilters = () => {
        setSearchTerm('');
        setStatusFilters(new Set());
        setCloseDateRange({ from: '', to: '' });
        setBillingDateRange({ from: '', to: '' });
        setCategoryFilter(new Set());
        setManufacturerFilter('');
        setSubtotalUsdMin('');
        setSubtotalUsdMax('');
        setAcquisitionFilter('ALL');
    };

    const hasActiveFilters = searchTerm || statusFilters.size > 0
        || closeDateRange.from || closeDateRange.to
        || billingDateRange.from || billingDateRange.to
        || categoryFilter.size > 0 || manufacturerFilter
        || subtotalUsdMin || subtotalUsdMax || acquisitionFilter !== 'ALL';

    return {
        // State
        loading,
        filtered,
        billingCardsVenta,
        billingCardsDaas,
        cloning,
        setProjections,
        trmRate,
        setTrmRate,
        trmCurrentMonthAvg,
        trmPreviousMonthAvg,
        isLoadingTrmAverages,

        // Filter state
        showFilters,
        setShowFilters,
        searchTerm,
        setSearchTerm,
        statusFilters,
        hasActiveFilters,

        // Advanced filter state
        closeDateRange,
        setCloseDateRange,
        billingDateRange,
        setBillingDateRange,
        categoryFilter,
        setCategoryFilter,
        manufacturerFilter,
        setManufacturerFilter,
        subtotalUsdMin,
        setSubtotalUsdMin,
        subtotalUsdMax,
        setSubtotalUsdMax,
        acquisitionFilter,
        setAcquisitionFilter,
        manufacturerSuggestions,

        // Actions
        handleStatusChange,
        handleDateChange,
        handleClone,
        handleDelete,
        handleAcquisitionChange,
        handleProjectionAcquisitionChange,
        handleProjectionStatusChange,
        handleProjectionDateChange,
        toggleStatusFilter,
        clearFilters,
    };
}
```

#### [Dashboard.tsx](file:///d:/novotechflow/apps/web/src/pages/Dashboard.tsx)
- Destructured `subtotalMin`, `setSubtotalMin`, `subtotalMax`, `setSubtotalMax`
- The entire `<div className="grid grid-cols-2 gap-4">` block with the two number inputs

```diff:Dashboard.tsx
import { useNavigate } from 'react-router-dom';
import {
    PlusCircle, Trash2, Edit2, Loader2,
    Copy, Search, Filter, X, Receipt,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useDashboard, getSubtotalUsd } from '../hooks/useDashboard';
import { useProjections } from '../hooks/useProjections';
import { STATUS_CONFIG, ALL_STATUSES, PROJECTION_STATUSES, ACQUISITION_CONFIG, formatCOP, formatUSD } from '../lib/constants';
import type { ProposalStatus, AcquisitionType } from '../lib/types';
import BillingCards from './dashboard/BillingCards';
import ProjectionModal from './dashboard/ProjectionModal';
import TrmCards from './dashboard/TrmCards';
import DashboardFilters from './dashboard/DashboardFilters';

/** Format a subtotal with its currency label (COP or USD). */
function formatSubtotalWithCurrency(value: number, currency: 'COP' | 'USD' | null): string {
    if (currency === 'USD') return `USD ${formatUSD(value)}`;
    return `COP ${formatCOP(value)}`;
}

export default function Dashboard() {
    const navigate = useNavigate();
    const { user } = useAuthStore();

    const {
        loading, filtered, billingCardsVenta, billingCardsDaas, cloning, setProjections,
        trmRate, setTrmRate,
        trmCurrentMonthAvg, trmPreviousMonthAvg, isLoadingTrmAverages,
        showFilters, setShowFilters, searchTerm, setSearchTerm,
        statusFilters, subtotalMin, setSubtotalMin, subtotalMax, setSubtotalMax,
        hasActiveFilters,
        closeDateRange, setCloseDateRange,
        billingDateRange, setBillingDateRange,
        categoryFilter, setCategoryFilter,
        manufacturerFilter, setManufacturerFilter,
        subtotalUsdMin, setSubtotalUsdMin,
        subtotalUsdMax, setSubtotalUsdMax,
        acquisitionFilter, setAcquisitionFilter,
        manufacturerSuggestions,
        handleStatusChange, handleDateChange, handleClone, handleDelete,
        handleAcquisitionChange, handleProjectionAcquisitionChange,
        handleProjectionStatusChange, handleProjectionDateChange,
        toggleStatusFilter, clearFilters,
    } = useDashboard();

    const {
        showProjectionModal, setShowProjectionModal,
        editingProjection, projForm, setProjForm, savingProjection,
        openNewProjectionModal, openEditProjectionModal,
        handleSaveProjection, handleDeleteProjection,
    } = useProjections(setProjections);

    if (loading) {
        return (
            <div className="flex justify-center items-center py-20">
                <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-gray-900">
                        {user?.role === 'ADMIN' ? 'Resumen Global de Actividad' : 'Mis Propuestas'}
                    </h2>
                    <p className="text-gray-500 text-sm">
                        {user?.role === 'ADMIN' ? 'Métricas y propuestas de todo el equipo comercial.' : 'Gestiona tus cotizaciones y cierres.'}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {/* TRM Input */}
                    <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-1.5">
                        <label htmlFor="trm-input" className="text-[10px] font-bold uppercase tracking-wider text-gray-400 whitespace-nowrap">
                            TRM (COP/USD)
                        </label>
                        <input
                            id="trm-input"
                            type="number"
                            step="0.01"
                            value={trmRate ?? ''}
                            onChange={(e) => setTrmRate(e.target.value ? Number(e.target.value) : null)}
                            className="w-[100px] text-sm font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-2 py-1 text-right focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-300"
                            placeholder="—"
                        />
                    </div>
                    <button
                        onClick={openNewProjectionModal}
                        className="flex items-center space-x-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-violet-600/25"
                    >
                        <Receipt className="h-5 w-5" />
                        <span>Proyección de Facturación</span>
                    </button>
                    <button
                        onClick={() => navigate('/proposals/new')}
                        className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-indigo-600/25"
                    >
                        <PlusCircle className="h-5 w-5" />
                        <span>Nueva Propuesta</span>
                    </button>
                </div>
            </div>

            {/* TRM Cards */}
            <TrmCards
                trmRate={trmRate}
                trmCurrentMonthAvg={trmCurrentMonthAvg}
                trmPreviousMonthAvg={trmPreviousMonthAvg}
                isLoadingTrmAverages={isLoadingTrmAverages}
            />

            {/* Financial Cards */}
            <BillingCards billingCardsVenta={billingCardsVenta} billingCardsDaas={billingCardsDaas} />

            {/* Filter Toggle + Search */}
            <div className="flex items-center gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Buscar por código, cliente o asunto..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-300"
                    />
                </div>
                <button
                    onClick={() => setShowFilters(!showFilters)}
                    className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-colors ${showFilters || hasActiveFilters ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                >
                    <Filter className="h-4 w-4" />
                    <span>Filtros</span>
                    {hasActiveFilters && <span className="h-2 w-2 bg-indigo-500 rounded-full" />}
                </button>
                {hasActiveFilters && (
                    <button onClick={clearFilters} className="p-2.5 text-gray-400 hover:text-red-500 transition-colors">
                        <X className="h-4 w-4" />
                    </button>
                )}
            </div>

            {/* Collapsible Filters */}
            {showFilters && (
                <div className="space-y-4">
                    {/* Status filters row */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4 animate-in slide-in-from-top-2">
                        <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 block">Estado</label>
                            <div className="flex flex-wrap gap-2">
                                {ALL_STATUSES.map(s => {
                                    const cfg = STATUS_CONFIG[s];
                                    const active = statusFilters.has(s);
                                    return (
                                        <button
                                            key={s}
                                            onClick={() => toggleStatusFilter(s)}
                                            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide border transition-all ${active ? `${cfg.bg} ${cfg.text} ${cfg.border}` : 'bg-gray-50 text-gray-400 border-transparent hover:bg-gray-100'}`}
                                        >
                                            {cfg.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Subtotal mín.</label>
                                <input
                                    type="number"
                                    placeholder="0"
                                    value={subtotalMin}
                                    onChange={(e) => setSubtotalMin(e.target.value)}
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Subtotal máx.</label>
                                <input
                                    type="number"
                                    placeholder="∞"
                                    value={subtotalMax}
                                    onChange={(e) => setSubtotalMax(e.target.value)}
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Advanced filters */}
                    <DashboardFilters
                        closeDateRange={closeDateRange}
                        onCloseDateRangeChange={setCloseDateRange}
                        billingDateRange={billingDateRange}
                        onBillingDateRangeChange={setBillingDateRange}
                        categoryFilter={categoryFilter}
                        onCategoryFilterChange={setCategoryFilter}
                        manufacturerFilter={manufacturerFilter}
                        onManufacturerFilterChange={setManufacturerFilter}
                        manufacturerSuggestions={manufacturerSuggestions}
                        subtotalUsdMin={subtotalUsdMin}
                        onSubtotalUsdMinChange={setSubtotalUsdMin}
                        subtotalUsdMax={subtotalUsdMax}
                        onSubtotalUsdMaxChange={setSubtotalUsdMax}
                        acquisitionFilter={acquisitionFilter}
                        onAcquisitionFilterChange={setAcquisitionFilter}
                        onClearAll={clearFilters}
                    />
                </div>
            )}

            {/* Proposals Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">
                        {filtered.length} Registro{filtered.length !== 1 ? 's' : ''}
                    </h3>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-gray-600">
                        <thead className="bg-gray-50 text-[10px] uppercase text-gray-400 font-bold tracking-wider border-b border-gray-100">
                            <tr>
                                <th className="px-5 py-3">Código</th>
                                <th className="px-4 py-3">Cliente / Asunto</th>
                                {user?.role === 'ADMIN' && <th className="px-4 py-3 text-center">Asesor</th>}
                                <th className="px-4 py-3 text-center">F. Cierre</th>
                                <th className="px-4 py-3 text-center">Actualización</th>
                                <th className="px-4 py-3 text-right">Subtotal Min.</th>
                                <th className="px-4 py-3 text-right">USD Est.</th>
                                <th className="px-4 py-3 text-center">Adquisición</th>
                                <th className="px-4 py-3 text-center">Estado</th>
                                <th className="px-4 py-3 text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={user?.role === 'ADMIN' ? 10 : 9} className="px-6 py-16 text-center text-gray-400">
                                        No hay propuestas que coincidan con los filtros.
                                    </td>
                                </tr>
                            ) : (
                                filtered.map((row) => {
                                    const usdEst = getSubtotalUsd(row.minSubtotal, row.minSubtotalCurrency, trmRate);

                                    if (row.isProjection) {
                                        // ── Projection Row ──
                                        const pr = row.originalProjection!;
                                        const cfg = STATUS_CONFIG[row.status];
                                        return (
                                            <tr key={`proj-${row.id}`} className="hover:bg-violet-50/30 transition-colors group bg-violet-50/10">
                                                <td className="px-5 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-mono font-black text-violet-600 text-xs">{row.code}</span>
                                                        <span className="text-[8px] font-bold uppercase bg-violet-100 text-violet-600 px-1.5 py-0.5 rounded-md border border-violet-200">PROY</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4">
                                                    <p className="font-bold text-gray-900 text-sm">{row.clientName}</p>
                                                    <p className="text-[10px] text-violet-400 mt-0.5">Proyección de facturación</p>
                                                </td>
                                                {user?.role === 'ADMIN' && (
                                                    <td className="px-4 py-4 text-center">
                                                        <span className="text-[10px] font-bold uppercase text-violet-600 bg-violet-50 px-2 py-1 rounded-lg border border-violet-100">
                                                            {pr.user?.nomenclature || '??'} - {pr.user?.name?.split(' ')[0]}
                                                        </span>
                                                    </td>
                                                )}
                                                <td className="px-4 py-4 text-center">
                                                    <span className="text-[10px] text-gray-300">—</span>
                                                </td>
                                                <td className="px-4 py-4 text-center text-[10px] text-gray-400 font-semibold">
                                                    {new Date(row.updatedAt).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: '2-digit' })}
                                                </td>
                                                <td className="px-4 py-4 text-right">
                                                    <span className="font-mono font-black text-xs text-emerald-700">
                                                        {formatSubtotalWithCurrency(Number(pr.subtotal), row.minSubtotalCurrency)}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-4 text-right">
                                                    {usdEst !== null ? (
                                                        <span className="font-mono font-black text-xs text-blue-700">USD {formatUSD(usdEst)}</span>
                                                    ) : (
                                                        <span className="text-[10px] text-gray-300">—</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-4 text-center">
                                                    <select
                                                        value={pr.acquisitionType || ''}
                                                        onChange={(e) => handleProjectionAcquisitionChange(row.id, e.target.value as AcquisitionType)}
                                                        className={`text-[10px] font-bold uppercase px-2 py-1.5 rounded-lg border cursor-pointer focus:ring-2 focus:ring-sky-600/20 ${
                                                            pr.acquisitionType && ACQUISITION_CONFIG[pr.acquisitionType]
                                                                ? `${ACQUISITION_CONFIG[pr.acquisitionType].bg} ${ACQUISITION_CONFIG[pr.acquisitionType].text} ${ACQUISITION_CONFIG[pr.acquisitionType].border}`
                                                                : 'bg-gray-50 text-gray-400 border-gray-200'
                                                        }`}
                                                    >
                                                        <option value="">— Seleccionar —</option>
                                                        <option value="VENTA">Venta</option>
                                                        <option value="DAAS">DaaS</option>
                                                    </select>
                                                </td>
                                                <td className="px-4 py-4 text-center">
                                                    <select
                                                        value={row.status}
                                                        onChange={(e) => handleProjectionStatusChange(row.id, e.target.value as ProposalStatus)}
                                                        className={`text-[10px] font-bold uppercase px-2 py-1.5 rounded-lg border ${cfg.bg} ${cfg.text} ${cfg.border} cursor-pointer focus:ring-2 focus:ring-violet-600/20`}
                                                    >
                                                        {PROJECTION_STATUSES.map(s => (
                                                            <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                                                        ))}
                                                    </select>
                                                    <div className="mt-2">
                                                        <span className="text-[9px] font-bold text-orange-500 uppercase tracking-wider block mb-0.5">Fecha de facturación</span>
                                                        <input
                                                            type="date"
                                                            value={pr.billingDate ? new Date(pr.billingDate).toISOString().split('T')[0] : ''}
                                                            onChange={(e) => handleProjectionDateChange(row.id, e.target.value)}
                                                            className="text-[10px] font-semibold text-orange-600 bg-orange-50 border border-orange-200 rounded-lg px-2 py-1 w-[130px]"
                                                        />
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4 text-center">
                                                    <div className="flex items-center justify-center space-x-1">
                                                        <button
                                                            onClick={() => openEditProjectionModal(pr)}
                                                            className="p-1.5 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-all"
                                                            title="Editar proyección"
                                                        >
                                                            <Edit2 className="h-3.5 w-3.5" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteProjection(row.id, row.code)}
                                                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                                            title="Eliminar proyección"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    }

                                    // ── Proposal Row (original logic) ──
                                    const p = row.originalProposal!;
                                    const cfg = STATUS_CONFIG[p.status];
                                    const needsBillingDate = p.status === 'PENDIENTE_FACTURAR' || p.status === 'FACTURADA';

                                    return (
                                        <tr key={p.id} className="hover:bg-gray-50/50 transition-colors group">
                                            <td className="px-5 py-4">
                                                <span className="font-mono font-black text-indigo-600 text-xs">{p.proposalCode}</span>
                                            </td>
                                            <td className="px-4 py-4">
                                                <p className="font-bold text-gray-900 text-sm">{p.clientName}</p>
                                                <p className="text-[10px] text-gray-400 mt-0.5 line-clamp-1" title={p.subject}>{p.subject}</p>
                                            </td>
                                            {user?.role === 'ADMIN' && (
                                                <td className="px-4 py-4 text-center">
                                                    <span className="text-[10px] font-bold uppercase text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg border border-indigo-100">
                                                        {p.user?.nomenclature || '??'} - {p.user?.name?.split(' ')[0]}
                                                    </span>
                                                </td>
                                            )}
                                            <td className="px-4 py-4 text-center">
                                                <input
                                                    type="date"
                                                    value={p.closeDate ? new Date(p.closeDate).toISOString().split('T')[0] : ''}
                                                    onChange={(e) => handleDateChange(p.id, 'closeDate', e.target.value)}
                                                    className="text-[11px] font-semibold text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 w-[120px]"
                                                />

                                            </td>
                                            <td className="px-4 py-4 text-center text-[10px] text-gray-400 font-semibold">
                                                {new Date(p.updatedAt).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: '2-digit' })}
                                            </td>
                                            <td className="px-4 py-4 text-right">
                                                {row.minSubtotal !== null ? (
                                                    <span className="font-mono font-black text-xs text-emerald-700">
                                                        {formatSubtotalWithCurrency(row.minSubtotal, row.minSubtotalCurrency)}
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] text-gray-300">Sin escenario</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-4 text-right">
                                                {usdEst !== null ? (
                                                    <span className="font-mono font-black text-xs text-blue-700">USD {formatUSD(usdEst)}</span>
                                                ) : (
                                                    <span className="text-[10px] text-gray-300">—</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-4 text-center">
                                                <select
                                                    value={p.acquisitionType || ''}
                                                    onChange={(e) => handleAcquisitionChange(p.id, e.target.value as AcquisitionType)}
                                                    className={`text-[10px] font-bold uppercase px-2 py-1.5 rounded-lg border cursor-pointer focus:ring-2 focus:ring-sky-600/20 ${
                                                        p.acquisitionType && ACQUISITION_CONFIG[p.acquisitionType]
                                                            ? `${ACQUISITION_CONFIG[p.acquisitionType].bg} ${ACQUISITION_CONFIG[p.acquisitionType].text} ${ACQUISITION_CONFIG[p.acquisitionType].border}`
                                                            : 'bg-gray-50 text-gray-400 border-gray-200'
                                                    }`}
                                                >
                                                    <option value="">— Seleccionar —</option>
                                                    <option value="VENTA">Venta</option>
                                                    <option value="DAAS">DaaS</option>
                                                </select>
                                            </td>
                                            <td className="px-4 py-4 text-center">
                                                <select
                                                    value={p.status}
                                                    onChange={(e) => handleStatusChange(p.id, e.target.value as ProposalStatus)}
                                                    className={`text-[10px] font-bold uppercase px-2 py-1.5 rounded-lg border ${cfg.bg} ${cfg.text} ${cfg.border} cursor-pointer focus:ring-2 focus:ring-indigo-600/20`}
                                                >
                                                    {ALL_STATUSES.map(s => (
                                                        <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                                                    ))}
                                                </select>
                                                {needsBillingDate && (
                                                    <div className="mt-2">
                                                        <span className="text-[9px] font-bold text-orange-500 uppercase tracking-wider block mb-0.5">Fecha de facturación</span>
                                                        <input
                                                            type="date"
                                                            value={p.billingDate ? new Date(p.billingDate).toISOString().split('T')[0] : ''}
                                                            onChange={(e) => handleDateChange(p.id, 'billingDate', e.target.value)}
                                                            className="text-[10px] font-semibold text-orange-600 bg-orange-50 border border-orange-200 rounded-lg px-2 py-1 w-[130px]"
                                                        />
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-4 py-4 text-center">
                                                <div className="flex items-center justify-center space-x-1">
                                                    <button
                                                        onClick={() => navigate(`/proposals/${p.id}/builder`)}
                                                        className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                                        title="Editar"
                                                    >
                                                        <Edit2 className="h-3.5 w-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleClone(p.id, 'NEW_VERSION')}
                                                        disabled={cloning === p.id}
                                                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                                        title="Clonar versión"
                                                    >
                                                        <Copy className="h-3.5 w-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleClone(p.id, 'NEW_PROPOSAL')}
                                                        disabled={cloning === p.id}
                                                        className="p-1.5 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-all"
                                                        title="Clonar como nueva propuesta"
                                                    >
                                                        <PlusCircle className="h-3.5 w-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(p.id, p.proposalCode || '')}
                                                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                                        title="Eliminar"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Projection Modal */}
            {showProjectionModal && (
                <ProjectionModal
                    editingProjection={editingProjection}
                    projForm={projForm}
                    setProjForm={setProjForm}
                    savingProjection={savingProjection}
                    onSave={handleSaveProjection}
                    onClose={() => setShowProjectionModal(false)}
                />
            )}
        </div>
    );
}
===
import { useNavigate } from 'react-router-dom';
import {
    PlusCircle, Trash2, Edit2, Loader2,
    Copy, Search, Filter, X, Receipt,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useDashboard, getSubtotalUsd } from '../hooks/useDashboard';
import { useProjections } from '../hooks/useProjections';
import { STATUS_CONFIG, ALL_STATUSES, PROJECTION_STATUSES, ACQUISITION_CONFIG, formatCOP, formatUSD } from '../lib/constants';
import type { ProposalStatus, AcquisitionType } from '../lib/types';
import BillingCards from './dashboard/BillingCards';
import ProjectionModal from './dashboard/ProjectionModal';
import TrmCards from './dashboard/TrmCards';
import DashboardFilters from './dashboard/DashboardFilters';

/** Format a subtotal with its currency label (COP or USD). */
function formatSubtotalWithCurrency(value: number, currency: 'COP' | 'USD' | null): string {
    if (currency === 'USD') return `USD ${formatUSD(value)}`;
    return `COP ${formatCOP(value)}`;
}

export default function Dashboard() {
    const navigate = useNavigate();
    const { user } = useAuthStore();

    const {
        loading, filtered, billingCardsVenta, billingCardsDaas, cloning, setProjections,
        trmRate, setTrmRate,
        trmCurrentMonthAvg, trmPreviousMonthAvg, isLoadingTrmAverages,
        showFilters, setShowFilters, searchTerm, setSearchTerm,
        statusFilters,
        hasActiveFilters,
        closeDateRange, setCloseDateRange,
        billingDateRange, setBillingDateRange,
        categoryFilter, setCategoryFilter,
        manufacturerFilter, setManufacturerFilter,
        subtotalUsdMin, setSubtotalUsdMin,
        subtotalUsdMax, setSubtotalUsdMax,
        acquisitionFilter, setAcquisitionFilter,
        manufacturerSuggestions,
        handleStatusChange, handleDateChange, handleClone, handleDelete,
        handleAcquisitionChange, handleProjectionAcquisitionChange,
        handleProjectionStatusChange, handleProjectionDateChange,
        toggleStatusFilter, clearFilters,
    } = useDashboard();

    const {
        showProjectionModal, setShowProjectionModal,
        editingProjection, projForm, setProjForm, savingProjection,
        openNewProjectionModal, openEditProjectionModal,
        handleSaveProjection, handleDeleteProjection,
    } = useProjections(setProjections);

    if (loading) {
        return (
            <div className="flex justify-center items-center py-20">
                <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-gray-900">
                        {user?.role === 'ADMIN' ? 'Resumen Global de Actividad' : 'Mis Propuestas'}
                    </h2>
                    <p className="text-gray-500 text-sm">
                        {user?.role === 'ADMIN' ? 'Métricas y propuestas de todo el equipo comercial.' : 'Gestiona tus cotizaciones y cierres.'}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {/* TRM Input */}
                    <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-1.5">
                        <label htmlFor="trm-input" className="text-[10px] font-bold uppercase tracking-wider text-gray-400 whitespace-nowrap">
                            TRM (COP/USD)
                        </label>
                        <input
                            id="trm-input"
                            type="number"
                            step="0.01"
                            value={trmRate ?? ''}
                            onChange={(e) => setTrmRate(e.target.value ? Number(e.target.value) : null)}
                            className="w-[100px] text-sm font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-2 py-1 text-right focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-300"
                            placeholder="—"
                        />
                    </div>
                    <button
                        onClick={openNewProjectionModal}
                        className="flex items-center space-x-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-violet-600/25"
                    >
                        <Receipt className="h-5 w-5" />
                        <span>Proyección de Facturación</span>
                    </button>
                    <button
                        onClick={() => navigate('/proposals/new')}
                        className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-indigo-600/25"
                    >
                        <PlusCircle className="h-5 w-5" />
                        <span>Nueva Propuesta</span>
                    </button>
                </div>
            </div>

            {/* TRM Cards */}
            <TrmCards
                trmRate={trmRate}
                trmCurrentMonthAvg={trmCurrentMonthAvg}
                trmPreviousMonthAvg={trmPreviousMonthAvg}
                isLoadingTrmAverages={isLoadingTrmAverages}
            />

            {/* Financial Cards */}
            <BillingCards billingCardsVenta={billingCardsVenta} billingCardsDaas={billingCardsDaas} />

            {/* Filter Toggle + Search */}
            <div className="flex items-center gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Buscar por código, cliente o asunto..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-300"
                    />
                </div>
                <button
                    onClick={() => setShowFilters(!showFilters)}
                    className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-colors ${showFilters || hasActiveFilters ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                >
                    <Filter className="h-4 w-4" />
                    <span>Filtros</span>
                    {hasActiveFilters && <span className="h-2 w-2 bg-indigo-500 rounded-full" />}
                </button>
                {hasActiveFilters && (
                    <button onClick={clearFilters} className="p-2.5 text-gray-400 hover:text-red-500 transition-colors">
                        <X className="h-4 w-4" />
                    </button>
                )}
            </div>

            {/* Collapsible Filters */}
            {showFilters && (
                <div className="space-y-4">
                    {/* Status filters row */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4 animate-in slide-in-from-top-2">
                        <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 block">Estado</label>
                            <div className="flex flex-wrap gap-2">
                                {ALL_STATUSES.map(s => {
                                    const cfg = STATUS_CONFIG[s];
                                    const active = statusFilters.has(s);
                                    return (
                                        <button
                                            key={s}
                                            onClick={() => toggleStatusFilter(s)}
                                            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide border transition-all ${active ? `${cfg.bg} ${cfg.text} ${cfg.border}` : 'bg-gray-50 text-gray-400 border-transparent hover:bg-gray-100'}`}
                                        >
                                            {cfg.label}
                                        </button>
                                    );
                                })}
                            </div>
                    </div>
                    </div>

                    {/* Advanced filters */}
                    <DashboardFilters
                        closeDateRange={closeDateRange}
                        onCloseDateRangeChange={setCloseDateRange}
                        billingDateRange={billingDateRange}
                        onBillingDateRangeChange={setBillingDateRange}
                        categoryFilter={categoryFilter}
                        onCategoryFilterChange={setCategoryFilter}
                        manufacturerFilter={manufacturerFilter}
                        onManufacturerFilterChange={setManufacturerFilter}
                        manufacturerSuggestions={manufacturerSuggestions}
                        subtotalUsdMin={subtotalUsdMin}
                        onSubtotalUsdMinChange={setSubtotalUsdMin}
                        subtotalUsdMax={subtotalUsdMax}
                        onSubtotalUsdMaxChange={setSubtotalUsdMax}
                        acquisitionFilter={acquisitionFilter}
                        onAcquisitionFilterChange={setAcquisitionFilter}
                        onClearAll={clearFilters}
                    />
                </div>
            )}

            {/* Proposals Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">
                        {filtered.length} Registro{filtered.length !== 1 ? 's' : ''}
                    </h3>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-gray-600">
                        <thead className="bg-gray-50 text-[10px] uppercase text-gray-400 font-bold tracking-wider border-b border-gray-100">
                            <tr>
                                <th className="px-5 py-3">Código</th>
                                <th className="px-4 py-3">Cliente / Asunto</th>
                                {user?.role === 'ADMIN' && <th className="px-4 py-3 text-center">Asesor</th>}
                                <th className="px-4 py-3 text-center">F. Cierre</th>
                                <th className="px-4 py-3 text-center">Actualización</th>
                                <th className="px-4 py-3 text-right">Subtotal Min.</th>
                                <th className="px-4 py-3 text-right">USD Est.</th>
                                <th className="px-4 py-3 text-center">Adquisición</th>
                                <th className="px-4 py-3 text-center">Estado</th>
                                <th className="px-4 py-3 text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={user?.role === 'ADMIN' ? 10 : 9} className="px-6 py-16 text-center text-gray-400">
                                        No hay propuestas que coincidan con los filtros.
                                    </td>
                                </tr>
                            ) : (
                                filtered.map((row) => {
                                    const usdEst = getSubtotalUsd(row.minSubtotal, row.minSubtotalCurrency, trmRate);

                                    if (row.isProjection) {
                                        // ── Projection Row ──
                                        const pr = row.originalProjection!;
                                        const cfg = STATUS_CONFIG[row.status];
                                        return (
                                            <tr key={`proj-${row.id}`} className="hover:bg-violet-50/30 transition-colors group bg-violet-50/10">
                                                <td className="px-5 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-mono font-black text-violet-600 text-xs">{row.code}</span>
                                                        <span className="text-[8px] font-bold uppercase bg-violet-100 text-violet-600 px-1.5 py-0.5 rounded-md border border-violet-200">PROY</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4">
                                                    <p className="font-bold text-gray-900 text-sm">{row.clientName}</p>
                                                    <p className="text-[10px] text-violet-400 mt-0.5">Proyección de facturación</p>
                                                </td>
                                                {user?.role === 'ADMIN' && (
                                                    <td className="px-4 py-4 text-center">
                                                        <span className="text-[10px] font-bold uppercase text-violet-600 bg-violet-50 px-2 py-1 rounded-lg border border-violet-100">
                                                            {pr.user?.nomenclature || '??'} - {pr.user?.name?.split(' ')[0]}
                                                        </span>
                                                    </td>
                                                )}
                                                <td className="px-4 py-4 text-center">
                                                    <span className="text-[10px] text-gray-300">—</span>
                                                </td>
                                                <td className="px-4 py-4 text-center text-[10px] text-gray-400 font-semibold">
                                                    {new Date(row.updatedAt).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: '2-digit' })}
                                                </td>
                                                <td className="px-4 py-4 text-right">
                                                    <span className="font-mono font-black text-xs text-emerald-700">
                                                        {formatSubtotalWithCurrency(Number(pr.subtotal), row.minSubtotalCurrency)}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-4 text-right">
                                                    {usdEst !== null ? (
                                                        <span className="font-mono font-black text-xs text-blue-700">USD {formatUSD(usdEst)}</span>
                                                    ) : (
                                                        <span className="text-[10px] text-gray-300">—</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-4 text-center">
                                                    <select
                                                        value={pr.acquisitionType || ''}
                                                        onChange={(e) => handleProjectionAcquisitionChange(row.id, e.target.value as AcquisitionType)}
                                                        className={`text-[10px] font-bold uppercase px-2 py-1.5 rounded-lg border cursor-pointer focus:ring-2 focus:ring-sky-600/20 ${
                                                            pr.acquisitionType && ACQUISITION_CONFIG[pr.acquisitionType]
                                                                ? `${ACQUISITION_CONFIG[pr.acquisitionType].bg} ${ACQUISITION_CONFIG[pr.acquisitionType].text} ${ACQUISITION_CONFIG[pr.acquisitionType].border}`
                                                                : 'bg-gray-50 text-gray-400 border-gray-200'
                                                        }`}
                                                    >
                                                        <option value="">— Seleccionar —</option>
                                                        <option value="VENTA">Venta</option>
                                                        <option value="DAAS">DaaS</option>
                                                    </select>
                                                </td>
                                                <td className="px-4 py-4 text-center">
                                                    <select
                                                        value={row.status}
                                                        onChange={(e) => handleProjectionStatusChange(row.id, e.target.value as ProposalStatus)}
                                                        className={`text-[10px] font-bold uppercase px-2 py-1.5 rounded-lg border ${cfg.bg} ${cfg.text} ${cfg.border} cursor-pointer focus:ring-2 focus:ring-violet-600/20`}
                                                    >
                                                        {PROJECTION_STATUSES.map(s => (
                                                            <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                                                        ))}
                                                    </select>
                                                    <div className="mt-2">
                                                        <span className="text-[9px] font-bold text-orange-500 uppercase tracking-wider block mb-0.5">Fecha de facturación</span>
                                                        <input
                                                            type="date"
                                                            value={pr.billingDate ? new Date(pr.billingDate).toISOString().split('T')[0] : ''}
                                                            onChange={(e) => handleProjectionDateChange(row.id, e.target.value)}
                                                            className="text-[10px] font-semibold text-orange-600 bg-orange-50 border border-orange-200 rounded-lg px-2 py-1 w-[130px]"
                                                        />
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4 text-center">
                                                    <div className="flex items-center justify-center space-x-1">
                                                        <button
                                                            onClick={() => openEditProjectionModal(pr)}
                                                            className="p-1.5 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-all"
                                                            title="Editar proyección"
                                                        >
                                                            <Edit2 className="h-3.5 w-3.5" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteProjection(row.id, row.code)}
                                                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                                            title="Eliminar proyección"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    }

                                    // ── Proposal Row (original logic) ──
                                    const p = row.originalProposal!;
                                    const cfg = STATUS_CONFIG[p.status];
                                    const needsBillingDate = p.status === 'PENDIENTE_FACTURAR' || p.status === 'FACTURADA';

                                    return (
                                        <tr key={p.id} className="hover:bg-gray-50/50 transition-colors group">
                                            <td className="px-5 py-4">
                                                <span className="font-mono font-black text-indigo-600 text-xs">{p.proposalCode}</span>
                                            </td>
                                            <td className="px-4 py-4">
                                                <p className="font-bold text-gray-900 text-sm">{p.clientName}</p>
                                                <p className="text-[10px] text-gray-400 mt-0.5 line-clamp-1" title={p.subject}>{p.subject}</p>
                                            </td>
                                            {user?.role === 'ADMIN' && (
                                                <td className="px-4 py-4 text-center">
                                                    <span className="text-[10px] font-bold uppercase text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg border border-indigo-100">
                                                        {p.user?.nomenclature || '??'} - {p.user?.name?.split(' ')[0]}
                                                    </span>
                                                </td>
                                            )}
                                            <td className="px-4 py-4 text-center">
                                                <input
                                                    type="date"
                                                    value={p.closeDate ? new Date(p.closeDate).toISOString().split('T')[0] : ''}
                                                    onChange={(e) => handleDateChange(p.id, 'closeDate', e.target.value)}
                                                    className="text-[11px] font-semibold text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 w-[120px]"
                                                />

                                            </td>
                                            <td className="px-4 py-4 text-center text-[10px] text-gray-400 font-semibold">
                                                {new Date(p.updatedAt).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: '2-digit' })}
                                            </td>
                                            <td className="px-4 py-4 text-right">
                                                {row.minSubtotal !== null ? (
                                                    <span className="font-mono font-black text-xs text-emerald-700">
                                                        {formatSubtotalWithCurrency(row.minSubtotal, row.minSubtotalCurrency)}
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] text-gray-300">Sin escenario</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-4 text-right">
                                                {usdEst !== null ? (
                                                    <span className="font-mono font-black text-xs text-blue-700">USD {formatUSD(usdEst)}</span>
                                                ) : (
                                                    <span className="text-[10px] text-gray-300">—</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-4 text-center">
                                                <select
                                                    value={p.acquisitionType || ''}
                                                    onChange={(e) => handleAcquisitionChange(p.id, e.target.value as AcquisitionType)}
                                                    className={`text-[10px] font-bold uppercase px-2 py-1.5 rounded-lg border cursor-pointer focus:ring-2 focus:ring-sky-600/20 ${
                                                        p.acquisitionType && ACQUISITION_CONFIG[p.acquisitionType]
                                                            ? `${ACQUISITION_CONFIG[p.acquisitionType].bg} ${ACQUISITION_CONFIG[p.acquisitionType].text} ${ACQUISITION_CONFIG[p.acquisitionType].border}`
                                                            : 'bg-gray-50 text-gray-400 border-gray-200'
                                                    }`}
                                                >
                                                    <option value="">— Seleccionar —</option>
                                                    <option value="VENTA">Venta</option>
                                                    <option value="DAAS">DaaS</option>
                                                </select>
                                            </td>
                                            <td className="px-4 py-4 text-center">
                                                <select
                                                    value={p.status}
                                                    onChange={(e) => handleStatusChange(p.id, e.target.value as ProposalStatus)}
                                                    className={`text-[10px] font-bold uppercase px-2 py-1.5 rounded-lg border ${cfg.bg} ${cfg.text} ${cfg.border} cursor-pointer focus:ring-2 focus:ring-indigo-600/20`}
                                                >
                                                    {ALL_STATUSES.map(s => (
                                                        <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                                                    ))}
                                                </select>
                                                {needsBillingDate && (
                                                    <div className="mt-2">
                                                        <span className="text-[9px] font-bold text-orange-500 uppercase tracking-wider block mb-0.5">Fecha de facturación</span>
                                                        <input
                                                            type="date"
                                                            value={p.billingDate ? new Date(p.billingDate).toISOString().split('T')[0] : ''}
                                                            onChange={(e) => handleDateChange(p.id, 'billingDate', e.target.value)}
                                                            className="text-[10px] font-semibold text-orange-600 bg-orange-50 border border-orange-200 rounded-lg px-2 py-1 w-[130px]"
                                                        />
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-4 py-4 text-center">
                                                <div className="flex items-center justify-center space-x-1">
                                                    <button
                                                        onClick={() => navigate(`/proposals/${p.id}/builder`)}
                                                        className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                                        title="Editar"
                                                    >
                                                        <Edit2 className="h-3.5 w-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleClone(p.id, 'NEW_VERSION')}
                                                        disabled={cloning === p.id}
                                                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                                        title="Clonar versión"
                                                    >
                                                        <Copy className="h-3.5 w-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleClone(p.id, 'NEW_PROPOSAL')}
                                                        disabled={cloning === p.id}
                                                        className="p-1.5 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-all"
                                                        title="Clonar como nueva propuesta"
                                                    >
                                                        <PlusCircle className="h-3.5 w-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(p.id, p.proposalCode || '')}
                                                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                                        title="Eliminar"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Projection Modal */}
            {showProjectionModal && (
                <ProjectionModal
                    editingProjection={editingProjection}
                    projForm={projForm}
                    setProjForm={setProjForm}
                    savingProjection={savingProjection}
                    onSave={handleSaveProjection}
                    onClose={() => setShowProjectionModal(false)}
                />
            )}
        </div>
    );
}
```

---

### 2. Thousands Separator Formatting for Monetary Inputs

#### [NEW] [format-utils.ts](file:///d:/novotechflow/apps/web/src/lib/format-utils.ts)

Two pure, testeable helper functions:

| Function | Input | Output |
|---|---|---|
| `formatNumberWithThousands` | `1234567` or `"1234567"` | `"1.234.567"` |
| `parseFormattedNumber` | `"1.234.567"` | `1234567` |

Uses Colombian standard: `.` as thousands separator, no decimal places.

```diff:format-utils.ts
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
```

#### [ProjectionModal.tsx](file:///d:/novotechflow/apps/web/src/pages/dashboard/ProjectionModal.tsx)

- Subtotal input: `type="number"` → `type="text"` + `inputMode="numeric"`
- Shows formatted value via `formatNumberWithThousands(projForm.subtotal)`
- `onChange` strips non-digits via `parseFormattedNumber`, stores raw number string
- `onFocus` selects all text for easy editing
- Placeholder: `"1.000.000"`

```diff:ProjectionModal.tsx
import { Loader2, Receipt, X } from 'lucide-react';
import type { ProjForm } from '../../hooks/useProjections';
import type { BillingProjection } from '../../lib/types';

interface ProjectionModalProps {
    editingProjection: BillingProjection | null;
    projForm: ProjForm;
    setProjForm: React.Dispatch<React.SetStateAction<ProjForm>>;
    savingProjection: boolean;
    onSave: () => void;
    onClose: () => void;
}

export default function ProjectionModal({
    editingProjection,
    projForm,
    setProjForm,
    savingProjection,
    onSave,
    onClose,
}: ProjectionModalProps) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-in zoom-in-95"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Modal Header */}
                <div className="bg-gradient-to-r from-violet-600 to-purple-600 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <Receipt className="h-5 w-5 text-white/80" />
                        <h3 className="text-lg font-bold text-white">
                            {editingProjection ? 'Editar Proyección' : 'Nueva Proyección de Facturación'}
                        </h3>
                    </div>
                    <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Modal Body */}
                <div className="p-6 space-y-5">
                    {/* Client Name */}
                    <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 block">Cliente</label>
                        <input
                            type="text"
                            value={projForm.clientName}
                            onChange={(e) => setProjForm(prev => ({ ...prev, clientName: e.target.value }))}
                            placeholder="Nombre del cliente"
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-800 focus:ring-2 focus:ring-violet-600/20 focus:border-violet-300 transition-all"
                            autoFocus
                        />
                    </div>

                    {/* Subtotal + Currency */}
                    <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 block">Subtotal</label>
                        <div className="flex gap-3">
                            <div className="relative flex-1">
                                <span className="absolute left-4 top-3 text-gray-400 font-bold text-sm">$</span>
                                <input
                                    type="number"
                                    value={projForm.subtotal}
                                    onChange={(e) => setProjForm(prev => ({ ...prev, subtotal: e.target.value }))}
                                    placeholder="0"
                                    className="w-full pl-8 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-800 focus:ring-2 focus:ring-violet-600/20 focus:border-violet-300 transition-all"
                                />
                            </div>
                            <div className="flex rounded-xl border border-gray-200 overflow-hidden">
                                <button
                                    type="button"
                                    onClick={() => setProjForm(prev => ({ ...prev, currency: 'COP' }))}
                                    className={`px-4 py-3 text-xs font-bold transition-all ${
                                        projForm.currency === 'COP'
                                            ? 'bg-violet-600 text-white shadow-inner'
                                            : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                                    }`}
                                >
                                    COP
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setProjForm(prev => ({ ...prev, currency: 'USD' }))}
                                    className={`px-4 py-3 text-xs font-bold transition-all ${
                                        projForm.currency === 'USD'
                                            ? 'bg-emerald-600 text-white shadow-inner'
                                            : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                                    }`}
                                >
                                    USD
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Status */}
                    <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 block">Estado</label>
                        <select
                            value={projForm.status}
                            onChange={(e) => setProjForm(prev => ({ ...prev, status: e.target.value as 'PENDIENTE_FACTURAR' | 'FACTURADA' }))}
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-800 focus:ring-2 focus:ring-violet-600/20 focus:border-violet-300 transition-all cursor-pointer"
                        >
                            <option value="PENDIENTE_FACTURAR">Pendiente Facturar</option>
                            <option value="FACTURADA">Facturada</option>
                        </select>
                    </div>

                    {/* Acquisition Type */}
                    <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 block">Adquisición</label>
                        <select
                            value={projForm.acquisitionType}
                            onChange={(e) => setProjForm(prev => ({ ...prev, acquisitionType: e.target.value as '' | 'VENTA' | 'DAAS' }))}
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-800 focus:ring-2 focus:ring-violet-600/20 focus:border-violet-300 transition-all cursor-pointer"
                        >
                            <option value="">— Seleccionar —</option>
                            <option value="VENTA">Venta</option>
                            <option value="DAAS">DaaS</option>
                        </select>
                    </div>

                    {/* Billing Date */}
                    <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 block">Fecha de Facturación</label>
                        <input
                            type="date"
                            value={projForm.billingDate}
                            onChange={(e) => setProjForm(prev => ({ ...prev, billingDate: e.target.value }))}
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-800 focus:ring-2 focus:ring-violet-600/20 focus:border-violet-300 transition-all"
                        />
                    </div>
                </div>

                {/* Modal Footer */}
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end space-x-3">
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 text-sm font-semibold text-gray-600 hover:text-gray-800 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={onSave}
                        disabled={savingProjection || !projForm.clientName.trim() || !projForm.subtotal}
                        className="flex items-center space-x-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-lg shadow-violet-600/25"
                    >
                        {savingProjection ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Receipt className="h-4 w-4" />
                        )}
                        <span>{editingProjection ? 'Guardar Cambios' : 'Crear Proyección'}</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
===
import { Loader2, Receipt, X } from 'lucide-react';
import type { ProjForm } from '../../hooks/useProjections';
import type { BillingProjection } from '../../lib/types';
import { formatNumberWithThousands, parseFormattedNumber } from '../../lib/format-utils';

interface ProjectionModalProps {
    editingProjection: BillingProjection | null;
    projForm: ProjForm;
    setProjForm: React.Dispatch<React.SetStateAction<ProjForm>>;
    savingProjection: boolean;
    onSave: () => void;
    onClose: () => void;
}

export default function ProjectionModal({
    editingProjection,
    projForm,
    setProjForm,
    savingProjection,
    onSave,
    onClose,
}: ProjectionModalProps) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-in zoom-in-95"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Modal Header */}
                <div className="bg-gradient-to-r from-violet-600 to-purple-600 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <Receipt className="h-5 w-5 text-white/80" />
                        <h3 className="text-lg font-bold text-white">
                            {editingProjection ? 'Editar Proyección' : 'Nueva Proyección de Facturación'}
                        </h3>
                    </div>
                    <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Modal Body */}
                <div className="p-6 space-y-5">
                    {/* Client Name */}
                    <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 block">Cliente</label>
                        <input
                            type="text"
                            value={projForm.clientName}
                            onChange={(e) => setProjForm(prev => ({ ...prev, clientName: e.target.value }))}
                            placeholder="Nombre del cliente"
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-800 focus:ring-2 focus:ring-violet-600/20 focus:border-violet-300 transition-all"
                            autoFocus
                        />
                    </div>

                    {/* Subtotal + Currency */}
                    <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 block">Subtotal</label>
                        <div className="flex gap-3">
                            <div className="relative flex-1">
                                <span className="absolute left-4 top-3 text-gray-400 font-bold text-sm">$</span>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    value={formatNumberWithThousands(projForm.subtotal)}
                                    onChange={(e) => {
                                        const numeric = parseFormattedNumber(e.target.value);
                                        setProjForm(prev => ({ ...prev, subtotal: numeric ? String(numeric) : '' }));
                                    }}
                                    onFocus={(e) => e.target.select()}
                                    placeholder="1.000.000"
                                    className="w-full pl-8 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-800 focus:ring-2 focus:ring-violet-600/20 focus:border-violet-300 transition-all"
                                />
                            </div>
                            <div className="flex rounded-xl border border-gray-200 overflow-hidden">
                                <button
                                    type="button"
                                    onClick={() => setProjForm(prev => ({ ...prev, currency: 'COP' }))}
                                    className={`px-4 py-3 text-xs font-bold transition-all ${
                                        projForm.currency === 'COP'
                                            ? 'bg-violet-600 text-white shadow-inner'
                                            : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                                    }`}
                                >
                                    COP
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setProjForm(prev => ({ ...prev, currency: 'USD' }))}
                                    className={`px-4 py-3 text-xs font-bold transition-all ${
                                        projForm.currency === 'USD'
                                            ? 'bg-emerald-600 text-white shadow-inner'
                                            : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                                    }`}
                                >
                                    USD
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Status */}
                    <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 block">Estado</label>
                        <select
                            value={projForm.status}
                            onChange={(e) => setProjForm(prev => ({ ...prev, status: e.target.value as 'PENDIENTE_FACTURAR' | 'FACTURADA' }))}
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-800 focus:ring-2 focus:ring-violet-600/20 focus:border-violet-300 transition-all cursor-pointer"
                        >
                            <option value="PENDIENTE_FACTURAR">Pendiente Facturar</option>
                            <option value="FACTURADA">Facturada</option>
                        </select>
                    </div>

                    {/* Acquisition Type */}
                    <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 block">Adquisición</label>
                        <select
                            value={projForm.acquisitionType}
                            onChange={(e) => setProjForm(prev => ({ ...prev, acquisitionType: e.target.value as '' | 'VENTA' | 'DAAS' }))}
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-800 focus:ring-2 focus:ring-violet-600/20 focus:border-violet-300 transition-all cursor-pointer"
                        >
                            <option value="">— Seleccionar —</option>
                            <option value="VENTA">Venta</option>
                            <option value="DAAS">DaaS</option>
                        </select>
                    </div>

                    {/* Billing Date */}
                    <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 block">Fecha de Facturación</label>
                        <input
                            type="date"
                            value={projForm.billingDate}
                            onChange={(e) => setProjForm(prev => ({ ...prev, billingDate: e.target.value }))}
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-800 focus:ring-2 focus:ring-violet-600/20 focus:border-violet-300 transition-all"
                        />
                    </div>
                </div>

                {/* Modal Footer */}
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end space-x-3">
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 text-sm font-semibold text-gray-600 hover:text-gray-800 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={onSave}
                        disabled={savingProjection || !projForm.clientName.trim() || !projForm.subtotal}
                        className="flex items-center space-x-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-lg shadow-violet-600/25"
                    >
                        {savingProjection ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Receipt className="h-4 w-4" />
                        )}
                        <span>{editingProjection ? 'Guardar Cambios' : 'Crear Proyección'}</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
```

#### [DashboardFilters.tsx](file:///d:/novotechflow/apps/web/src/pages/dashboard/DashboardFilters.tsx)

- USD Mín / USD Máx inputs: same pattern as ProjectionModal
- Local `handleChange` helper to avoid duplication between min and max
- Both inputs: `type="text"` + `inputMode="numeric"`, formatted display, raw state

```diff:DashboardFilters.tsx
import { Calendar, Tag, Factory, DollarSign, ShoppingCart, X } from 'lucide-react';
import { ITEM_TYPE_LABELS, ACQUISITION_CONFIG } from '../../lib/constants';
import type { ItemType, AcquisitionType } from '../../lib/types';

// ── Types ────────────────────────────────────────────────────

export interface DateRange {
    from: string;
    to: string;
}

export interface DashboardFiltersProps {
    closeDateRange: DateRange;
    onCloseDateRangeChange: (range: DateRange) => void;
    billingDateRange: DateRange;
    onBillingDateRangeChange: (range: DateRange) => void;
    categoryFilter: Set<ItemType>;
    onCategoryFilterChange: (categories: Set<ItemType>) => void;
    manufacturerFilter: string;
    onManufacturerFilterChange: (value: string) => void;
    manufacturerSuggestions: string[];
    subtotalUsdMin: string;
    onSubtotalUsdMinChange: (value: string) => void;
    subtotalUsdMax: string;
    onSubtotalUsdMaxChange: (value: string) => void;
    acquisitionFilter: AcquisitionType | 'ALL';
    onAcquisitionFilterChange: (value: AcquisitionType | 'ALL') => void;
    onClearAll: () => void;
}

// ── Constants ────────────────────────────────────────────────

const ALL_ITEM_TYPES: ItemType[] = ['PCS', 'ACCESSORIES', 'PC_SERVICES', 'SOFTWARE', 'INFRASTRUCTURE', 'INFRA_SERVICES'];

const LABEL_CLASSES = 'text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 block';
const INPUT_CLASSES = 'w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-300 transition-colors';

// ── Quarter helpers ──────────────────────────────────────────

function getQuarterRange(quarter: number): DateRange {
    const year = new Date().getFullYear();
    const startMonth = (quarter - 1) * 3;
    const endMonth = startMonth + 2;
    const lastDay = new Date(year, endMonth + 1, 0).getDate();

    const pad = (n: number) => String(n + 1).padStart(2, '0');
    return {
        from: `${year}-${pad(startMonth)}-01`,
        to: `${year}-${pad(endMonth)}-${String(lastDay).padStart(2, '0')}`,
    };
}

const QUARTER_BUTTONS = [1, 2, 3, 4] as const;

// ── Sub-components ───────────────────────────────────────────

function DateRangeFilter({ label, icon: Icon, range, onChange }: {
    label: string;
    icon: typeof Calendar;
    range: DateRange;
    onChange: (range: DateRange) => void;
}) {
    return (
        <div>
            <label className={LABEL_CLASSES}>
                <Icon className="inline h-3 w-3 mr-1 -mt-0.5" />{label}
            </label>
            <div className="flex items-center gap-2">
                <input
                    type="date"
                    value={range.from}
                    onChange={(e) => onChange({ ...range, from: e.target.value })}
                    className={INPUT_CLASSES}
                    placeholder="Desde"
                />
                <span className="text-gray-300 text-xs font-bold">→</span>
                <input
                    type="date"
                    value={range.to}
                    onChange={(e) => onChange({ ...range, to: e.target.value })}
                    className={INPUT_CLASSES}
                    placeholder="Hasta"
                />
            </div>
            <div className="flex gap-1.5 mt-2">
                {QUARTER_BUTTONS.map(q => (
                    <button
                        key={q}
                        onClick={() => onChange(getQuarterRange(q))}
                        className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide bg-gray-50 text-gray-500 border border-gray-200 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-colors"
                    >
                        Q{q}
                    </button>
                ))}
            </div>
        </div>
    );
}

function CategoryFilter({ selected, onChange }: {
    selected: Set<ItemType>;
    onChange: (categories: Set<ItemType>) => void;
}) {
    const toggleCategory = (type: ItemType) => {
        const next = new Set(selected);
        if (next.has(type)) next.delete(type);
        else next.add(type);
        onChange(next);
    };

    return (
        <div>
            <label className={LABEL_CLASSES}>
                <Tag className="inline h-3 w-3 mr-1 -mt-0.5" />Categoría de ítems
            </label>
            <div className="flex flex-wrap gap-1.5">
                {ALL_ITEM_TYPES.map(type => {
                    const isActive = selected.has(type);
                    return (
                        <button
                            key={type}
                            onClick={() => toggleCategory(type)}
                            className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide border transition-all ${
                                isActive
                                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                    : 'bg-gray-50 text-gray-400 border-transparent hover:bg-gray-100'
                            }`}
                        >
                            {ITEM_TYPE_LABELS[type] ?? type}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

function ManufacturerFilter({ value, onChange, suggestions }: {
    value: string;
    onChange: (value: string) => void;
    suggestions: string[];
}) {
    return (
        <div>
            <label className={LABEL_CLASSES}>
                <Factory className="inline h-3 w-3 mr-1 -mt-0.5" />Fabricante / Responsable
            </label>
            <input
                type="text"
                list="manufacturer-suggestions"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder="Buscar fabricante o responsable..."
                className={INPUT_CLASSES}
            />
            <datalist id="manufacturer-suggestions">
                {suggestions.map(s => (
                    <option key={s} value={s} />
                ))}
            </datalist>
        </div>
    );
}

function SubtotalUsdFilter({ min, max, onMinChange, onMaxChange }: {
    min: string;
    max: string;
    onMinChange: (value: string) => void;
    onMaxChange: (value: string) => void;
}) {
    return (
        <div>
            <label className={LABEL_CLASSES}>
                <DollarSign className="inline h-3 w-3 mr-1 -mt-0.5" />Rango USD Est.
            </label>
            <div className="flex items-center gap-2">
                <input
                    type="number"
                    placeholder="USD Mín"
                    value={min}
                    onChange={(e) => onMinChange(e.target.value)}
                    className={INPUT_CLASSES}
                />
                <span className="text-gray-300 text-xs font-bold">→</span>
                <input
                    type="number"
                    placeholder="USD Máx"
                    value={max}
                    onChange={(e) => onMaxChange(e.target.value)}
                    className={INPUT_CLASSES}
                />
            </div>
        </div>
    );
}

function AcquisitionFilter({ value, onChange }: {
    value: AcquisitionType | 'ALL';
    onChange: (value: AcquisitionType | 'ALL') => void;
}) {
    const options: { key: AcquisitionType | 'ALL'; label: string }[] = [
        { key: 'ALL', label: 'Todos' },
        { key: 'VENTA', label: ACQUISITION_CONFIG.VENTA.label },
        { key: 'DAAS', label: ACQUISITION_CONFIG.DAAS.label },
    ];

    return (
        <div>
            <label className={LABEL_CLASSES}>
                <ShoppingCart className="inline h-3 w-3 mr-1 -mt-0.5" />Tipo de adquisición
            </label>
            <div className="flex gap-1.5">
                {options.map(opt => {
                    const isActive = value === opt.key;
                    return (
                        <button
                            key={opt.key}
                            onClick={() => onChange(opt.key)}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide border transition-all ${
                                isActive
                                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                    : 'bg-gray-50 text-gray-400 border-transparent hover:bg-gray-100'
                            }`}
                        >
                            {opt.label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

// ── Main Component ───────────────────────────────────────────

export default function DashboardFilters(props: DashboardFiltersProps) {
    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-5 animate-in slide-in-from-top-2">
            <div className="flex items-center justify-between">
                <h4 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">
                    Filtros Avanzados
                </h4>
                <button
                    onClick={props.onClearAll}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide text-red-500 bg-red-50 border border-red-200 hover:bg-red-100 transition-colors"
                >
                    <X className="h-3 w-3" />
                    Limpiar filtros
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {/* Date Range Filters */}
                <DateRangeFilter
                    label="Fecha de cierre"
                    icon={Calendar}
                    range={props.closeDateRange}
                    onChange={props.onCloseDateRangeChange}
                />
                <DateRangeFilter
                    label="Fecha de facturación"
                    icon={Calendar}
                    range={props.billingDateRange}
                    onChange={props.onBillingDateRangeChange}
                />

                {/* USD Subtotal Range */}
                <SubtotalUsdFilter
                    min={props.subtotalUsdMin}
                    max={props.subtotalUsdMax}
                    onMinChange={props.onSubtotalUsdMinChange}
                    onMaxChange={props.onSubtotalUsdMaxChange}
                />

                {/* Category + Manufacturer + Acquisition */}
                <CategoryFilter
                    selected={props.categoryFilter}
                    onChange={props.onCategoryFilterChange}
                />
                <ManufacturerFilter
                    value={props.manufacturerFilter}
                    onChange={props.onManufacturerFilterChange}
                    suggestions={props.manufacturerSuggestions}
                />
                <AcquisitionFilter
                    value={props.acquisitionFilter}
                    onChange={props.onAcquisitionFilterChange}
                />
            </div>
        </div>
    );
}
===
import { Calendar, Tag, Factory, DollarSign, ShoppingCart, X } from 'lucide-react';
import { ITEM_TYPE_LABELS, ACQUISITION_CONFIG } from '../../lib/constants';
import { formatNumberWithThousands, parseFormattedNumber } from '../../lib/format-utils';
import type { ItemType, AcquisitionType } from '../../lib/types';

// ── Types ────────────────────────────────────────────────────

export interface DateRange {
    from: string;
    to: string;
}

export interface DashboardFiltersProps {
    closeDateRange: DateRange;
    onCloseDateRangeChange: (range: DateRange) => void;
    billingDateRange: DateRange;
    onBillingDateRangeChange: (range: DateRange) => void;
    categoryFilter: Set<ItemType>;
    onCategoryFilterChange: (categories: Set<ItemType>) => void;
    manufacturerFilter: string;
    onManufacturerFilterChange: (value: string) => void;
    manufacturerSuggestions: string[];
    subtotalUsdMin: string;
    onSubtotalUsdMinChange: (value: string) => void;
    subtotalUsdMax: string;
    onSubtotalUsdMaxChange: (value: string) => void;
    acquisitionFilter: AcquisitionType | 'ALL';
    onAcquisitionFilterChange: (value: AcquisitionType | 'ALL') => void;
    onClearAll: () => void;
}

// ── Constants ────────────────────────────────────────────────

const ALL_ITEM_TYPES: ItemType[] = ['PCS', 'ACCESSORIES', 'PC_SERVICES', 'SOFTWARE', 'INFRASTRUCTURE', 'INFRA_SERVICES'];

const LABEL_CLASSES = 'text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 block';
const INPUT_CLASSES = 'w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-300 transition-colors';

// ── Quarter helpers ──────────────────────────────────────────

function getQuarterRange(quarter: number): DateRange {
    const year = new Date().getFullYear();
    const startMonth = (quarter - 1) * 3;
    const endMonth = startMonth + 2;
    const lastDay = new Date(year, endMonth + 1, 0).getDate();

    const pad = (n: number) => String(n + 1).padStart(2, '0');
    return {
        from: `${year}-${pad(startMonth)}-01`,
        to: `${year}-${pad(endMonth)}-${String(lastDay).padStart(2, '0')}`,
    };
}

const QUARTER_BUTTONS = [1, 2, 3, 4] as const;

// ── Sub-components ───────────────────────────────────────────

function DateRangeFilter({ label, icon: Icon, range, onChange }: {
    label: string;
    icon: typeof Calendar;
    range: DateRange;
    onChange: (range: DateRange) => void;
}) {
    return (
        <div>
            <label className={LABEL_CLASSES}>
                <Icon className="inline h-3 w-3 mr-1 -mt-0.5" />{label}
            </label>
            <div className="flex items-center gap-2">
                <input
                    type="date"
                    value={range.from}
                    onChange={(e) => onChange({ ...range, from: e.target.value })}
                    className={INPUT_CLASSES}
                    placeholder="Desde"
                />
                <span className="text-gray-300 text-xs font-bold">→</span>
                <input
                    type="date"
                    value={range.to}
                    onChange={(e) => onChange({ ...range, to: e.target.value })}
                    className={INPUT_CLASSES}
                    placeholder="Hasta"
                />
            </div>
            <div className="flex gap-1.5 mt-2">
                {QUARTER_BUTTONS.map(q => (
                    <button
                        key={q}
                        onClick={() => onChange(getQuarterRange(q))}
                        className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide bg-gray-50 text-gray-500 border border-gray-200 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-colors"
                    >
                        Q{q}
                    </button>
                ))}
            </div>
        </div>
    );
}

function CategoryFilter({ selected, onChange }: {
    selected: Set<ItemType>;
    onChange: (categories: Set<ItemType>) => void;
}) {
    const toggleCategory = (type: ItemType) => {
        const next = new Set(selected);
        if (next.has(type)) next.delete(type);
        else next.add(type);
        onChange(next);
    };

    return (
        <div>
            <label className={LABEL_CLASSES}>
                <Tag className="inline h-3 w-3 mr-1 -mt-0.5" />Categoría de ítems
            </label>
            <div className="flex flex-wrap gap-1.5">
                {ALL_ITEM_TYPES.map(type => {
                    const isActive = selected.has(type);
                    return (
                        <button
                            key={type}
                            onClick={() => toggleCategory(type)}
                            className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide border transition-all ${
                                isActive
                                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                    : 'bg-gray-50 text-gray-400 border-transparent hover:bg-gray-100'
                            }`}
                        >
                            {ITEM_TYPE_LABELS[type] ?? type}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

function ManufacturerFilter({ value, onChange, suggestions }: {
    value: string;
    onChange: (value: string) => void;
    suggestions: string[];
}) {
    return (
        <div>
            <label className={LABEL_CLASSES}>
                <Factory className="inline h-3 w-3 mr-1 -mt-0.5" />Fabricante / Responsable
            </label>
            <input
                type="text"
                list="manufacturer-suggestions"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder="Buscar fabricante o responsable..."
                className={INPUT_CLASSES}
            />
            <datalist id="manufacturer-suggestions">
                {suggestions.map(s => (
                    <option key={s} value={s} />
                ))}
            </datalist>
        </div>
    );
}

function SubtotalUsdFilter({ min, max, onMinChange, onMaxChange }: {
    min: string;
    max: string;
    onMinChange: (value: string) => void;
    onMaxChange: (value: string) => void;
}) {
    const handleChange = (raw: string, setter: (value: string) => void) => {
        const numeric = parseFormattedNumber(raw);
        setter(numeric ? String(numeric) : '');
    };

    return (
        <div>
            <label className={LABEL_CLASSES}>
                <DollarSign className="inline h-3 w-3 mr-1 -mt-0.5" />Rango USD Est.
            </label>
            <div className="flex items-center gap-2">
                <input
                    type="text"
                    inputMode="numeric"
                    placeholder="1.000.000"
                    value={formatNumberWithThousands(min)}
                    onChange={(e) => handleChange(e.target.value, onMinChange)}
                    onFocus={(e) => e.target.select()}
                    className={INPUT_CLASSES}
                />
                <span className="text-gray-300 text-xs font-bold">→</span>
                <input
                    type="text"
                    inputMode="numeric"
                    placeholder="1.000.000"
                    value={formatNumberWithThousands(max)}
                    onChange={(e) => handleChange(e.target.value, onMaxChange)}
                    onFocus={(e) => e.target.select()}
                    className={INPUT_CLASSES}
                />
            </div>
        </div>
    );
}

function AcquisitionFilter({ value, onChange }: {
    value: AcquisitionType | 'ALL';
    onChange: (value: AcquisitionType | 'ALL') => void;
}) {
    const options: { key: AcquisitionType | 'ALL'; label: string }[] = [
        { key: 'ALL', label: 'Todos' },
        { key: 'VENTA', label: ACQUISITION_CONFIG.VENTA.label },
        { key: 'DAAS', label: ACQUISITION_CONFIG.DAAS.label },
    ];

    return (
        <div>
            <label className={LABEL_CLASSES}>
                <ShoppingCart className="inline h-3 w-3 mr-1 -mt-0.5" />Tipo de adquisición
            </label>
            <div className="flex gap-1.5">
                {options.map(opt => {
                    const isActive = value === opt.key;
                    return (
                        <button
                            key={opt.key}
                            onClick={() => onChange(opt.key)}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide border transition-all ${
                                isActive
                                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                    : 'bg-gray-50 text-gray-400 border-transparent hover:bg-gray-100'
                            }`}
                        >
                            {opt.label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

// ── Main Component ───────────────────────────────────────────

export default function DashboardFilters(props: DashboardFiltersProps) {
    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-5 animate-in slide-in-from-top-2">
            <div className="flex items-center justify-between">
                <h4 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">
                    Filtros Avanzados
                </h4>
                <button
                    onClick={props.onClearAll}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide text-red-500 bg-red-50 border border-red-200 hover:bg-red-100 transition-colors"
                >
                    <X className="h-3 w-3" />
                    Limpiar filtros
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {/* Date Range Filters */}
                <DateRangeFilter
                    label="Fecha de cierre"
                    icon={Calendar}
                    range={props.closeDateRange}
                    onChange={props.onCloseDateRangeChange}
                />
                <DateRangeFilter
                    label="Fecha de facturación"
                    icon={Calendar}
                    range={props.billingDateRange}
                    onChange={props.onBillingDateRangeChange}
                />

                {/* USD Subtotal Range */}
                <SubtotalUsdFilter
                    min={props.subtotalUsdMin}
                    max={props.subtotalUsdMax}
                    onMinChange={props.onSubtotalUsdMinChange}
                    onMaxChange={props.onSubtotalUsdMaxChange}
                />

                {/* Category + Manufacturer + Acquisition */}
                <CategoryFilter
                    selected={props.categoryFilter}
                    onChange={props.onCategoryFilterChange}
                />
                <ManufacturerFilter
                    value={props.manufacturerFilter}
                    onChange={props.onManufacturerFilterChange}
                    suggestions={props.manufacturerSuggestions}
                />
                <AcquisitionFilter
                    value={props.acquisitionFilter}
                    onChange={props.onAcquisitionFilterChange}
                />
            </div>
        </div>
    );
}
```

---

## What Was NOT Touched
- ✅ Backend — no changes
- ✅ Billing cards — untouched
- ✅ Pricing engine — untouched
- ✅ Advanced filter state (`subtotalUsdMin`/`subtotalUsdMax`) — intact, only the UI display format changed
- ✅ TRM input — left as `type="number"` (decimal values, not integer money)

## Validation
- All files verified manually for correct references
- `tsc --noEmit` could not run due to sandbox restrictions — manual verification confirms no stale references to `subtotalMin`/`subtotalMax` remain
