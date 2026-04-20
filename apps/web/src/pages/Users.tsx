import { useState, useEffect, useRef } from 'react';
import {
    Plus,
    User,
    Mail,
    Shield,
    KeyRound,
    Building,
    Trash2,
    Edit,
    Save,
    X,
    Loader2,
    Upload,
    FileSignature,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../lib/api';
import { validateImageFile, ACCEPT_IMAGES } from '../lib/file-validation';

interface UserData {
    id: string;
    name: string;
    email: string;
    role: 'ADMIN' | 'COMMERCIAL';
    nomenclature: string;
    signatureUrl?: string | null;
    isActive: boolean;
    proposalCounterStart: number;
}

export default function Users() {
    const [users, setUsers] = useState<UserData[]>([]);
    const [isCreating, setIsCreating] = useState(false);
    const [editingUser, setEditingUser] = useState<UserData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [uploadingSignature, setUploadingSignature] = useState<string | null>(null);
    const signatureInputRef = useRef<HTMLInputElement>(null);

    const apiBase = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3000';

    const loadUsers = async () => {
        try {
            setIsLoading(true);
            const response = await api.get('/users');
            setUsers(response.data);
        } catch (err) {
            console.error('Error loading users:', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadUsers();
    }, []);

    const handleCreateUser = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsSaving(true);
        setError(null);

        const formData = new FormData(e.currentTarget);

        const proposalCounterStartRaw = formData.get('proposalCounterStart');
        const proposalCounterStart = proposalCounterStartRaw
            ? parseInt(proposalCounterStartRaw as string, 10)
            : 0;

        if (Number.isNaN(proposalCounterStart) || proposalCounterStart < 0) {
            setError('El consecutivo inicial debe ser un número mayor o igual a 0.');
            setIsSaving(false);
            return;
        }

        const data = {
            name: formData.get('name'),
            email: formData.get('email'),
            role: formData.get('role'),
            nomenclature: (formData.get('nomenclature') as string).toUpperCase(),
            password: formData.get('password'),
            proposalCounterStart,
        };

        try {
            await api.post('/users', data);
            setIsCreating(false);
            loadUsers();
        } catch (err: unknown) {
            const axiosErr = err as { response?: { data?: { message?: string | string[] } } };
            const msg = axiosErr.response?.data?.message;
            setError(Array.isArray(msg) ? msg.join(', ') : (msg || 'Error al crear el usuario. Verifica que el correo o nomenclatura no estén duplicados.'));
        } finally {
            setIsSaving(false);
        }
    };

    const handleUpdateUser = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!editingUser) return;
        setIsSaving(true);
        setError(null);

        const formData = new FormData(e.currentTarget);
        const passwordValue = (formData.get('password') as string).trim();

        const data: Record<string, unknown> = {
            name: formData.get('name'),
            email: formData.get('email'),
            role: formData.get('role'),
            nomenclature: (formData.get('nomenclature') as string).toUpperCase(),
            isActive: formData.get('isActive') === 'true',
        };
        if (passwordValue.length > 0) {
            data.password = passwordValue;
        }

        try {
            await api.patch(`/users/${editingUser.id}`, data);
            setEditingUser(null);
            loadUsers();
        } catch (err: unknown) {
            const axiosErr = err as { response?: { data?: { message?: string | string[] } } };
            const msg = axiosErr.response?.data?.message;
            setError(Array.isArray(msg) ? msg.join(', ') : (msg || 'Error al actualizar el usuario.'));
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteUser = async (id: string, name: string) => {
        if (!window.confirm(`¿Estás seguro que deseas eliminar al usuario ${name}? Esta acción no se puede deshacer.`)) {
            return;
        }

        try {
            await api.delete(`/users/${id}`);
            loadUsers();
        } catch (err) {
            alert('Hubo un error al intentar eliminar el usuario.');
            console.error(err);
        }
    };

    const handleSignatureUpload = async (userId: string) => {
        setUploadingSignature(userId);
        signatureInputRef.current?.click();
    };

    const handleSignatureFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !uploadingSignature) return;

        const validation = await validateImageFile(file);
        if (!validation.valid) {
            alert(validation.error);
            setUploadingSignature(null);
            if (signatureInputRef.current) signatureInputRef.current.value = '';
            return;
        }

        try {
            const formData = new FormData();
            formData.append('file', file);
            await api.post(`/users/${uploadingSignature}/signature`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            loadUsers();
        } catch (err) {
            console.error('Error uploading signature:', err);
            alert('Error al subir la firma. Verifica que el archivo sea una imagen válida.');
        } finally {
            setUploadingSignature(null);
            if (signatureInputRef.current) signatureInputRef.current.value = '';
        }
    };

    const handleDeleteSignature = async (userId: string) => {
        if (!window.confirm('¿Estás seguro de que deseas eliminar la firma de este usuario?')) return;
        try {
            await api.delete(`/users/${userId}/signature`);
            loadUsers();
        } catch (err) {
            console.error('Error deleting signature:', err);
            alert('Error al eliminar la firma.');
        }
    };

    return (
        <div className="space-y-6">
            {/* Hidden file input for signature upload */}
            <input
                ref={signatureInputRef}
                type="file"
                accept={ACCEPT_IMAGES}
                className="hidden"
                onChange={handleSignatureFileChange}
            />

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-gray-900">Gestión de Usuarios</h2>
                    <p className="text-gray-500 text-sm mt-1">Administra los accesos y roles de los comerciales del sistema.</p>
                </div>

                {!isCreating && !editingUser && (
                    <button
                        onClick={() => {
                            setIsCreating(true);
                            setError(null);
                        }}
                        className="flex items-center justify-center space-x-2 bg-novo-primary hover:bg-novo-accent text-white px-4 py-2.5 rounded-xl shadow-lg shadow-novo-primary/30 transition-all text-sm font-medium"
                    >
                        <Plus className="h-5 w-5" />
                        <span>Nuevo Usuario</span>
                    </button>
                )}
            </div>

            <AnimatePresence mode="wait">
                {isCreating ? (
                    <motion.div
                        key="create-form"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
                    >
                        <div className="bg-gray-50/50 p-6 border-b border-gray-100 flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-gray-900">Crear Nuevo Usuario</h3>
                            <button onClick={() => setIsCreating(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <form onSubmit={handleCreateUser} className="p-6 md:p-8">

                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    className="bg-red-50 border border-red-100 text-red-600 p-4 rounded-xl text-sm mb-6"
                                >
                                    {error}
                                </motion.div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700 ml-1">Nombre Completo</label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                            <User className="h-4 w-4 text-gray-400 group-focus-within:text-novo-primary transition-colors" />
                                        </div>
                                        <input type="text" name="name" placeholder="Ej. Carlos Mendoza" required
                                            className="block w-full pl-10 pr-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-novo-primary/20 focus:border-novo-primary transition-all"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700 ml-1">Correo Electrónico</label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                            <Mail className="h-4 w-4 text-gray-400 group-focus-within:text-novo-primary transition-colors" />
                                        </div>
                                        <input type="email" name="email" placeholder="correo@novotechno.com" required
                                            className="block w-full pl-10 pr-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-novo-primary/20 focus:border-novo-primary transition-all"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700 ml-1">Rol en el Sistema</label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                            <Shield className="h-4 w-4 text-gray-400 group-focus-within:text-novo-primary transition-colors" />
                                        </div>
                                        <select name="role" required defaultValue=""
                                            className="block w-full pl-10 pr-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-novo-primary/20 focus:border-novo-primary transition-all appearance-none"
                                        >
                                            <option value="" disabled>Selecciona un rol</option>
                                            <option value="COMMERCIAL">Comercial</option>
                                            <option value="ADMIN">Administrador</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700 ml-1">Nomenclatura (Iniciales)</label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                            <Building className="h-4 w-4 text-gray-400 group-focus-within:text-novo-primary transition-colors" />
                                        </div>
                                        <input type="text" name="nomenclature" placeholder="Ej. CME" maxLength={10} required
                                            className="block w-full pl-10 pr-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-novo-primary/20 focus:border-novo-primary transition-all uppercase"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2 md:col-span-2">
                                    <label className="text-sm font-medium text-gray-700 ml-1">Contraseña Temporal</label>
                                    <div className="relative group max-w-md">
                                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                            <KeyRound className="h-4 w-4 text-gray-400 group-focus-within:text-novo-primary transition-colors" />
                                        </div>
                                        <input type="password" name="password" placeholder="••••••••" required
                                            className="block w-full pl-10 pr-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-novo-primary/20 focus:border-novo-primary transition-all"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2 md:col-span-2">
                                    <label className="text-sm font-medium text-gray-700 ml-1">Consecutivo Inicial de Cotizaciones</label>
                                    <p className="text-xs text-gray-500 ml-1">
                                        Si este comercial ya tenía un consecutivo histórico fuera del sistema, ingresá el último número usado.
                                        Su primera cotización local empezará desde ese valor + 1. Dejar en 0 para empezar desde COT-XX0001.
                                    </p>
                                    <div className="relative group max-w-xs">
                                        <input
                                            type="number"
                                            name="proposalCounterStart"
                                            min="0"
                                            defaultValue="0"
                                            className="block w-full px-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-novo-primary/20 focus:border-novo-primary transition-all"
                                        />
                                    </div>
                                    <p className="text-xs text-amber-600 ml-1">
                                        ⚠️ Este valor solo se puede definir al crear el usuario. No se podrá modificar después.
                                    </p>
                                </div>
                            </div>

                            <div className="mt-8 flex items-center space-x-3">
                                <button disabled={isSaving} type="submit" className="flex items-center space-x-2 bg-novo-primary hover:bg-novo-accent disabled:opacity-70 text-white px-5 py-2.5 rounded-xl transition-all text-sm font-medium">
                                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                    <span>{isSaving ? 'Guardando...' : 'Guardar Usuario'}</span>
                                </button>
                                <button disabled={isSaving} type="button" onClick={() => setIsCreating(false)} className="px-5 py-2.5 bg-white border border-gray-200 disabled:opacity-50 text-gray-700 hover:bg-gray-50 rounded-xl transition-all text-sm font-medium">
                                    Cancelar
                                </button>
                            </div>
                        </form>
                    </motion.div>
                ) : editingUser ? (
                    <motion.div
                        key="edit-form"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
                    >
                        <div className="bg-gray-50/50 p-6 border-b border-gray-100 flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-gray-900">Editar Usuario: {editingUser.name}</h3>
                            <button onClick={() => setEditingUser(null)} className="text-gray-400 hover:text-gray-600 transition-colors">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <form onSubmit={handleUpdateUser} className="p-6 md:p-8">

                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    className="bg-red-50 border border-red-100 text-red-600 p-4 rounded-xl text-sm mb-6"
                                >
                                    {error}
                                </motion.div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700 ml-1">Nombre Completo</label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                            <User className="h-4 w-4 text-gray-400 group-focus-within:text-novo-primary transition-colors" />
                                        </div>
                                        <input type="text" name="name" placeholder="Ej. Carlos Mendoza" required
                                            defaultValue={editingUser.name}
                                            className="block w-full pl-10 pr-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-novo-primary/20 focus:border-novo-primary transition-all"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700 ml-1">Correo Electrónico</label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                            <Mail className="h-4 w-4 text-gray-400 group-focus-within:text-novo-primary transition-colors" />
                                        </div>
                                        <input type="email" name="email" placeholder="correo@novotechno.com" required
                                            defaultValue={editingUser.email}
                                            className="block w-full pl-10 pr-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-novo-primary/20 focus:border-novo-primary transition-all"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700 ml-1">Rol en el Sistema</label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                            <Shield className="h-4 w-4 text-gray-400 group-focus-within:text-novo-primary transition-colors" />
                                        </div>
                                        <select name="role" required defaultValue={editingUser.role}
                                            className="block w-full pl-10 pr-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-novo-primary/20 focus:border-novo-primary transition-all appearance-none"
                                        >
                                            <option value="COMMERCIAL">Comercial</option>
                                            <option value="ADMIN">Administrador</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700 ml-1">Nomenclatura (Iniciales)</label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                            <Building className="h-4 w-4 text-gray-400 group-focus-within:text-novo-primary transition-colors" />
                                        </div>
                                        <input type="text" name="nomenclature" placeholder="Ej. CME" maxLength={10} required
                                            defaultValue={editingUser.nomenclature}
                                            className="block w-full pl-10 pr-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-novo-primary/20 focus:border-novo-primary transition-all uppercase"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700 ml-1">Nueva Contraseña (dejar vacío para no cambiar)</label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                            <KeyRound className="h-4 w-4 text-gray-400 group-focus-within:text-novo-primary transition-colors" />
                                        </div>
                                        <input type="password" name="password" placeholder="Dejar vacío para mantener la actual"
                                            className="block w-full pl-10 pr-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-novo-primary/20 focus:border-novo-primary transition-all"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700 ml-1">Estado</label>
                                    <div className="relative group">
                                        <select name="isActive" defaultValue={editingUser.isActive ? 'true' : 'false'}
                                            className="block w-full px-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-novo-primary/20 focus:border-novo-primary transition-all appearance-none"
                                        >
                                            <option value="true">Activo</option>
                                            <option value="false">Inactivo</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-4 px-1 py-2 text-xs text-gray-400">
                                Consecutivo inicial: <span className="font-mono font-semibold text-gray-500">{editingUser.proposalCounterStart}</span> (no editable)
                            </div>

                            <div className="mt-6 flex items-center space-x-3">
                                <button disabled={isSaving} type="submit" className="flex items-center space-x-2 bg-novo-primary hover:bg-novo-accent disabled:opacity-70 text-white px-5 py-2.5 rounded-xl transition-all text-sm font-medium">
                                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                    <span>{isSaving ? 'Guardando...' : 'Guardar Cambios'}</span>
                                </button>
                                <button disabled={isSaving} type="button" onClick={() => setEditingUser(null)} className="px-5 py-2.5 bg-white border border-gray-200 disabled:opacity-50 text-gray-700 hover:bg-gray-50 rounded-xl transition-all text-sm font-medium">
                                    Cancelar
                                </button>
                            </div>
                        </form>
                    </motion.div>
                ) : (
                    <motion.div
                        key="users-list"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
                    >
                        <div className="overflow-x-auto min-h-[400px]">
                            {isLoading ? (
                                <div className="flex items-center justify-center p-20">
                                    <Loader2 className="h-8 w-8 animate-spin text-novo-primary/50" />
                                </div>
                            ) : (
                                <table className="w-full text-left text-sm text-gray-500">
                                    <thead className="text-xs text-gray-400 uppercase bg-gray-50/50 border-b border-gray-100">
                                        <tr>
                                            <th className="px-6 py-4 font-medium">Usuario / Correo</th>
                                            <th className="px-6 py-4 font-medium">Rol</th>
                                            <th className="px-6 py-4 font-medium">Nom.</th>
                                            <th className="px-6 py-4 font-medium">Firma</th>
                                            <th className="px-6 py-4 font-medium text-right">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {users.map((u) => (
                                            <tr key={u.id} className="hover:bg-gray-50/50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center space-x-3">
                                                        <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-novo-primary/20 to-novo-accent/20 text-novo-primary flex items-center justify-center font-bold text-xs uppercase">
                                                            {u.name.charAt(0)}
                                                        </div>
                                                        <div>
                                                            <div className="font-medium text-gray-900">{u.name}</div>
                                                            <div className="text-xs text-gray-400">{u.email}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wider ${u.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' : 'bg-blue-50 text-blue-600'
                                                        }`}>
                                                        {u.role === 'ADMIN' ? 'ADMIN' : 'COMERCIAL'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="font-mono text-xs font-semibold text-gray-600">{u.nomenclature}</span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    {u.signatureUrl ? (
                                                        <div className="flex items-center space-x-2">
                                                            <div className="w-16 h-10 rounded-lg border border-gray-200 overflow-hidden bg-white flex items-center justify-center">
                                                                <img
                                                                    src={`${apiBase}${u.signatureUrl}`}
                                                                    alt="Firma"
                                                                    className="max-w-full max-h-full object-contain"
                                                                />
                                                            </div>
                                                            <button
                                                                onClick={() => handleSignatureUpload(u.id)}
                                                                className="p-1.5 text-gray-400 hover:text-novo-primary hover:bg-gray-50 rounded-lg transition-all"
                                                                title="Cambiar firma"
                                                            >
                                                                <Upload className="h-3.5 w-3.5" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteSignature(u.id)}
                                                                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                                title="Eliminar firma"
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={() => handleSignatureUpload(u.id)}
                                                            className="flex items-center space-x-1.5 text-xs text-gray-400 hover:text-novo-primary transition-colors group"
                                                        >
                                                            <FileSignature className="h-4 w-4 group-hover:text-novo-primary" />
                                                            <span className="group-hover:text-novo-primary font-medium">Subir firma</span>
                                                        </button>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex items-center justify-end space-x-2">
                                                        <button
                                                            onClick={() => { setEditingUser(u); setError(null); }}
                                                            className="p-2 text-gray-400 hover:text-novo-primary bg-white hover:bg-gray-50 rounded-lg border border-transparent hover:border-gray-200 transition-all"
                                                            title="Editar usuario"
                                                        >
                                                            <Edit className="h-4 w-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteUser(u.id, u.name)}
                                                            className="p-2 text-gray-400 hover:text-red-500 bg-white hover:bg-red-50 rounded-lg border border-transparent hover:border-red-100 transition-all"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                            {!isLoading && users.length === 0 && (
                                <div className="p-12 text-center text-gray-500">
                                    No hay usuarios registrados aún.
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
