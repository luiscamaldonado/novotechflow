import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import {
    LayoutDashboard,
    Users,
    Settings,
    LogOut,
    X,
    PlusCircle,
    BookOpen,
    Database
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';

interface SidebarProps {
    isOpen: boolean;
    setIsOpen: (v: boolean) => void;
}

export default function Sidebar({ isOpen, setIsOpen }: SidebarProps) {
    const { user, logout } = useAuthStore();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const navItems = [
        { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
        { icon: PlusCircle, label: 'Nueva Propuesta', path: '/proposals/new' },
    ];

    const adminItems = [
        { icon: Database, label: 'Catálogo de Specs', path: '/admin/spec-options' },
        { icon: Users, label: 'Clientes', path: '/admin/clients' },
        { icon: BookOpen, label: 'Plantillas', path: '/admin/templates' },
        { icon: Users, label: 'Usuarios', path: '/users' },
        { icon: Settings, label: 'Configuración', path: '/settings' },
    ];

    const isAdmin = user?.role === 'ADMIN';

    return (
        <>
            {/* Mobile Overlay */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setIsOpen(false)}
                        className="fixed inset-0 bg-novo-dark/50 z-20 lg:hidden backdrop-blur-sm"
                    />
                )}
            </AnimatePresence>

            {/* Sidebar Component */}
            <motion.aside
                className={cn(
                    "fixed top-0 left-0 z-30 h-screen w-64 bg-novo-dark text-white flex flex-col transition-transform duration-300 lg:translate-x-0 border-r border-novo-secondary/30",
                    isOpen ? "translate-x-0" : "-translate-x-full"
                )}
            >
                <div className="h-20 flex items-center justify-between px-6 bg-novo-dark/50 backdrop-blur-md border-b border-novo-secondary/30">
                    <div className="flex items-center space-x-3">
                        <img src="/novotechflow.png" alt="NovoTechFlow" className="h-8 object-contain drop-shadow-[0_0_8px_rgba(113,58,236,0.5)]" />
                    </div>
                    <button onClick={() => setIsOpen(false)} className="lg:hidden text-gray-400 hover:text-white">
                        <X className="h-6 w-6" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto py-6 px-4 space-y-1 scrollbar-thin scrollbar-thumb-novo-secondary scrollbar-track-transparent">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            onClick={() => setIsOpen(false)}
                            className={({ isActive }) =>
                                cn(
                                    "flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 group",
                                    isActive
                                        ? "bg-novo-primary text-white shadow-md shadow-novo-primary/20"
                                        : "text-gray-300 hover:bg-novo-secondary/50 hover:text-white"
                                )
                            }
                        >
                            <item.icon className="h-5 w-5" />
                            <span className="font-medium text-sm">{item.label}</span>
                        </NavLink>
                    ))}

                    {/* Sección de Administración — solo visible para ADMIN */}
                    {isAdmin && (
                        <>
                            <div className="pt-4 pb-2 px-4">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                                    Administración
                                </span>
                            </div>
                            {adminItems.map((item) => (
                                <NavLink
                                    key={item.path}
                                    to={item.path}
                                    onClick={() => setIsOpen(false)}
                                    className={({ isActive }) =>
                                        cn(
                                            "flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 group",
                                            isActive
                                                ? "bg-novo-primary text-white shadow-md shadow-novo-primary/20"
                                                : "text-gray-300 hover:bg-novo-secondary/50 hover:text-white"
                                        )
                                    }
                                >
                                    <item.icon className="h-5 w-5" />
                                    <span className="font-medium text-sm">{item.label}</span>
                                </NavLink>
                            ))}
                        </>
                    )}
                </div>

                <div className="p-4 border-t border-novo-secondary/30 bg-novo-dark/50">
                    <div className="flex items-center space-x-3 px-4 py-3 mb-2">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-novo-primary to-novo-accent flex items-center justify-center text-sm font-bold shadow-inner">
                            {user?.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">{user?.name}</p>
                            <p className="text-xs text-novo-primary truncate font-semibold">[{user?.nomenclature}]</p>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-gray-400 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                    >
                        <LogOut className="h-5 w-5" />
                        <span className="font-medium text-sm">Cerrar Sesión</span>
                    </button>
                </div>
            </motion.aside>
        </>
    );
}
