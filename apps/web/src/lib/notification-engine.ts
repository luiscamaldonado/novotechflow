/* ------------------------------------------------------------------ */
/*  notification-engine.ts — Motor de notificaciones del Dashboard     */
/*  Funciones puras, sin dependencias de React.                        */
/* ------------------------------------------------------------------ */

// ── Tipos públicos ──────────────────────────────────────────────────

export type NotificationSeverity = 'WARNING' | 'URGENT';

export type NotificationType =
  | 'CLOSE_DATE_WARNING'
  | 'VALIDITY_WARNING'
  | 'STALE_30_DAYS'
  | 'CLOSE_DATE_EXPIRED'
  | 'VALIDITY_EXPIRED'
  | 'STALE_45_DAYS'
  | 'TRM_DEVIATION';

export interface DashboardNotification {
  id: string;
  proposalId: string;
  proposalCode: string;
  clientName: string;
  type: NotificationType;
  severity: NotificationSeverity;
  message: string;
  date: string;
  read: boolean;
}

// ── Tipo de propuesta que alimenta el engine ────────────────────────

export interface NotificationProposal {
  id: string;
  proposalCode: string;
  clientName: string;
  closeDate?: string | null;
  validityDate?: string | null;
  updatedAt: string;
  scenarios?: Array<{ name: string; conversionTrm?: number | null }>;
}

// ── Constantes internas ─────────────────────────────────────────────

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const WARNING_DAYS_THRESHOLD = 5;
const STALE_WARNING_DAYS = 30;
const STALE_URGENT_DAYS = 45;
const TRM_DEVIATION_THRESHOLD = 60;

// ── Helpers ─────────────────────────────────────────────────────────

/** Calcula días entre `from` y `to`. Positivo = `to` está en el futuro. */
function daysDiff(from: Date, to: Date): number {
  return Math.ceil((to.getTime() - from.getTime()) / MS_PER_DAY);
}

