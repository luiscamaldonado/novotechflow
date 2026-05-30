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
