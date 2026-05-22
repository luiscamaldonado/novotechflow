/**
 * Resuelve la URL final de una imagen para `<img src>`.
 *
 * - data URIs: se usan tal cual.
 * - URLs absolutas (http/https): se usan tal cual.
 * - Assets estaticos del frontend (`/defaults/...`): se usan tal cual (same-origin).
 * - URL legacy de la portada por defecto (`/uploads/defaults/portada.png`):
 *   se redirige al asset del frontend `/defaults/portada.png` para que las
 *   propuestas y templates en DB que aun apuntan a la URL vieja sigan funcionando
 *   antes de la migracion SQL.
 * - Cualquier otra ruta relativa (uploads de usuario, signatures, etc.):
 *   se prefija con `apiBase` (dominio del API).
 */

const LEGACY_DEFAULT_COVER = '/uploads/defaults/portada.png';
const NEW_DEFAULT_COVER = '/defaults/portada.png';

export function resolveImageUrl(url: string, apiBase: string): string {
    if (!url) return url;
    if (url.startsWith('data:')) return url;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    if (url === LEGACY_DEFAULT_COVER) return NEW_DEFAULT_COVER;
    if (url.startsWith('/defaults/')) return url;
    return `${apiBase}${url}`;
}
