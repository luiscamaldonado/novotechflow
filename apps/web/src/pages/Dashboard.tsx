import { useState, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    PlusCircle, Trash2, Edit2, Loader2,
    Search, Filter, X, Receipt, FileSpreadsheet,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useDashboard, getSubtotalUsd } from '../hooks/useDashboard';
import { useProjections } from '../hooks/useProjections';
import { useNotifications } from '../hooks/useNotifications';
import { STATUS_CONFIG, ALL_STATUSES, PROJECTION_STATUSES, ACQUISITION_CONFIG } from '../lib/constants';
import { exportDashboardToExcel } from '../lib/exportDashboard';
import type { ProposalStatus, AcquisitionType, UserRole } from '../lib/types';
import BillingCards from './dashboard/BillingCards';
import PipelineCards from './dashboard/PipelineCards';
import ProjectionModal from './dashboard/ProjectionModal';
import TrmCards from './dashboard/TrmCards';
import DashboardFilters from './dashboard/DashboardFilters';
import NotificationBells from './dashboard/NotificationBells';
import NotificationPanel from './dashboard/NotificationPanel';
import ProposalVersionRow from './dashboard/components/ProposalVersionRow';
import ProposalGroupHeaderRow from './dashboard/components/ProposalGroupHeaderRow';
import ProposalDatesCell from './dashboard/components/ProposalDatesCell';
import ProposalValueCell from './dashboard/components/ProposalValueCell';



