import { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { PrivateRoute, AdminRoute } from './components/auth/PrivateRoutes';
import { ErrorBoundary } from './components/ErrorBoundary';
import AppLayout from './layouts/AppLayout';
import Login from './pages/Login';

// Lazy-loaded page components (code splitting)
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Users = lazy(() => import('./pages/Users'));
const NewProposal = lazy(() => import('./pages/proposals/NewProposal'));
const ProposalItemsBuilder = lazy(() => import('./pages/proposals/ProposalItemsBuilder'));
const ProposalCalculations = lazy(() => import('./pages/proposals/ProposalCalculations'));
const ProposalDocBuilder = lazy(() => import('./pages/proposals/ProposalDocBuilder'));
const DefaultPagesAdmin = lazy(() => import('./pages/admin/DefaultPagesAdmin'));
const SpecOptionsAdmin = lazy(() => import('./pages/admin/SpecOptionsAdmin'));
const ClientsAdmin = lazy(() => import('./pages/admin/ClientsAdmin'));


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

/** Spinner de carga para Suspense fallback. */
const PageLoader = () => (
  <div className="flex items-center justify-center p-20">
    <div className="w-10 h-10 border-4 border-novo-primary/20 border-t-novo-primary rounded-full animate-spin" />
  </div>
);

function App() {
  const { checkAuth, isLoading, isAuthenticated } = useAuthStore();

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
      <ErrorBoundary moduleName="Aplicación">
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />} />

            {/* Rutas protegidas envueltas en el Layout */}
            <Route element={<PrivateRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/proposals/new" element={<NewProposal />} />
                <Route path="/proposals/:id/builder" element={<ProposalItemsBuilder />} />
                <Route path="/proposals/:id/calculations" element={<ProposalCalculations />} />
                <Route path="/proposals/:id/document" element={<ProposalDocBuilder />} />

                {/* Rutas exclusivas de Administrador */}
                <Route element={<AdminRoute />}>
                  <Route path="/admin" element={<AdminPanel />} />
                  <Route path="/admin/templates" element={<DefaultPagesAdmin />} />
                  <Route path="/admin/spec-options" element={<SpecOptionsAdmin />} />
                  <Route path="/admin/clients" element={<ClientsAdmin />} />
                  <Route path="/users" element={<Users />} />
                </Route>
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </BrowserRouter>
  );
}

export default App;
