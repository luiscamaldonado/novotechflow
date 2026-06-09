import { useState, useEffect, useMemo } from 'react';
import { api } from '../lib/api';
import { TRM_API_URL } from '../lib/constants';
import { getDashboardAmount, type MinSubtotalResult } from '../lib/pricing-engine';
import { groupProposalRows, type ProposalVersionGroup } from '../lib/proposalGrouping';
import { getTrmMonthlyAverage } from '../lib/trm-service';
import { parseMultiValueFilter, matchesAnyTerm } from '../lib/filter-utils';
import { findBoardHygieneIssues, type ProposalHygieneInput, type ProposalHygieneIssues } from '../lib/dashboardValidation';
import type { ProposalSummary, ProposalStatus, BillingProjection, AcquisitionType, ItemType } from '../lib/types';
import type { DateRange } from '../pages/dashboard/DashboardFilters';

// â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type CurrencyCode = 'COP' | 'USD';

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
    isManual?: boolean;
    status: ProposalStatus;
    isLocked?: boolean;
    closeDate?: string | null;
    billingDate?: string | null;
    acquisitionType?: AcquisitionType | null;
    updatedAt: string;
    createdAt?: string;
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

// â”€â”€ Pure helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Convert a subtotal to USD.
 * - If already in USD â†’ return as-is.
 * - If COP and trmRate > 0 â†’ divide.
 * - Otherwise â†’ null.
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

/** Parse ISO date â†’ { month (0-indexed), year } without timezone shift. */
function parseDate(dateStr: string): { month: number; year: number } {
    const [datePart] = dateStr.split('T');
    const [y, m] = datePart.split('-').map(Number);
    return { month: m - 1, year: y };
}

/** Parse ISO date â†’ { quarter (1-4), year } for pipeline grouping. */
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

