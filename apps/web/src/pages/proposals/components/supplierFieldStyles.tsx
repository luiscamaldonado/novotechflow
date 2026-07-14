/** Estilos y marcas compartidos por SupplierSection y NewContactFields (evita duplicacion e import circular). */

export const LABEL_CLASS = 'text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1';
export const CONTROL_CLASS = 'w-full px-5 py-4 rounded-2xl bg-slate-800 border-none text-sm font-black text-slate-300 placeholder:text-slate-500 placeholder:font-medium focus:ring-2 focus:ring-slate-700 disabled:opacity-60 disabled:cursor-not-allowed';
export const READONLY_CLASS = 'w-full px-5 py-4 rounded-2xl bg-slate-800/50 border-none text-sm font-black text-slate-400';

/** Asterisco rojo de campo obligatorio. */
export function RequiredMark() {
    return <span className="text-red-400 ml-0.5">*</span>;
}