export default function Dashboard() {
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const [isExporting, setIsExporting] = useState(false);
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

    const toggleGroup = (baseCode: string) => {
        setExpandedGroups(prev => {
            const next = new Set(prev);
            if (next.has(baseCode)) next.delete(baseCode);
            else next.add(baseCode);
            return next;
        });
    };

    const handleEdit = (id: string) => navigate(`/proposals/${id}/builder`);

    const handleExportExcel = async () => {
        setIsExporting(true);
        try {
            await exportDashboardToExcel({
                rows: filtered,
                trmRate,
                userName: user?.name ?? 'Usuario',
            });
        } catch (error) {
            console.error('Error exportando Excel:', error);
        } finally {
            setIsExporting(false);
        }
    };

    const {
        loading, proposals, filtered, proposalGroups, filteredProjectionRows,
        billingCardsVenta, billingCardsDaas,
        pipelineCards, forecastCurrentQuarter, forecastNextQuarter,
        cloning, setProjections,
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
        userFilter, setUserFilter,
        manufacturerSuggestions,
        handleStatusChange, handleDateChange, handleClone, handleDelete,
        handleAcquisitionChange, handleProjectionAcquisitionChange,
        handleProjectionStatusChange, handleProjectionDateChange,
        toggleStatusFilter, clearFilters,
    } = useDashboard();

    const userRole: UserRole = user?.role === 'ADMIN' ? 'ADMIN' : 'COMMERCIAL';

    const {
        showProjectionModal, setShowProjectionModal,
        editingProjection, projForm, setProjForm, savingProjection,
        openNewProjectionModal, openEditProjectionModal,
        handleSaveProjection, handleDeleteProjection,
    } = useProjections(setProjections);

    const {
        notifications, warnings, urgents, unreadWarnings, unreadUrgents,
        markAsRead, markAllRead,
    } = useNotifications(proposals, trmRate);

    const [showAllNotifications, setShowAllNotifications] = useState(false);

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
                    <NotificationBells
                        warnings={warnings}
                        urgents={urgents}
                        unreadWarnings={unreadWarnings}
                        unreadUrgents={unreadUrgents}
                        markAllRead={markAllRead}
                        onViewAll={() => setShowAllNotifications(true)}
                    />
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

            {/* Pipeline & Forecast Cards */}
            <PipelineCards
                pipelineCards={pipelineCards}
                forecastCurrentQuarter={forecastCurrentQuarter}
                forecastNextQuarter={forecastNextQuarter}
            />

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
                        userFilter={userFilter}
                        onUserFilterChange={setUserFilter}
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
                    <button
                        onClick={handleExportExcel}
                        disabled={isExporting || filtered.length === 0}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl hover:bg-emerald-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isExporting
                            ? <Loader2 className="h-4 w-4 animate-spin" />
                            : <FileSpreadsheet className="h-4 w-4" />
                        }
                        <span>Exportar Excel</span>
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-gray-600">
                        <thead className="bg-gray-50 text-[10px] uppercase text-gray-400 font-bold tracking-wider border-b border-gray-100">
                            <tr>
                                <th className="px-4 py-3 text-center">Acciones</th>
                                <th className="px-5 py-3">Código</th>
                                <th className="px-4 py-3">Cliente / Asunto</th>
                                {user?.role === 'ADMIN' && <th className="px-4 py-3 text-center">Asesor</th>}
                                <th className="px-4 py-3">Fechas</th>
                                <th className="px-4 py-3 text-right">Valores (COP / USD)</th>
                                <th className="px-4 py-3 text-center">Adquisición</th>
                                <th className="px-4 py-3 text-center">Estado</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {proposalGroups.length === 0 && filteredProjectionRows.length === 0 ? (
                                <tr>
                                    <td colSpan={user?.role === 'ADMIN' ? 8 : 7} className="px-6 py-16 text-center text-gray-400">
                                        No hay propuestas que coincidan con los filtros.
                                    </td>
                                </tr>
                            ) : (
                                <>
                                    {/* ── Proposal groups (version-grouped) ── */}
                                    {proposalGroups.map(group => {
                                        if (group.versions.length === 1) {
                                            return (
                                                <ProposalVersionRow
                                                    key={group.activeVersion.id}
                                                    row={group.activeVersion}
                                                    userRole={userRole}
                                                    trmRate={trmRate}
                                                    cloning={cloning}
                                                    onStatusChange={handleStatusChange}
                                                    onDateChange={handleDateChange}
                                                    onAcquisitionChange={handleAcquisitionChange}
                                                    onClone={handleClone}
                                                    onDelete={handleDelete}
                                                    onEdit={handleEdit}
                                                />
                                            );
                                        }

                                        const isExpanded = expandedGroups.has(group.baseCode);
                                        return (
                                            <Fragment key={`grp-${group.baseCode}`}>
                                                <ProposalGroupHeaderRow
                                                    group={group}
                                                    isExpanded={isExpanded}
                                                    onToggle={() => toggleGroup(group.baseCode)}
                                                    userRole={userRole}
                                                    trmRate={trmRate}
                                                />
                                                {isExpanded && group.versions.map(v => (
                                                    <ProposalVersionRow
                                                        key={v.id}
                                                        row={v}
                                                        userRole={userRole}
                                                        trmRate={trmRate}
                                                        cloning={cloning}
                                                        isChild
                                                        isActiveVersion={v.id === group.activeVersion.id}
                                                        onStatusChange={handleStatusChange}
                                                        onDateChange={handleDateChange}
                                                        onAcquisitionChange={handleAcquisitionChange}
                                                        onClone={handleClone}
                                                        onDelete={handleDelete}
                                                        onEdit={handleEdit}
                                                    />
                                                ))}
                                            </Fragment>
                                        );
                                    })}

                                    {/* ── Projection rows (unchanged) ── */}
                                    {filteredProjectionRows.map(row => {
                                        const pr = row.originalProjection!;
                                        const cfg = STATUS_CONFIG[row.status];
                                        const usdEst = getSubtotalUsd(row.minSubtotal, row.minSubtotalCurrency, trmRate);
                                        return (
                                            <tr key={`proj-${row.id}`} className="hover:bg-violet-50/30 transition-colors group bg-violet-50/10">
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
                                                <ProposalDatesCell
                                                    closeDate={null}
                                                    issueDate={null}
                                                    validityDate={null}
                                                    updatedAt={row.updatedAt}
                                                />
                                                <ProposalValueCell
                                                    subtotal={Number(pr.subtotal)}
                                                    currency={row.minSubtotalCurrency}
                                                    usdEstimate={usdEst}
                                                />
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
                                            </tr>
                                        );
                                    })}
                                </>
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

            {/* Notification Panel */}
            {showAllNotifications && (
                <NotificationPanel
                    notifications={notifications}
                    onClose={() => setShowAllNotifications(false)}
                    markAsRead={markAsRead}
                />
            )}
        </div>
    );
}
