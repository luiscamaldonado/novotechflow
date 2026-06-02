/**
 * Formatea una fecha @db.Date forzando UTC. Prisma serializa los campos @db.Date a
 * medianoche UTC; sin timeZone:'UTC' la fecha se corre un día en Colombia (UTC-5).
 */
export function formatDashboardDate(isoDate: string): string {
    return new Date(isoDate).toLocaleDateString('es-CO', {
        day: '2-digit',
        month: 'short',
        year: '2-digit',
        timeZone: 'UTC',
    });
}

/**
 * Vencida = la fecha de vigencia es anterior a hoy, comparando solo la fecha (no la hora).
 * Compara la porción YYYY-MM-DD del ISO (UTC) contra la fecha LOCAL de hoy; 'en-CA' devuelve
 * hoy en formato YYYY-MM-DD, lo que hace la comparación lexicográfica correcta cronológicamente.
 */
export function isValidityExpired(isoDate: string): boolean {
    const todayLocal = new Date().toLocaleDateString('en-CA');
    return isoDate.slice(0, 10) < todayLocal;
}

/**
 * Días calendario transcurridos desde la fecha en `isoDate` (interpretada a medianoche UTC)
 * hasta la fecha local de hoy. UTC-safe: compara solo la parte de fecha para evitar el
 * desfase de -1 día en UTC-5, consistente con isValidityExpired.
 */
export function daysSince(isoDate: string): number {
    const MS_PER_DAY = 86_400_000;
    const startMs = Date.parse(`${isoDate.slice(0, 10)}T00:00:00Z`);
    const todayMs = Date.parse(`${new Date().toLocaleDateString('en-CA')}T00:00:00Z`);
    return Math.floor((todayMs - startMs) / MS_PER_DAY);
}
