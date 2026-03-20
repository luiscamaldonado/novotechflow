import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';
import { Lock, Mail, ArrowRight, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Login() {
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const { login } = useAuthStore();
    const navigate = useNavigate();

    const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const formData = new FormData(e.currentTarget);
        const email = formData.get('email') as string;
        const password = formData.get('password') as string;

        try {
            const response = await api.post('/auth/login', { email, password });
            login(response.data.access_token, response.data.user);

            if (response.data.user.role === 'ADMIN') {
                navigate('/admin');
            } else {
                navigate('/dashboard');
            }
        } catch {
            setError('Credenciales inválidas. Por favor intenta de nuevo.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#070314] flex items-center justify-center p-4 sm:p-8 relative overflow-hidden">

            {/* Background Decorative Elements */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-novo-primary/20 rounded-full blur-[120px]" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-novo-dark/10 rounded-full blur-[120px]" />

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="w-full max-w-5xl bg-novo-dark rounded-3xl shadow-[0_0_50px_-12px_rgba(113,58,236,0.3)] overflow-hidden flex flex-col md:flex-row z-10 border border-novo-secondary"
            >
                {/* Left Side: Branding & Info */}
                <div className="md:w-5/12 bg-novo-dark p-12 text-white flex flex-col justify-between relative overflow-hidden">

                    {/* Glassmorphism subtle overlay */}
                    <div className="absolute inset-0 bg-gradient-to-br from-novo-secondary/40 to-novo-dark/90 z-0" />

                    <div className="relative z-10">
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.3 }}
                            className="flex items-center space-x-3 mb-12"
                        >
                            <img src="/novotechflow.png" alt="NovoTechFlow" className="h-[4.5rem] object-contain drop-shadow-[0_0_15px_rgba(113,58,236,0.5)]" />
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.5 }}
                        >
                            <h2 className="text-3xl font-bold mb-4 leading-tight">
                                Generador de <br /><span className="text-novo-primary">Propuestas Comerciales</span>
                            </h2>
                            <p className="text-white/70 text-sm leading-relaxed mb-8">
                                Diseñado exclusivamente para el canal corporativo de NOVOTECHNO DE COLOMBIA. Gestiona, cotiza y genera PDFs de grado empresarial en segundos.
                            </p>
                        </motion.div>
                    </div>

                    <div className="relative z-10 text-xs text-white/40">
                        © 2026 Novotechno de Colombia. Todos los derechos reservados.
                    </div>
                </div>

                {/* Right Side: Login Form */}
                <div className="md:w-7/12 p-10 md:p-14 lg:p-16 flex flex-col justify-center bg-[#130A33] relative">
                    <div className="max-w-md mx-auto w-full relative z-10">
                        <h3 className="text-2xl font-bold text-white mb-2">Ingreso al Sistema</h3>
                        <p className="text-sm text-gray-300 mb-8">Ingresa tus credenciales corporativas para continuar.</p>

                        <form onSubmit={handleLogin} className="space-y-6">
                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    className="bg-red-50 border border-red-100 text-red-600 p-4 rounded-xl text-sm flex items-start"
                                >
                                    {error}
                                </motion.div>
                            )}

                            <div className="space-y-1">
                                <label className="text-sm font-medium text-gray-200 ml-1">Correo Electrónico</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors group-focus-within:text-novo-primary">
                                        <Mail className="h-5 w-5 text-gray-400 group-focus-within:text-novo-primary" />
                                    </div>
                                    <input
                                        type="email"
                                        name="email"
                                        required
                                        className="block w-full pl-11 pr-4 py-3.5 bg-novo-dark/80 border border-novo-secondary rounded-xl text-white placeholder-gray-500 focus:ring-2 focus:ring-novo-primary/40 focus:border-novo-primary transition-all duration-200 sm:text-sm"
                                        placeholder="tucorreo@novotechno.com"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <div className="flex items-center justify-between ml-1">
                                    <label className="text-sm font-medium text-gray-200">Contraseña</label>
                                </div>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors group-focus-within:text-novo-primary">
                                        <Lock className="h-5 w-5 text-gray-400 group-focus-within:text-novo-primary" />
                                    </div>
                                    <input
                                        type="password"
                                        name="password"
                                        required
                                        className="block w-full pl-11 pr-4 py-3.5 bg-novo-dark/80 border border-novo-secondary rounded-xl text-white placeholder-gray-500 focus:ring-2 focus:ring-novo-primary/40 focus:border-novo-primary transition-all duration-200 sm:text-sm"
                                        placeholder="••••••••"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full relative flex items-center justify-center py-3.5 px-4 rounded-xl text-sm font-semibold text-white bg-novo-primary hover:bg-novo-accent focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-novo-primary shadow-lg shadow-novo-primary/30 disabled:opacity-70 transition-all duration-200 group overflow-hidden"
                            >
                                {loading ? (
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                ) : (
                                    <>
                                        <span className="mr-2">Iniciar Sesión</span>
                                        <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                                    </>
                                )}
                                {/* Shine effect */}
                                <div className="absolute top-0 -inset-full h-full w-1/2 z-5 block transform -skew-x-12 bg-gradient-to-r from-transparent to-white opacity-20 group-hover:animate-shine" />
                            </button>
                        </form>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
