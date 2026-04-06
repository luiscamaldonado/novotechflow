import { useState, useEffect, useMemo } from 'react';
import { api } from '../lib/api';
import type { ProposalSummary, ProposalStatus, BillingProjection, AcquisitionType } from '../lib/types';
import { calculateScenarioTotals } from '../lib/pricing-engine';

// ── Utility: compute min-scenario subtotal (via pricing engine) ──
function computeMinSubtotal(proposal: ProposalSummary): number | null {
    if (!proposal.scenarios || proposal.scenarios.length === 0) return null;

    let minSubtotal: number | null = null;

    for (const scenario of proposal.scenarios) {
        // Delegate to centralized engine (includes dilution, children, etc.)
        const totals = calculateScenarioTotals(scenario.scenarioItems);
        const subtotal = totals.subtotal;

        if (minSubtotal === null || subtotal < minSubtotal) {
            minSubtotal = subtotal;
        }
    }

    return minSubtotal;
}

// ── Unified row type ──
export interface DashboardRow {
    id: string;
    code: string;
    clientName: string;
    subject: string;
    minSubtotal: number | null;
    status: ProposalStatus;
    closeDate?: string | null;
    billingDate?: string | null;
    acquisitionType?: AcquisitionType | null;
    updatedAt: string;
    user?: { name: string; nomenclature: string };
    isProjection: boolean;
    // Only for proposals
    originalProposal?: ProposalSummary & { minSubtotal: number | null };
    // Only for projections
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

export function useDashboard() {
    const [proposals, setProposals] = useState<ProposalSummary[]>([]);
    const [projections, setProjections] = useState<BillingProjection[]>([]);
    const [loading, setLoading] = useState(true);

    // Filter state
    const [showFilters, setShowFilters] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilters, setStatusFilters] = useState<Set<ProposalStatus>>(new Set());
    const [subtotalMin, setSubtotalMin] = useState('');
    const [subtotalMax, setSubtotalMax] = useState('');

    // Clone action state
    const [cloning, setCloning] = useState<string | null>(null);

    useEffect(() => {
        loadData();
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
        return proposals.map(p => ({
            ...p,
            minSubtotal: computeMinSubtotal(p),
        }));
    }, [proposals]);

