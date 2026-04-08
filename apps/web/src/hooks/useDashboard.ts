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

export interface PipelineByStatus {
    status: ProposalStatus;
    currentQuarter: number;
    nextQuarter: number;
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

/** Statuses displayed in the pipeline cards. */
const PIPELINE_STATUSES: ProposalStatus[] = ['ELABORACION', 'PROPUESTA', 'GANADA', 'PERDIDA'];

/** Statuses that count towards the active forecast (not yet won/lost). */
const FORECAST_STATUSES: ProposalStatus[] = ['ELABORACION', 'PROPUESTA'];

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

/** Parse ISO date → { quarter (1-4), year } for pipeline grouping. */
function getQuarter(dateStr: string): { quarter: number; year: number } {
    const { month, year } = parseDate(dateStr);
    return { quarter: Math.floor(month / 3) + 1, year };
}

/** Resolve the current and next quarter numbers (1-4) and their years. */
function resolveCurrentAndNextQuarter(): {
    currentQ: number; currentQYear: number;
    nextQ: number; nextQYear: number;
} {
    const now = new Date();
    const currentQ = Math.floor(now.getMonth() / 3) + 1;
    const currentQYear = now.getFullYear();
    const nextQ = currentQ === 4 ? 1 : currentQ + 1;
    const nextQYear = currentQ === 4 ? currentQYear + 1 : currentQYear;
    return { currentQ, currentQYear, nextQ, nextQYear };
}

/** Compute billing cards from already-filtered DashboardRows for one acquisition type. */
function computeBillingCards(
    rows: DashboardRow[],
    acqType: AcquisitionType,
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

    const acqRows = rows.filter(r => r.acquisitionType === acqType);

    for (const row of acqRows) {
        const sub = getSubtotalUsd(row.minSubtotal, row.minSubtotalCurrency, trmRate) ?? 0;

        if (row.status === 'FACTURADA' && row.billingDate) {
            const { month, year } = parseDate(row.billingDate);
            if (month === prevMonth && year === prevMonthYear) facturadoMesAnterior += sub;
            if (month === thisMonth && year === thisYear) facturadoMesActual += sub;
            if (Math.floor(month / 3) === currentQuarter && year === thisYear) facturadoTrimestreActual += sub;
        }

        if (row.status === 'PENDIENTE_FACTURAR' && row.billingDate) {
            const { month, year } = parseDate(row.billingDate);
            if (Math.floor(month / 3) === currentQuarter && year === thisYear) facturadoTrimestreActual += sub;
            if (Math.floor(month / 3) === nextQuarter && year === nextQuarterYear) proyeccionTrimestreSiguiente += sub;
            if (month === thisMonth && year === thisYear) pendFactMesActual += sub;
            if (month === nextMonth && year === nextMonthYear) pendFactMesSiguiente += sub;
        }

        if (row.status === 'GANADA' && row.closeDate) {
            const { month, year } = parseDate(row.closeDate);
            if (Math.floor(month / 3) === nextQuarter && year === nextQuarterYear) proyeccionTrimestreSiguiente += sub;
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

    // ── Billing summary cards per acquisition type (from filtered rows, in USD) ──
    const billingCardsVenta: BillingCards = useMemo(
        () => computeBillingCards(filtered, 'VENTA', trmRate),
        [filtered, trmRate],
    );

    const billingCardsDaas: BillingCards = useMemo(
        () => computeBillingCards(filtered, 'DAAS', trmRate),
        [filtered, trmRate],
    );

    // ── Pipeline cards per status + forecast (from filtered rows, in USD) ──
    const { pipelineCards, forecastCurrentQuarter, forecastNextQuarter } = useMemo(() => {
        const { currentQ, currentQYear, nextQ, nextQYear } = resolveCurrentAndNextQuarter();

        const cardsByStatus: PipelineByStatus[] = PIPELINE_STATUSES.map(status => {
            let currentQuarterSum = 0;
            let nextQuarterSum = 0;

            for (const row of filtered) {
                if (row.status !== status || !row.closeDate) continue;
                const usd = getSubtotalUsd(row.minSubtotal, row.minSubtotalCurrency, trmRate) ?? 0;
                const { quarter, year } = getQuarter(row.closeDate);

                if (quarter === currentQ && year === currentQYear) currentQuarterSum += usd;
                if (quarter === nextQ && year === nextQYear) nextQuarterSum += usd;
            }

            return { status, currentQuarter: currentQuarterSum, nextQuarter: nextQuarterSum };
        });

        const forecastCards = cardsByStatus.filter(c => FORECAST_STATUSES.includes(c.status));
        const fcCurrentQ = forecastCards.reduce((sum, c) => sum + c.currentQuarter, 0);
        const fcNextQ = forecastCards.reduce((sum, c) => sum + c.nextQuarter, 0);

        return {
            pipelineCards: cardsByStatus,
            forecastCurrentQuarter: fcCurrentQ,
            forecastNextQuarter: fcNextQ,
        };
    }, [filtered, trmRate]);

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
        pipelineCards,
        forecastCurrentQuarter,
        forecastNextQuarter,
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
