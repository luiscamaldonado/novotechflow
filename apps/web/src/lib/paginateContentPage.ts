import { PAGE_GEOMETRY, CONTENT_PDF_HEIGHTS } from './constants';

/** Un elemento de primer nivel ya medido */
export interface MeasuredElement {
    html: string;
    height: number;
}

/** Una hoja de una pagina de contenido */
export interface ContentPageSlice {
    htmlContent: string;
    isContinuation: boolean;
    /** True si el contenido excede el alto util de la hoja: el PDF lo recorta */
    isOverflowing: boolean;
}

/** Alto asumido para imagenes que aun no cargaron (sin naturalHeight) */
const UNLOADED_IMAGE_HEIGHT_PX = 300;

const { FIRST_SLICE_HEADER_HEIGHT, CONTINUATION_HEADER_HEIGHT } = CONTENT_PDF_HEIGHTS;
const USABLE_HEIGHT = PAGE_GEOMETRY.USABLE_HEIGHT_PX;

/**
 * Mide los elementos de primer nivel del HTML de una página de contenido.
 *
 * TOCA EL DOM: crea un div oculto y lo cuelga de `container` (que debe estar
 * montado en el documento), fuerza el alto de las imágenes que aún no cargaron,
 * mide cada hijo con getBoundingClientRect + márgenes computados, y luego
 * destruye el div. Ignora nodos de texto sueltos (sólo recorre `children`).
 */
export function measureContentElements(html: string, container: HTMLElement): MeasuredElement[] {
    // Render the full HTML into a measurement div to get child element heights
    const measure = document.createElement('div');
    measure.style.width = `${PAGE_GEOMETRY.CONTENT_WIDTH_PX}px`; // page width minus padding
    measure.style.position = 'absolute';
    measure.style.visibility = 'hidden';
    measure.style.left = '-9999px';
    measure.className = 'prose prose-sm max-w-none';
    measure.innerHTML = html;
    container.appendChild(measure);

    // Force image rendering by setting dimensions
    const imgs = measure.querySelectorAll('img');
    imgs.forEach(img => {
        if (!img.naturalHeight) {
            img.style.height = `${UNLOADED_IMAGE_HEIGHT_PX}px`;
        }
    });

    // Get all top-level child elements and their heights
    const children = Array.from(measure.children) as HTMLElement[];
    const elementData: MeasuredElement[] = [];

    for (const child of children) {
        const rect = child.getBoundingClientRect();
        const styles = window.getComputedStyle(child);
        const marginTop = parseFloat(styles.marginTop) || 0;
        const marginBottom = parseFloat(styles.marginBottom) || 0;
        elementData.push({
            html: child.outerHTML,
            height: rect.height + marginTop + marginBottom,
        });
    }

    container.removeChild(measure);

    return elementData;
}

/**
 * Pagina los elementos medidos en slices por altura acumulada.
 *
 * Función PURA: sin React, sin DOM, sin side effects. Apta para tests unitarios.
 *
 * Arranca asumiendo el header grande de la primera hoja; cuando agregar un
 * elemento excedería el alto útil (y ya hay contenido en la hoja actual),
 * corta y arranca una hoja de continuación. Con `elements` vacío devuelve
 * exactamente un slice vacío.
 *
 * Un elemento más alto que el alto útil entra igual en una hoja vacía (no hay
 * partición intra-elemento): esa hoja se marca `isOverflowing` y el PDF la
 * recorta. Por construcción, una hoja desbordada contiene un solo elemento.
 */
export function paginateContentPage(elements: MeasuredElement[]): ContentPageSlice[] {
    const slices: ContentPageSlice[] = [];

    // Split elements across pages
    let currentHeight: number = FIRST_SLICE_HEADER_HEIGHT;
    let currentHtml = '';
    let isContinuation = false;

    for (let i = 0; i < elements.length; i++) {
        const el = elements[i];

        // Would adding this element exceed the page?
        if (currentHeight + el.height > USABLE_HEIGHT && currentHtml.length > 0) {
            // Flush current page
            slices.push({
                htmlContent: currentHtml,
                isContinuation,
                isOverflowing: currentHeight > USABLE_HEIGHT,
            });
            currentHtml = '';
            currentHeight = CONTINUATION_HEADER_HEIGHT; // continuation header is smaller
            isContinuation = true;
        }

        currentHtml += el.html;
        currentHeight += el.height;
    }

    // Flush remaining content
    slices.push({
        htmlContent: currentHtml,
        isContinuation,
        isOverflowing: currentHeight > USABLE_HEIGHT,
    });

    return slices;
}
