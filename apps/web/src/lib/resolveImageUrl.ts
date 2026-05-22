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