/** Formatea una fecha ISO a dd/mm/aaaa. */
export function formatDateDDMMYYYY(dateStr: string): string {
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

// ── Generadores por regla ───────────────────────────────────────────

function buildCloseDateNotifications(
  proposal: NotificationProposal,
  today: Date,
  readIds: Set<string>,
): DashboardNotification[] {
  if (!proposal.closeDate) return [];

  const closeDate = new Date(proposal.closeDate);
  const diff = daysDiff(today, closeDate);
  const label = `${proposal.proposalCode} - ${proposal.clientName}`;

  if (diff < 0) {
    const id = `${proposal.id}-CLOSE_DATE_EXPIRED`;
    return [{
      id,
      proposalId: proposal.id,
      proposalCode: proposal.proposalCode,
      clientName: proposal.clientName,
      type: 'CLOSE_DATE_EXPIRED',
      severity: 'URGENT',
      message: `La fecha de cierre de ${label} venció hace ${Math.abs(diff)} días`,
      date: formatDateDDMMYYYY(proposal.closeDate),
      read: readIds.has(id),
    }];
  }

  if (diff <= WARNING_DAYS_THRESHOLD) {
    const id = `${proposal.id}-CLOSE_DATE_WARNING`;
    return [{
      id,
      proposalId: proposal.id,
      proposalCode: proposal.proposalCode,
      clientName: proposal.clientName,
      type: 'CLOSE_DATE_WARNING',
      severity: 'WARNING',
      message: `La propuesta ${label} vence en ${diff} días (cierre: ${formatDateDDMMYYYY(proposal.closeDate)})`,
      date: formatDateDDMMYYYY(proposal.closeDate),
      read: readIds.has(id),
    }];
  }

  return [];
}

function buildValidityDateNotifications(
  proposal: NotificationProposal,
  today: Date,
  readIds: Set<string>,
): DashboardNotification[] {
  if (!proposal.validityDate) return [];

  const validityDate = new Date(proposal.validityDate);
  const diff = daysDiff(today, validityDate);
  const label = `${proposal.proposalCode} - ${proposal.clientName}`;

  if (diff < 0) {
    const id = `${proposal.id}-VALIDITY_EXPIRED`;
    return [{
      id,
      proposalId: proposal.id,
      proposalCode: proposal.proposalCode,
      clientName: proposal.clientName,
      type: 'VALIDITY_EXPIRED',
      severity: 'URGENT',
      message: `La vigencia de ${label} venció el ${formatDateDDMMYYYY(proposal.validityDate)}`,
      date: formatDateDDMMYYYY(proposal.validityDate),
      read: readIds.has(id),
    }];
  }

  if (diff <= WARNING_DAYS_THRESHOLD) {
    const id = `${proposal.id}-VALIDITY_WARNING`;
    return [{
      id,
      proposalId: proposal.id,
      proposalCode: proposal.proposalCode,
      clientName: proposal.clientName,
      type: 'VALIDITY_WARNING',
      severity: 'WARNING',
      message: `La vigencia de ${label} vence en ${diff} días`,
      date: formatDateDDMMYYYY(proposal.validityDate),
      read: readIds.has(id),
    }];
  }

  return [];
}

function buildStalenessNotifications(
  proposal: NotificationProposal,
  today: Date,
  readIds: Set<string>,
): DashboardNotification[] {
  const updatedAt = new Date(proposal.updatedAt);
  const staleDays = daysDiff(updatedAt, today);
  const label = `${proposal.proposalCode} - ${proposal.clientName}`;

  if (staleDays >= STALE_URGENT_DAYS) {
    const id = `${proposal.id}-STALE_45_DAYS`;
    return [{
      id,
      proposalId: proposal.id,
      proposalCode: proposal.proposalCode,
      clientName: proposal.clientName,
      type: 'STALE_45_DAYS',
      severity: 'URGENT',
      message: `${label} lleva ${staleDays} días sin actualizarse`,
      date: formatDateDDMMYYYY(proposal.updatedAt),
      read: readIds.has(id),
    }];
  }

  if (staleDays >= STALE_WARNING_DAYS) {
    const id = `${proposal.id}-STALE_30_DAYS`;
    return [{
      id,
      proposalId: proposal.id,
      proposalCode: proposal.proposalCode,
      clientName: proposal.clientName,
      type: 'STALE_30_DAYS',
      severity: 'WARNING',
      message: `${label} lleva ${staleDays} días sin actualizarse`,
      date: formatDateDDMMYYYY(proposal.updatedAt),
      read: readIds.has(id),
    }];
  }

  return [];
}

function buildTrmDeviationNotifications(
  proposal: NotificationProposal,
  trmRate: number | null,
  readIds: Set<string>,
): DashboardNotification[] {
  if (trmRate === null || !proposal.scenarios) return [];

  const results: DashboardNotification[] = [];

  for (const scenario of proposal.scenarios) {
    if (scenario.conversionTrm == null) continue;

    const diff = Math.abs(scenario.conversionTrm - trmRate);
    if (diff <= TRM_DEVIATION_THRESHOLD) continue;

    const id = `${proposal.id}-TRM_DEVIATION-${scenario.name}`;
    results.push({
      id,
      proposalId: proposal.id,
      proposalCode: proposal.proposalCode,
      clientName: proposal.clientName,
      type: 'TRM_DEVIATION',
      severity: 'URGENT',
      message: `El escenario '${scenario.name}' de ${proposal.proposalCode} usa TRM ${scenario.conversionTrm} (TRM actual: ${trmRate}, diferencia: ${diff})`,
      date: formatDateDDMMYYYY(proposal.updatedAt),
      read: readIds.has(id),
    });
  }

  return results;
}

// ── Función principal ───────────────────────────────────────────────

/**
 * Genera todas las notificaciones del Dashboard a partir de las
 * propuestas activas y la TRM del día.
 *
 * Reglas implementadas:
 * - WARNING: close date ≤5d, validity ≤5d, stale 30-44d
 * - URGENT:  close date vencido, validity vencida, stale ≥45d, TRM deviation >60
 */
export function generateNotifications(
  proposals: NotificationProposal[],
  trmRate: number | null,
  readIds: Set<string>,
): DashboardNotification[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const notifications: DashboardNotification[] = [];

  for (const proposal of proposals) {
    notifications.push(
      ...buildCloseDateNotifications(proposal, today, readIds),
      ...buildValidityDateNotifications(proposal, today, readIds),
      ...buildStalenessNotifications(proposal, today, readIds),
      ...buildTrmDeviationNotifications(proposal, trmRate, readIds),
    );
  }

  return notifications;
}
