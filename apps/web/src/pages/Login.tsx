import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';
import { ArrowRight, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import type { AuthUser } from '../lib/types';
import VerificationCode from './VerificationCode';

interface VerificationData {
    userId: string;
    email: string;
}

export default function Login() {
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [verificationData, setVerificationData] = useState<VerificationData | null>(null);
    const { login } = useAuthStore();
    const navigate = useNavigate();

    const navigateByRole = (role: string) => {
        navigate(role === 'ADMIN' ? '/admin' : '/dashboard');
    };

    const handleVerified = (data: { access_token: string; user: AuthUser }) => {
        login(data.access_token, data.user);
        navigateByRole(data.user.role);
    };

    const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const formData = new FormData(e.currentTarget);
        const email = formData.get('email') as string;
        const password = formData.get('password') as string;

        try {
            const response = await api.post('/auth/login', { email, password });

            if (response.data.requiresVerification) {
                setVerificationData({
                    userId: response.data.userId,
                    email: response.data.email,
                });
                return;
            }

            login(response.data.access_token, response.data.user);
            navigateByRole(response.data.user.role);
        } catch {
            setError('Credenciales inv\u00e1lidas. Por favor intenta de nuevo.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen">

            {/* Verification mode */}
            {verificationData ? (
                <>
                    {/* Left Side: Branding — hidden on mobile */}
                    <div
                        className="hidden md:flex w-2/5 min-h-screen flex-col justify-between relative overflow-hidden p-10"
                        style={{ background: 'linear-gradient(to bottom, #0F0A2A, #1A1145)' }}
                    >
                        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/10 rounded-full blur-[120px]" />
                        <div className="absolute bottom-[-15%] right-[-10%] w-[45%] h-[45%] bg-indigo-600/10 rounded-full blur-[120px]" />
                        <div className="absolute top-[50%] right-[-20%] w-[40%] h-[40%] bg-indigo-600/10 rounded-full blur-[120px]" />
                        <div className="relative z-10">
                            <img src="/novotechflow.png" alt="NovoTechFlow" className="h-12 object-contain" />
                        </div>
                        <div className="relative z-10 flex-1 flex flex-col items-start justify-center">
                            <h1 className="text-4xl font-black tracking-tight text-white leading-tight">
                                Verificaci{'\u00f3'}n
                                <br />
                                <span className="text-indigo-400">en dos pasos</span>
                            </h1>
                            <p className="mt-4 text-sm text-white/50 max-w-xs">
                                Protegemos tu cuenta con un c{'\u00f3'}digo de verificaci{'\u00f3'}n enviado a tu correo
                            </p>
                        </div>
                        <div className="relative z-10">
                            <span className="text-xs text-white/30">{'\u00a9'} 2026 Novotechno de Colombia</span>
                        </div>
                    </div>

                    <VerificationCode
                        userId={verificationData.userId}
                        email={verificationData.email}
                        onVerified={handleVerified}
                        onCancel={() => setVerificationData(null)}
                    />
                </>
            ) : (
                <>

            <div
                className="hidden md:flex w-2/5 min-h-screen flex-col justify-between relative overflow-hidden p-10"
                style={{ background: 'linear-gradient(to bottom, #0F0A2A, #1A1145)' }}
            >
                {/* Decorative blurred circles */}
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/10 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-15%] right-[-10%] w-[45%] h-[45%] bg-indigo-600/10 rounded-full blur-[120px]" />
                <div className="absolute top-[50%] right-[-20%] w-[40%] h-[40%] bg-indigo-600/10 rounded-full blur-[120px]" />

                {/* Logo */}
                <div className="relative z-10">
                    <img src="/novotechflow.png" alt="NovoTechFlow" className="h-12 object-contain" />
                </div>

                {/* Centered title */}
                <div className="relative z-10 flex-1 flex flex-col items-start justify-center">
                    <h1 className="text-4xl font-black tracking-tight text-white leading-tight">
                        Cotiza. Modela.
                        <br />
                        <span className="text-indigo-400">Cierra negocios.</span>
                    </h1>
                    <p className="mt-4 text-sm text-white/50 max-w-xs">
                        Plataforma de gestión de propuestas comerciales para Novotechno de Colombia
                    </p>
                </div>

                {/* Footer */}
                <div className="relative z-10">
                    <span className="text-xs text-white/30">© 2026 Novotechno de Colombia</span>
                </div>
            </div>

            {/* Right Side: Form */}
            <div className="w-full md:w-3/5 min-h-screen bg-white flex items-center justify-center px-6">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                    className="w-full max-w-sm"
                >
                    {/* Mobile logo */}
                    <img src="/novotechflow.png" alt="NovoTechFlow" className="h-8 mb-8 md:hidden" />

                    {/* Form header */}
                    <h2 className="text-3xl font-black text-slate-900">Bienvenido</h2>
                    <p className="text-sm text-slate-400 mt-1 mb-8">
                        Ingresa tus credenciales para continuar.
                    </p>

                    <form onSubmit={handleLogin} className="space-y-5">
                        {error && (
                            <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl p-3 text-sm">
                                {error}
                            </div>
                        )}

                        {/* Email */}
                        <div className="space-y-1.5">
                            <label
                                htmlFor="login-email"
                                className="text-xs font-bold text-slate-500 uppercase tracking-wider"
                            >
                                Correo Electrónico
                            </label>
                            <input
                                id="login-email"
                                type="email"
                                name="email"
                                required
                                placeholder="tucorreo@novotechno.com"
                                className="block w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-slate-900 text-sm placeholder-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
                            />
                        </div>

                        {/* Password */}
                        <div className="space-y-1.5">
                            <label
                                htmlFor="login-password"
                                className="text-xs font-bold text-slate-500 uppercase tracking-wider"
                            >
                                Contraseña
                            </label>
                            <input
                                id="login-password"
                                type="password"
                                name="password"
                                required
                                placeholder="••••••••"
                                className="block w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-slate-900 text-sm placeholder-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
                            />
                        </div>

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3.5 rounded-xl font-bold text-sm shadow-lg shadow-indigo-200 transition-all disabled:opacity-70 flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                                <>
                                    <span>Iniciar Sesión</span>
                                    <ArrowRight className="h-4 w-4" />
                                </>
                            )}
                        </button>
                    </form>

                    <p className="text-xs text-slate-300 text-center mt-6">
                        Acceso exclusivo para colaboradores
                    </p>
                </motion.div>
            </div>
                </>
            )}
        </div>
    );
}
