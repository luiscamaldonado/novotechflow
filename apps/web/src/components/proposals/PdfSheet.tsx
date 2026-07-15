import type { ReactNode } from 'react';
import { PAGE_GEOMETRY } from '../../lib/constants';

interface PdfSheetProps {
    children: ReactNode;
}

/**
 * El papel de una hoja Carta: fondo, dimensiones fijas y el marcador
 * `data-pdf-page` que captura generatePdf. Es la garantia de que la hoja
 * del constructor y la del PDF son el mismo papel; cualquier consumidor que
 * dibuje su propia hoja rompe esa garantia.
 */
export default function PdfSheet({ children }: PdfSheetProps) {
    return (
        <div
            data-pdf-page
            className="bg-white rounded-2xl shadow-2xl shadow-black/20 border border-slate-200/50 overflow-hidden"
            style={{ minHeight: `${PAGE_GEOMETRY.HEIGHT_PX}px`, maxHeight: `${PAGE_GEOMETRY.HEIGHT_PX}px`, overflow: 'hidden' }}
        >
            {children}
        </div>
    );
}
