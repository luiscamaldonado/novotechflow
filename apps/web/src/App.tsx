import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { PrivateRoute, AdminRoute } from './components/auth/PrivateRoutes';
import AppLayout from './layouts/AppLayout';
import Login from './pages/Login';
import Users from './pages/Users';
import NewProposal from './pages/proposals/NewProposal';
import ProposalItemsBuilder from './pages/proposals/ProposalItemsBuilder';
import ProposalCalculations from './pages/proposals/ProposalCalculations';
import Dashboard from './pages/Dashboard';

// Placeholder components for the main routes


const PdfEditor = () => (
  <div className="space-y-6">
    <div className="mb-8">
      <h2 className="text-2xl font-bold tracking-tight text-gray-900">Editor PDF</h2>
      <p className="text-gray-500">Diseña y edita el diseño de tus propuestas comerciales.</p>
    </div>
    <div className="glass rounded-2xl p-8 bg-white text-center">
      <p className="text-gray-500 py-12">Módulo Editor PDF en Construcción</p>
    </div>
  </div>
);

const AdminPanel = () => (
  <div className="space-y-6">
    <div className="mb-8">
      <h2 className="text-2xl font-bold tracking-tight text-gray-900">Panel de Administración</h2>
      <p className="text-gray-500">Gestión global del sistema NovoTechFlow.</p>
    </div>
    <div className="glass rounded-2xl p-8 bg-white text-center">
      <p className="text-gray-500 py-12">Módulo de Administración en Construcción</p>
    </div>
  </div>
);

function App() {
  const { checkAuth, isLoading, isAuthenticated, user } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-novo-light">
        <div className="w-16 h-16 border-4 border-novo-primary/20 border-t-novo-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={isAuthenticated ? <Navigate to={user?.role === 'ADMIN' ? '/admin' : '/dashboard'} replace /> : <Login />} />

        {/* Rutas protegidas envueltas en el Layout */}
        <Route element={<PrivateRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/proposals/new" element={<NewProposal />} />
            <Route path="/proposals/:id/builder" element={<ProposalItemsBuilder />} />
            <Route path="/proposals/:id/calculations" element={<ProposalCalculations />} />
            <Route path="/pdf-editor" element={<PdfEditor />} />

            {/* Rutas exclusivas de Administrador */}
            <Route element={<AdminRoute />}>
              <Route path="/admin" element={<AdminPanel />} />
              <Route path="/users" element={<Users />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