    // ── Unified rows (proposals + projections) ──
    const allRows: DashboardRow[] = useMemo(() => {
        const proposalRows: DashboardRow[] = proposalsWithSubtotals.map(p => ({
            id: p.id,
            code: p.proposalCode,
            clientName: p.clientName,
            subject: p.subject,
            minSubtotal: p.minSubtotal,
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

    const filtered = useMemo(() => {
        return allRows.filter(p => {
            // Text search
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                const matches = p.code?.toLowerCase().includes(term) ||
                    p.clientName.toLowerCase().includes(term) ||
                    p.subject.toLowerCase().includes(term);
                if (!matches) return false;
            }
            // Status filter
            if (statusFilters.size > 0 && !statusFilters.has(p.status)) return false;
            // Subtotal range
            if (subtotalMin && p.minSubtotal !== null && p.minSubtotal < parseFloat(subtotalMin)) return false;
            if (subtotalMax && p.minSubtotal !== null && p.minSubtotal > parseFloat(subtotalMax)) return false;
            return true;
        });
    }, [allRows, searchTerm, statusFilters, subtotalMin, subtotalMax]);

    // ── Billing summary cards (includes projections) ──
    const billingCards: BillingCards = useMemo(() => {
        const now = new Date();
        const thisMonth = now.getMonth();
        const thisYear = now.getFullYear();
        const prevMonth = thisMonth === 0 ? 11 : thisMonth - 1;
        const prevMonthYear = thisMonth === 0 ? thisYear - 1 : thisYear;

        const currentQuarter = Math.floor(thisMonth / 3);
        const nextQuarter = (currentQuarter + 1) % 4;
        const nextQuarterYear = nextQuarter === 0 ? thisYear + 1 : thisYear;

        let facturadoMesAnterior = 0;
        let facturadoMesActual = 0;
        let facturadoTrimestreActual = 0;
        let proyeccionTrimestreSiguiente = 0;
        let pendFactMesActual = 0;
        let pendFactMesSiguiente = 0;

        const nextMonth = thisMonth === 11 ? 0 : thisMonth + 1;
        const nextMonthYear = thisMonth === 11 ? thisYear + 1 : thisYear;

        // Helper: parse ISO date string to { month (0-indexed), year } without timezone shift
        const parseDate = (dateStr: string) => {
            const [datePart] = dateStr.split('T');
            const [y, m] = datePart.split('-').map(Number);
            return { month: m - 1, year: y }; // month is 0-indexed to match JS convention
        };

        // Process proposals
        for (const p of proposalsWithSubtotals) {
            const sub = p.minSubtotal || 0;

            // FACTURADA — uses billingDate for mes anterior, mes actual, trimestre actual
            if (p.status === 'FACTURADA' && p.billingDate) {
                const { month, year } = parseDate(p.billingDate);
                if (month === prevMonth && year === prevMonthYear) {
                    facturadoMesAnterior += sub;
                }
                if (month === thisMonth && year === thisYear) {
                    facturadoMesActual += sub;
                }
                if (Math.floor(month / 3) === currentQuarter && year === thisYear) {
                    facturadoTrimestreActual += sub;
                }
            }

            // PENDIENTE_FACTURAR — uses billingDate for trimestre actual, projection, and monthly cards
            if (p.status === 'PENDIENTE_FACTURAR' && p.billingDate) {
                const { month, year } = parseDate(p.billingDate);

                // Trimestre actual
                if (Math.floor(month / 3) === currentQuarter && year === thisYear) {
                    facturadoTrimestreActual += sub;
                }

                // Proyección trimestre siguiente
                if (Math.floor(month / 3) === nextQuarter && year === nextQuarterYear) {
                    proyeccionTrimestreSiguiente += sub;
                }

                // Pend. Facturar por mes
                if (month === thisMonth && year === thisYear) {
                    pendFactMesActual += sub;
                }
                if (month === nextMonth && year === nextMonthYear) {
                    pendFactMesSiguiente += sub;
                }
            }

            // GANADA — uses closeDate for projection
            if (p.status === 'GANADA' && p.closeDate) {
                const { month, year } = parseDate(p.closeDate);
                if (Math.floor(month / 3) === nextQuarter && year === nextQuarterYear) {
                    proyeccionTrimestreSiguiente += sub;
                }
            }
        }

        // Process billing projections (same logic as proposals)
        for (const pr of projections) {
            const sub = Number(pr.subtotal) || 0;

            if (pr.status === 'FACTURADA' && pr.billingDate) {
                const { month, year } = parseDate(pr.billingDate);
                if (month === prevMonth && year === prevMonthYear) {
                    facturadoMesAnterior += sub;
                }
                if (month === thisMonth && year === thisYear) {
                    facturadoMesActual += sub;
                }
                if (Math.floor(month / 3) === currentQuarter && year === thisYear) {
                    facturadoTrimestreActual += sub;
                }
            }

            if (pr.status === 'PENDIENTE_FACTURAR' && pr.billingDate) {
                const { month, year } = parseDate(pr.billingDate);

                if (Math.floor(month / 3) === currentQuarter && year === thisYear) {
                    facturadoTrimestreActual += sub;
                }

                if (Math.floor(month / 3) === nextQuarter && year === nextQuarterYear) {
                    proyeccionTrimestreSiguiente += sub;
                }

                if (month === thisMonth && year === thisYear) {
                    pendFactMesActual += sub;
                }
                if (month === nextMonth && year === nextMonthYear) {
                    pendFactMesSiguiente += sub;
                }
            }
        }

        return { facturadoMesAnterior, facturadoMesActual, facturadoTrimestreActual, proyeccionTrimestreSiguiente, pendFactMesActual, pendFactMesSiguiente };
    }, [proposalsWithSubtotals, projections]);

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
    };

    const hasActiveFilters = searchTerm || statusFilters.size > 0 || subtotalMin || subtotalMax;

    return {
        // State
        loading,
        filtered,
        billingCards,
        cloning,
        setProjections,

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
