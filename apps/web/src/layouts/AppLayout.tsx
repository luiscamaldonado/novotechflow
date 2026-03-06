import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { Menu, Bell } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

export default function AppLayout() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const { user } = useAuthStore();

    return (
        <div className="min-h-screen bg-novo-light flex">
            {/* Sidebar */}
            <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />

            {/* Main Content Wrapper */}
            <div className="flex-1 flex flex-col min-w-0 lg:pl-64 transition-all duration-300">

                {/* Top Navbar */}
                <header className="h-20 bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-10 flex items-center justify-between px-4 sm:px-8">
                    <div className="flex items-center">
                        <button
                            onClick={() => setSidebarOpen(true)}
                            className="lg:hidden p-2 mr-4 text-gray-500 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-novo-primary rounded-lg"
                        >
                            <Menu className="h-6 w-6" />
                        </button>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900 hidden sm:block">
                                Buen día, {user?.name.split(' ')[0]}
                            </h1>
                            <p className="text-sm text-gray-500 hidden sm:block">
                                Listo para crear propuestas increíbles.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center space-x-4">
                        <button className="p-2 text-gray-400 hover:text-novo-primary transition-colors relative">
                            <Bell className="h-6 w-6" />
                            <span className="absolute top-1.5 right-1.5 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
                        </button>
                    </div>
                </header>

                {/* Page Content */}
                <main className="flex-1 overflow-x-hidden overflow-y-auto bg-[#FAF9FB] p-4 sm:p-8">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
