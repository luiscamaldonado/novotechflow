import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Upload, Loader2, AlertCircle, CheckCircle2, ChevronRight, Cpu } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { extraerSpecs, colapsarProducto, esVacioOPlaceholder } from '../../../lib/specPrefill';
import type { ProductoPrefill, PrefillTipoInput, PrefillSource } from '../../../lib/specPrefill';
import type { TechnicalSpecs } from '../../../lib/types';

/** Fuente seleccionada en la UI (Archivo agrupa Excel y PDF, se distingue por extensión). */
type FuenteUI = 'TEXTO' | 'LENOVO' | 'HP' | 'ARCHIVO';

interface PrefillModalProps {
    isOpen: boolean;
    onClose: () => void;
    onApply: (specs: TechnicalSpecs) => void;
}

const FUENTES: ReadonlyArray<{ id: FuenteUI; label: string }> = [
    { id: 'TEXTO', label: 'Texto' },
    { id: 'LENOVO', label: 'Part Number Lenovo' },
    { id: 'HP', label: 'Part Number HP' },
    { id: 'ARCHIVO', label: 'Archivo (Excel/PDF)' },
];

const FUENTE_A_TIPO: Record<Exclude<FuenteUI, 'ARCHIVO'>, PrefillTipoInput> = {
    TEXTO: 'TEXTO_PLANO',
    LENOVO: 'PART_NUMBER',
    HP: 'HP_PART_NUMBER',
};

/** Campos mostrados en el grid de cada equipo (fabricante/formato/modelo van en el encabezado; estado lo elige el usuario). */
const CAMPOS_GRID: ReadonlyArray<{ key: keyof ProductoPrefill; label: string }> = [
    { key: 'numeroParte', label: 'N\u00famero de Parte' },
    { key: 'procesador', label: 'Procesador' },
    { key: 'sistemaOperativo', label: 'Sistema Operativo' },
    { key: 'graficos', label: 'Gr\u00e1ficos' },
    { key: 'memoriaRam', label: 'Memoria RAM' },
    { key: 'almacenamiento', label: 'Almacenamiento' },
    { key: 'pantalla', label: 'Pantalla' },
    { key: 'network', label: 'Network' },
    { key: 'seguridad', label: 'Seguridad' },
    { key: 'garantiaEquipo', label: 'Garant\u00eda Equipo' },
    { key: 'garantiaBateria', label: 'Garant\u00eda Bater\u00eda' },
];

/** Color del badge de origen por fuente. */
const SOURCE_BADGE: Record<PrefillSource, string> = {
    TEXTO_PLANO: 'bg-emerald-50 text-emerald-600',
    PART_NUMBER: 'bg-emerald-50 text-emerald-600',
    EXCEL: 'bg-emerald-50 text-emerald-600',
    PSREF: 'bg-blue-50 text-blue-600',
    SMARTFIND: 'bg-blue-50 text-blue-600',
    HP_PARTSURFER: 'bg-cyan-50 text-cyan-600',
    PDF: 'bg-red-50 text-red-600',
    MANUAL: 'bg-slate-100 text-slate-500',
};

/**
 * Modal de prellenado por IA: extrae especificaciones de una fuente,
 * muestra los equipos detectados y aplica el seleccionado al formulario.
 */
