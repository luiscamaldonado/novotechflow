import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, FileText, CalendarDays, Clock, ArrowRight, Loader2, AlertCircle, Search } from 'lucide-react';
import { api } from '../../lib/api';

export default function NewProposal() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);

    // Autocomplete states
    const [clientSuggestions, setClientSuggestions] = useState<string[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);
    const [clientHistory, setClientHistory] = useState<any[]>([]);

    const wrapperRef = useRef<HTMLDivElement>(null);

    const todayDateStr = new Date().toISOString().split('T')[0];
    const defaultValidityDays = 15;

    const getFutureDate = (dateStr: string, days: number) => {
        const d = new Date(dateStr);
        d.setDate(d.getDate() + days);
        return d.toISOString().split('T')[0];
    };

    // El formulario
    const [formData, setFormData] = useState({
        clientName: '',
        subject: '',
        issueDate: todayDateStr,
        validityDays: defaultValidityDays.toString(),
        validityDate: getFutureDate(todayDateStr, defaultValidityDays)
    });

    // Handle clicks outside of autocomplete
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setShowSuggestions(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef]);

    const handleClientChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        handleChange(e);

        if (value.length > 2) {
            setLoadingSuggestions(true);
            setShowSuggestions(true);
            try {
                const res = await api.get(`/proposals/clients/search?q=${encodeURIComponent(value)}`);
                setClientSuggestions(res.data);
            } catch (error) {
                console.error("Error searching clients", error);
            } finally {
                setLoadingSuggestions(false);
            }
        } else {
            setClientSuggestions([]);
            setShowSuggestions(false);
        }
    };

    const selectClient = async (name: string) => {
        setFormData(prev => ({ ...prev, clientName: name }));
        setShowSuggestions(false);

        // Cargar historial del cliente para prevenir cruces
        try {
            const res = await api.get(`/proposals/client-history?clientName=${encodeURIComponent(name)}`);
            setClientHistory(res.data);
        } catch (error) {
            console.error("Error loading client history", error);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;

        if (name === 'validityDays') {
            const days = parseInt(value, 10);
            if (!isNaN(days)) {
                setFormData(prev => ({
                    ...prev,
                    validityDays: value,
                    validityDate: getFutureDate(prev.issueDate, days)
                }));
            } else {
                setFormData(prev => ({ ...prev, validityDays: value }));
            }
            return;
        }

        if (name === 'validityDate') {
            const start = new Date(formData.issueDate);
            const end = new Date(value);
            const diffTime = end.getTime() - start.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            setFormData(prev => ({
                ...prev,
                validityDate: value,
                validityDays: diffDays > 0 ? diffDays.toString() : '0'
            }));
            return;
        }

        if (name === 'issueDate') {
            setFormData(prev => ({
                ...prev,
                issueDate: value,
                validityDate: getFutureDate(value, parseInt(prev.validityDays, 10) || 0)
            }));
            return;
        }

        setFormData(prev => ({ ...prev, [name]: value }));
    };

    // Cuando el usuario deselecciona el input de cliente manual, consultamos historia si es necesario
    const handleClientBlur = async () => {
        if (formData.clientName.trim().length > 0) {
            try {
                const res = await api.get(`/proposals/client-history?clientName=${encodeURIComponent(formData.clientName)}`);
                setClientHistory(res.data);
            } catch (error) {
                console.error("Error loading client history", error);
            }
        } else {
            setClientHistory([]);
        }
    };

    const handleNextStep = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const res = await api.post('/proposals', {
                clientName: formData.clientName,
                subject: formData.subject,
                issueDate: formData.issueDate,
                validityDays: parseInt(formData.validityDays, 10),
                validityDate: formData.validityDate
            });

            console.log("Propuesta borrador creada:", res.data);
            navigate(`/proposals/${res.data.id}/builder`);
        } catch (error) {
            console.error("Error creating proposal", error);
            alert("No se pudo iniciar la propuesta. Verifica la consola.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-8">
            {/* Header del Asistente */}
            <div>
                <h2 className="text-2xl font-bold tracking-tight text-gray-900">Crear Nueva Propuesta</h2>
                <p className="text-gray-500 text-sm mt-1">Paso 1: Información General del Cliente y la Oferta</p>
            </div>

            {/* Progreso Visual */}
            <div className="flex items-center space-x-4 mb-8">
                <div className="flex items-center text-novo-primary font-semibold">
                    <div className="w-8 h-8 rounded-full bg-novo-primary text-white flex items-center justify-center mr-2 shadow-md shadow-novo-primary/30">1</div>
                    <span className="hidden sm:inline">Información General</span>
                </div>
                <div className="h-px bg-gray-300 flex-1"></div>
                <div className="flex items-center text-gray-400 font-medium opacity-60">
                    <div className="w-8 h-8 rounded-full border-2 border-gray-300 flex items-center justify-center mr-2">2</div>
                    <span className="hidden sm:inline">Constructor de Artículos</span>
                </div>
                <div className="h-px bg-gray-300 flex-1"></div>
                <div className="flex items-center text-gray-400 font-medium opacity-60">
                    <div className="w-8 h-8 rounded-full border-2 border-gray-300 flex items-center justify-center mr-2">3</div>
                    <span className="hidden sm:inline">Generación PDF</span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Formulario Principal */}
                <motion.div
                    initial={{ opacity: 0, x: -15 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden lg:col-span-2"
                >
                    <div className="bg-gray-50/50 p-6 border-b border-gray-100">
                        <h3 className="text-lg font-semibold text-gray-900">Datos de la Propuesta</h3>
                    </div>

                    <form onSubmit={handleNextStep} className="p-6 md:p-8 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* Columna Izquierda */}
                            <div className="space-y-6">
                                <div className="space-y-2 relative" ref={wrapperRef}>
                                    <label className="text-sm font-medium text-gray-700 ml-1">Nombre del Cliente o Empresa</label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                            <Building2 className="h-5 w-5 text-gray-400 group-focus-within:text-novo-primary transition-colors" />
                                        </div>
                                        <input
                                            type="text"
                                            name="clientName"
                                            value={formData.clientName}
                                            onChange={handleClientChange}
                                            onBlur={handleClientBlur}
                                            placeholder="Buscar o crear cliente..."
                                            required
                                            autoComplete="off"
                                            className="block w-full pl-11 pr-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl text-gray-900 focus:ring-2 focus:ring-novo-primary/20 focus:border-novo-primary transition-all text-sm"
                                        />
                                    </div>

                                    {/* Sugerencias Dropdown */}
                                    <AnimatePresence>
                                        {showSuggestions && (clientSuggestions.length > 0 || loadingSuggestions) && (
                                            <motion.div
                                                initial={{ opacity: 0, y: -10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: -10 }}
                                                className="absolute z-10 w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-lg max-h-60 overflow-y-auto"
                                            >
                                                {loadingSuggestions ? (
                                                    <div className="p-4 flex items-center justify-center text-gray-400 text-sm">
                                                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                                        Buscando clientes...
                                                    </div>
                                                ) : (
                                                    <ul className="py-1">
                                                        {clientSuggestions.map((client, idx) => (
                                                            <li
                                                                key={idx}
                                                                onClick={() => selectClient(client)}
                                                                className="px-4 py-2.5 hover:bg-novo-light/50 cursor-pointer flex items-center text-sm text-gray-700 transition-colors"
                                                            >
                                                                <Search className="h-4 w-4 mr-2 text-gray-400" />
                                                                {client}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                )}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700 ml-1">Fecha de Emisión</label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                            <CalendarDays className="h-5 w-5 text-gray-400 group-focus-within:text-novo-primary transition-colors" />
                                        </div>
                                        <input
                                            type="date"
                                            name="issueDate"
                                            value={formData.issueDate}
                                            onChange={handleChange}
                                            required
                                            className="block w-full pl-11 pr-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl text-gray-900 focus:ring-2 focus:ring-novo-primary/20 focus:border-novo-primary transition-all text-sm appearance-none"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-gray-700 ml-1">Días Validez</label>
                                        <div className="relative group">
                                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                                <Clock className="h-5 w-5 text-gray-400 group-focus-within:text-novo-primary transition-colors" />
                                            </div>
                                            <input
                                                type="number"
                                                name="validityDays"
                                                value={formData.validityDays}
                                                onChange={handleChange}
                                                min="1"
                                                required
                                                className="block w-full pl-11 pr-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl text-gray-900 focus:ring-2 focus:ring-novo-primary/20 focus:border-novo-primary transition-all text-sm text-center"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-gray-700 ml-1">Fecha Final</label>
                                        <input
                                            type="date"
                                            name="validityDate"
                                            value={formData.validityDate}
                                            onChange={handleChange}
                                            required
                                            className="block w-full px-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl text-gray-900 focus:ring-2 focus:ring-novo-primary/20 focus:border-novo-primary transition-all text-sm appearance-none"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Columna Derecha */}
                            <div className="space-y-2 h-full flex flex-col">
                                <label className="text-sm font-medium text-gray-700 ml-1">Asunto o Descripción Corta</label>
                                <div className="relative group flex-1">
                                    <div className="absolute top-3 left-0 pl-3.5 flex items-start pointer-events-none">
                                        <FileText className="h-5 w-5 text-gray-400 group-focus-within:text-novo-primary transition-colors mt-0.5" />
                                    </div>
                                    <textarea
                                        name="subject"
                                        value={formData.subject}
                                        onChange={handleChange}
                                        placeholder="Ej. Renovación de licenciamiento Microsoft 365 E3 para 50 usuarios corporativos."
                                        required
                                        className="block w-full h-full min-h-[160px] pl-11 pr-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl text-gray-900 focus:ring-2 focus:ring-novo-primary/20 focus:border-novo-primary transition-all text-sm resize-none"
                                    ></textarea>
                                </div>
                            </div>
                        </div>

                        <div className="pt-8 mt-8 border-t border-gray-100 flex justify-end">
                            <button
                                type="submit"
                                disabled={loading || !formData.clientName}
                                className="flex items-center space-x-2 bg-novo-primary hover:bg-novo-accent disabled:opacity-70 text-white px-8 py-3.5 rounded-xl transition-all font-medium shadow-lg shadow-novo-primary/30 group"
                            >
                                {loading && <Loader2 className="h-5 w-5 animate-spin" />}
                                <span>{loading ? 'Guardando...' : 'Guardar y Continuar'}</span>
                                {!loading && <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />}
                            </button>
                        </div>
                    </form>
                </motion.div>

                {/* Panel Histórico */}
                <motion.div
                    initial={{ opacity: 0, x: 15 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden lg:col-span-1 h-fit"
                >
                    <div className="bg-gradient-to-br from-indigo-50 to-white p-6 border-b border-gray-100">
                        <div className="flex items-center space-x-2 text-indigo-700 mb-1">
                            <AlertCircle className="h-5 w-5" />
                            <h3 className="text-sm font-bold tracking-wide uppercase">Cruce de Cuentas</h3>
                        </div>
                        <p className="text-gray-500 text-xs">Oportunidades creadas para este cliente en el último año.</p>
                    </div>

                    <div className="p-4 max-h-[400px] overflow-y-auto custom-scrollbar">
                        {formData.clientName.trim() === '' ? (
                            <div className="text-center py-10 px-4 text-gray-400 text-sm">
                                Escribe el nombre del cliente para buscar proyectos previos y evitar cruces con otros comerciales.
                            </div>
                        ) : clientHistory.length === 0 ? (
                            <div className="text-center py-10 px-4">
                                <span className="inline-flex items-center justify-center p-3 bg-green-50 rounded-full mb-3 text-green-600">
                                    <Building2 className="h-6 w-6" />
                                </span>
                                <h4 className="text-sm font-semibold text-gray-900">Cliente Libre</h4>
                                <p className="text-xs text-gray-500 mt-1">Nadie del equipo ha cotizado a este cliente en el último año.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {clientHistory.map((item) => (
                                    <div key={item.id} className="p-3.5 bg-gray-50 rounded-xl border border-gray-100 text-sm">
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="font-semibold text-gray-900">{item.proposalCode}</span>
                                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white border border-gray-200 text-gray-600">
                                                {new Date(item.issueDate).toLocaleDateString()}
                                            </span>
                                        </div>
                                        <p className="text-gray-600 text-xs mb-2 line-clamp-2">{item.subject}</p>
                                        <div className="flex flex-col space-y-1 mt-2 pt-2 border-t border-gray-200">
                                            <div className="text-xs flex items-center text-gray-500">
                                                <span className="font-medium mr-1">Comercial:</span>
                                                <span className="bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider">
                                                    {item.user?.name || 'Desconocido'}
                                                </span>
                                            </div>
                                            <div className="text-xs flex items-center text-gray-500">
                                                <span className="font-medium mr-1">Estado:</span> {item.status} ({item.validityDays} días)
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
