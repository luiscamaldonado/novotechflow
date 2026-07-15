/**
 * Base del API para resolver rutas relativas de imagen.
 *
 * Fuente unica: todo consumidor que resuelva URLs de imagen DEBE leer de aqui.
 * Si dos vistas derivan bases distintas, las imagenes resuelven distinto, se
 * miden distinto, y el corte de hoja diverge entre el constructor y el PDF.
 */
export function getApiBase(): string {
    return import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3000';
}

/**
 * Resuelve la URL final de una imagen para `<img src>`.
 *
 * - data URIs: se usan tal cual.
 * - URLs absolutas (http/https): se usan tal cual.
 * - Assets estaticos del frontend (`/defaults/...`): se usan tal cual (same-origin).
 * - Cualquier otra ruta relativa (uploads de usuario, signatures, etc.):
 *   se prefija con `apiBase` (dominio del API).
 */
export function resolveImageUrl(url: string, apiBase: string): string {
    if (!url) return url;
    if (url.startsWith('data:')) return url;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    if (url.startsWith('/defaults/')) return url;
    return `${apiBase}${url}`;
}