export default function PrefillModal({ isOpen, onClose, onApply }: PrefillModalProps) {
    const [fuente, setFuente] = useState<FuenteUI>('TEXTO');
    const [texto, setTexto] = useState('');
    const [archivo, setArchivo] = useState<File | null>(null);
    const [cargando, setCargando] = useState(false);
    const [error, setError] = useState('');
    const [productos, setProductos] = useState<ProductoPrefill[]>([]);
    const [seleccionado, setSeleccionado] = useState(0);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setFuente('TEXTO');
            setTexto('');
            setArchivo(null);
            setCargando(false);
            setError('');
            setProductos([]);
            setSeleccionado(0);
        }
    }, [isOpen]);

    const cambiarFuente = (f: FuenteUI) => {
        setFuente(f);
        setProductos([]);
        setError('');
        setSeleccionado(0);
    };

    const handleArchivo = (e: React.ChangeEvent<HTMLInputElement>) => {
        setArchivo(e.target.files?.[0] ?? null);
        setProductos([]);
        setError('');
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleExtraer = async () => {
        setError('');
        setProductos([]);
        setCargando(true);
        try {
            let resultado: ProductoPrefill[];
            if (fuente === 'ARCHIVO') {
                if (!archivo) {
                    setError('Selecciona un archivo .xlsx o .pdf.');
                    return;
                }
                const nombre = archivo.name.toLowerCase();
                const tipo: PrefillTipoInput | null = nombre.endsWith('.xlsx')
                    ? 'EXCEL'
                    : nombre.endsWith('.pdf')
                      ? 'PDF'
                      : null;
                if (!tipo) {
                    setError('Formato no soportado. Usa .xlsx o .pdf.');
                    return;
                }
                resultado = await extraerSpecs(tipo, { file: archivo });
            } else {
                const valor = texto.trim();
                if (!valor) {
                    setError('Ingresa el texto o el part number.');
                    return;
                }
                resultado = await extraerSpecs(FUENTE_A_TIPO[fuente], { payload: valor });
            }
            setProductos(resultado);
            setSeleccionado(0);
        } catch (err: unknown) {
            const axiosErr = err as { response?: { data?: { message?: string | string[] } } };
            const msg = axiosErr.response?.data?.message;
            setError(Array.isArray(msg) ? msg.join(', ') : msg || 'No se pudo extraer la informaci\u00f3n.');
        } finally {
            setCargando(false);
        }
    };

    const handleAplicar = () => {
        if (productos.length === 0) return;
        onApply(colapsarProducto(productos[seleccionado]));
        onClose();
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
                >
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        className="bg-white w-full max-w-4xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
                    >
                        <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                            <div>
                                <h3 className="text-2xl font-black text-slate-900 tracking-tight flex items-center">
                                    <Cpu className="h-6 w-6 mr-3 text-indigo-600" />
                                    Prellenado IA
                                </h3>
                                <p className="text-sm text-slate-500 font-medium">
                                    Extrae las especificaciones de un equipo desde texto, part number o archivo.
                                </p>
                            </div>
                            <button onClick={onClose} className="p-4 rounded-2xl hover:bg-white transition-colors text-slate-400">
                                <ChevronRight className="h-6 w-6 rotate-90" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-8">
                            <div className="flex flex-wrap gap-2 mb-6">
                                {FUENTES.map((f) => (
                                    <button
                                        key={f.id}
                                        type="button"
                                        onClick={() => cambiarFuente(f.id)}
                                        className={cn(
                                            'px-5 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all',
                                            fuente === f.id
                                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100'
                                                : 'bg-white border-2 border-slate-200 text-slate-500 hover:border-slate-300',
                                        )}
                                    >
                                        {f.label}
                                    </button>
                                ))}
                            </div>

                            <div className="mb-6">
                                {fuente === 'ARCHIVO' ? (
                                    <div className="flex items-center space-x-4">
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept=".xlsx,.pdf"
                                            className="hidden"
                                            onChange={handleArchivo}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            className="flex items-center space-x-2 px-5 py-3 rounded-2xl bg-emerald-50 hover:bg-emerald-100 text-emerald-600 transition-all font-black text-[10px] uppercase tracking-widest"
                                        >
                                            <Upload className="h-4 w-4" />
                                            <span>Seleccionar archivo</span>
                                        </button>
                                        {archivo ? (
                                            <span className="text-sm font-bold text-slate-700">{archivo.name}</span>
                                        ) : (
                                            <span className="text-sm text-slate-400">Excel (.xlsx) o PDF (.pdf)</span>
                                        )}
                                    </div>
                                ) : fuente === 'TEXTO' ? (
                                    <textarea
                                        value={texto}
                                        onChange={(e) => setTexto(e.target.value)}
                                        rows={5}
                                        placeholder={'Pega aqu\u00ed las especificaciones del equipo: procesador, memoria, almacenamiento, pantalla, garant\u00eda...'}
                                        className="w-full px-5 py-4 rounded-2xl bg-white border-2 border-slate-100 focus:border-indigo-600 focus:ring-0 text-sm font-medium text-slate-800 resize-none"
                                    />
                                ) : (
                                    <input
                                        type="text"
                                        value={texto}
                                        onChange={(e) => setTexto(e.target.value)}
                                        placeholder={fuente === 'LENOVO' ? 'Ej: 21QD001CLM' : 'Ej: D66V3LT'}
                                        className="w-full px-5 py-4 rounded-2xl bg-white border-2 border-slate-100 focus:border-indigo-600 focus:ring-0 text-sm font-bold text-slate-800"
                                    />
                                )}
                            </div>

                            <div className="flex justify-end mb-6">
                                <button
                                    type="button"
                                    onClick={handleExtraer}
                                    disabled={cargando}
                                    className="flex items-center space-x-2 px-8 py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[10px] uppercase tracking-widest shadow-xl shadow-indigo-100 transition-all active:scale-95 disabled:opacity-50"
                                >
                                    {cargando ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                                    <span>{cargando ? 'Extrayendo...' : 'Extraer'}</span>
                                </button>
                            </div>

                            {error && (
                                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-2xl px-4 py-3 mb-6">
                                    <AlertCircle className="h-4 w-4 shrink-0" />
                                    <span>{error}</span>
                                </div>
                            )}

                            {productos.length > 0 ? (
                                <div className="space-y-4">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                        Equipos detectados ({productos.length})
                                    </p>
                                    {productos.map((producto, index) => {
                                        const activo = index === seleccionado;
                                        const origen = producto.modelo.source;
                                        return (
                                            <button
                                                type="button"
                                                key={index}
                                                onClick={() => setSeleccionado(index)}
                                                className={cn(
                                                    'w-full text-left p-6 rounded-[2rem] border-2 transition-all',
                                                    activo
                                                        ? 'bg-indigo-50/50 border-indigo-300'
                                                        : 'bg-white border-slate-100 hover:border-indigo-200',
                                                )}
                                            >
                                                <div className="flex items-start justify-between mb-4">
                                                    <div className="flex items-center space-x-4">
                                                        <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-50">
                                                            <Cpu className="h-6 w-6 text-indigo-600" />
                                                        </div>
                                                        <div>
                                                            <p className="text-lg font-black text-slate-900 leading-tight">
                                                                {producto.modelo.value || 'Equipo'}
                                                            </p>
                                                            <div className="flex items-center space-x-2 mt-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                                                <span>{producto.fabricante.value || '\u2014'}</span>
                                                                <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
                                                                <span>{producto.formato.value || '\u2014'}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center space-x-2">
                                                        <span
                                                            className={cn(
                                                                'px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest',
                                                                SOURCE_BADGE[origen],
                                                            )}
                                                        >
                                                            {origen}
                                                        </span>
                                                        {activo && <CheckCircle2 className="h-5 w-5 text-indigo-600" />}
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                                                    {CAMPOS_GRID.map(({ key, label }) => {
                                                        const valor = producto[key].value;
                                                        const vacio = esVacioOPlaceholder(valor);
                                                        return (
                                                            <div key={key} className="flex flex-col">
                                                                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                                                                    {label}
                                                                </span>
                                                                <span
                                                                    className={cn(
                                                                        'text-sm font-bold',
                                                                        vacio ? 'text-slate-300' : 'text-slate-800',
                                                                    )}
                                                                >
                                                                    {vacio ? '\u2014' : valor}
                                                                </span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            ) : !cargando && !error ? (
                                <div className="text-center py-12 opacity-40">
                                    <Cpu className="h-16 w-16 mx-auto text-slate-300 mb-4" />
                                    <p className="text-sm font-bold text-slate-400">
                                        Elige una fuente y extrae las especificaciones.
                                    </p>
                                </div>
                            ) : null}
                        </div>

                        <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-10 py-4 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleAplicar}
                                disabled={productos.length === 0}
                                className="px-12 py-4 bg-indigo-600 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 active:scale-95 disabled:opacity-50"
                            >
                                Aplicar al item
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