// â”€â”€ Hook â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
    const [codeFilter, setCodeFilter] = useState('');
    const [clientFilter, setClientFilter] = useState('');
    const [subjectFilter, setSubjectFilter] = useState('');
    const [statusFilters, setStatusFilters] = useState<Set<ProposalStatus>>(new Set());


    // Advanced filter state
    const [closeDateRange, setCloseDateRange] = useState<DateRange>({ from: '', to: '' });
    const [billingDateRange, setBillingDateRange] = useState<DateRange>({ from: '', to: '' });
    const [categoryFilter, setCategoryFilter] = useState<Set<ItemType>>(new Set());
    const [manufacturerFilter, setManufacturerFilter] = useState('');
    const [subtotalUsdMin, setSubtotalUsdMin] = useState('');
    const [subtotalUsdMax, setSubtotalUsdMax] = useState('');
    const [acquisitionFilter, setAcquisitionFilter] = useState<AcquisitionType | 'ALL'>('ALL');
    const [userFilter, setUserFilter] = useState('');
    const [closeMonthFilter, setCloseMonthFilter] = useState<Set<number>>(new Set());
    const [billingMonthFilter, setBillingMonthFilter] = useState<Set<number>>(new Set());

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

    // â”€â”€ Computed values â”€â”€
    const proposalsWithSubtotals = useMemo(() => {
        return proposals.map(p => {
            const { subtotal, currency, isManual } = getDashboardAmount(p);
            return { ...p, subtotal, currency, isManual };
        });
    }, [proposals]);

    // â”€â”€ Unified rows (proposals + projections) â”€â”€
    const allRows: DashboardRow[] = useMemo(() => {
        const proposalRows: DashboardRow[] = proposalsWithSubtotals.map(p => ({
            id: p.id,
            code: p.proposalCode,
            clientName: p.clientName,
            subject: p.subject,
            minSubtotal: p.subtotal,
            minSubtotalCurrency: p.currency,
            isManual: p.isManual,
            status: p.status,
            isLocked: p.isLocked,
            closeDate: p.closeDate,
            billingDate: p.billingDate,
            acquisitionType: p.acquisitionType,
            updatedAt: p.updatedAt,
            createdAt: p.createdAt,
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
        const codeTerms = parseMultiValueFilter(codeFilter);
        const clientTerms = parseMultiValueFilter(clientFilter);
        const subjectTerms = parseMultiValueFilter(subjectFilter);
        const userTerms = parseMultiValueFilter(userFilter);
        const currentYear = new Date().getFullYear();

        return allRows.filter(row => {
            // Independent multi-value text filters (OR within field, AND across fields)
            if (!matchesAnyTerm(row.code ?? '', codeTerms)) return false;
            if (!matchesAnyTerm(row.clientName, clientTerms)) return false;
            if (!matchesAnyTerm(row.subject, subjectTerms)) return false;

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

            // Close month — solo año en curso. Se extrae del string ISO (sin new Date) para evitar desfase de timezone.
            if (closeMonthFilter.size > 0) {
                const raw = row.closeDate;
                if (!raw) return false;
                const dateStr = raw.split('T')[0];
                if (Number(dateStr.slice(0, 4)) !== currentYear) return false;
                if (!closeMonthFilter.has(Number(dateStr.slice(5, 7)))) return false;
            }

            // Billing date range
            if (billingDateRange.from || billingDateRange.to) {
                const raw = row.billingDate;
                if (!raw) return false;
                const dateStr = raw.split('T')[0];
                if (billingDateRange.from && dateStr < billingDateRange.from) return false;
                if (billingDateRange.to && dateStr > billingDateRange.to) return false;
            }

            // Billing month — solo año en curso
            if (billingMonthFilter.size > 0) {
                const raw = row.billingDate;
                if (!raw) return false;
                const dateStr = raw.split('T')[0];
                if (Number(dateStr.slice(0, 4)) !== currentYear) return false;
                if (!billingMonthFilter.has(Number(dateStr.slice(5, 7)))) return false;
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

            // User (commercial advisor) - multi-value
            if (!matchesAnyTerm(row.user?.name ?? '', userTerms)) return false;

            return true;
        });
    }, [
        allRows, codeFilter, clientFilter, subjectFilter, statusFilters,
        closeDateRange, billingDateRange, closeMonthFilter, billingMonthFilter, categoryFilter, manufacturerFilter,
        subtotalUsdMin, subtotalUsdMax, acquisitionFilter, userFilter, trmRate,
    ]);

    // ── Version grouping: only active version per proposal counts for cards/pipeline ──
    const proposalGroups: ProposalVersionGroup<DashboardRow>[] = useMemo(
        () => groupProposalRows(filtered.filter(r => !r.isProjection)),
        [filtered],
    );

    const allProposalGroups: ProposalVersionGroup<DashboardRow>[] = useMemo(
        () => groupProposalRows(allRows.filter(r => !r.isProjection)),
        [allRows],
    );

    const filteredProjectionRows: DashboardRow[] = useMemo(
        () => filtered.filter(r => r.isProjection),
        [filtered],
    );

    const activeRows: DashboardRow[] = useMemo(
        () => [...proposalGroups.map(g => g.activeVersion), ...filteredProjectionRows],
        [proposalGroups, filteredProjectionRows],
    );

    // ── Billing summary cards per acquisition type (from active rows, in USD) ──
    const billingCardsVenta: BillingCards = useMemo(
        () => computeBillingCards(activeRows, 'VENTA', trmRate),
        [activeRows, trmRate],
    );

    const billingCardsDaas: BillingCards = useMemo(
        () => computeBillingCards(activeRows, 'DAAS', trmRate),
        [activeRows, trmRate],
    );

    // â”€â”€ Pipeline cards per status + forecast (from active rows, in USD) â”€â”€
    const { pipelineCards, forecastCurrentQuarter, forecastNextQuarter } = useMemo(() => {
        const { currentQ, currentQYear, nextQ, nextQYear } = resolveCurrentAndNextQuarter();

        const cardsByStatus: PipelineByStatus[] = PIPELINE_STATUSES.map(status => {
            let currentQuarterSum = 0;
            let nextQuarterSum = 0;

            for (const row of activeRows) {
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
    }, [activeRows, trmRate]);

    // â”€â”€ Actions â”€â”€
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

    const getBoardHygieneIssues = (): ProposalHygieneIssues[] => {
        const activeProposals: ProposalHygieneInput[] = allProposalGroups
            .map(group => group.activeVersion.originalProposal)
            .filter((proposal): proposal is ProposalWithSubtotal => Boolean(proposal))
            .filter(proposal => !proposal.isLocked)
            .map(proposal => ({
                id: proposal.id,
                proposalCode: proposal.proposalCode,
                status: proposal.status,
                closeDate: proposal.closeDate ?? null,
                billingDate: proposal.billingDate ?? null,
                acquisitionType: proposal.acquisitionType ?? null,
                createdAt: proposal.createdAt,
            }));
        return findBoardHygieneIssues(activeProposals);
    };

    const handleDelete = async (id: string, code: string) => {
        if (!window.confirm(`\u00bfEliminar la propuesta ${code}?`)) return;

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
        setCodeFilter('');
        setClientFilter('');
        setSubjectFilter('');
        setStatusFilters(new Set());
        setCloseDateRange({ from: '', to: '' });
        setBillingDateRange({ from: '', to: '' });
        setCategoryFilter(new Set());
        setManufacturerFilter('');
        setSubtotalUsdMin('');
        setSubtotalUsdMax('');
        setAcquisitionFilter('ALL');
        setUserFilter('');
        setCloseMonthFilter(new Set());
        setBillingMonthFilter(new Set());
    };

    const hasActiveFilters = codeFilter || clientFilter || subjectFilter || statusFilters.size > 0
        || closeDateRange.from || closeDateRange.to
        || billingDateRange.from || billingDateRange.to
        || categoryFilter.size > 0 || manufacturerFilter
        || subtotalUsdMin || subtotalUsdMax || acquisitionFilter !== 'ALL'
        || userFilter
        || closeMonthFilter.size > 0 || billingMonthFilter.size > 0;

    return {
        // State
        loading,
        proposals,
        filtered,
        proposalGroups,
        filteredProjectionRows,
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
        codeFilter,
        setCodeFilter,
        clientFilter,
        setClientFilter,
        subjectFilter,
        setSubjectFilter,
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
        userFilter,
        setUserFilter,
        closeMonthFilter, setCloseMonthFilter,
        billingMonthFilter, setBillingMonthFilter,
        manufacturerSuggestions,

        // Actions
        handleStatusChange,
        handleDateChange,
        handleClone,
        getBoardHygieneIssues,
        handleDelete,
        handleAcquisitionChange,
        handleProjectionAcquisitionChange,
        handleProjectionStatusChange,
        handleProjectionDateChange,
        toggleStatusFilter,
        clearFilters,
    };
}
