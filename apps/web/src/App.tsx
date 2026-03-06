import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { PrivateRoute, AdminRoute } from './components/auth/PrivateRoutes';
import Login from './pages/Login';

// Placeholder components for the main routes
const Dashboard = () => <div className="p-8"><h1>Dashboard (Comerciales y Admin)</h1><button onClick={() => useAuthStore.getState().logout()}>Logout</button></div>;
const AdminPanel = () => <div className="p-8"><h1>Panel de Administración</h1><button onClick={() => useAuthStore.getState().logout()}>Logout</button></div>;

function App() {
  const { checkAuth, isLoading, isAuthenticated, user } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-[#FAF9FB]">Cargando...</div>;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={isAuthenticated ? <Navigate to={user?.role === 'ADMIN' ? '/admin' : '/dashboard'} replace /> : <Login />} />

        {/* Rutas protegidas para todos (Comerciales y Admins) */}
        <Route element={<PrivateRoute />}>
          <Route path="/dashboard" element={<Dashboard />} />
        </Route>

        {/* Rutas exclusivas de Administrador */}
        <Route element={<AdminRoute />}>
          <Route path="/admin" element={<AdminPanel />} />
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
