import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import PublicLayout from './layouts/PublicLayout';
import IntranetLayout from './layouts/IntranetLayout';

import Login from './pages/Login';
import Solicitud from './pages/Solicitud';
import Seguimiento from './pages/Seguimiento';
import Inspector from './pages/Inspector';
import Cajero from './pages/Cajero';
import Admin from './pages/Admin';
import Institucional from './pages/Institucional';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Rutas Públicas */}
          <Route element={<PublicLayout />}>
            <Route path="/" element={<Login />} />
            <Route path="/solicitud" element={<Solicitud />} />
            <Route path="/seguimiento" element={<Seguimiento />} />
            <Route path="/institucional" element={<Institucional />} />
          </Route>

          {/* Rutas Privadas / Intranet */}
          <Route element={<IntranetLayout />}>
            <Route element={<ProtectedRoute allowedRoles={['Inspector']} />}>
              <Route path="/inspector" element={<Inspector />} />
            </Route>
            <Route element={<ProtectedRoute allowedRoles={['Cajero']} />}>
              <Route path="/cajero" element={<Cajero />} />
            </Route>
            <Route element={<ProtectedRoute allowedRoles={['Admin']} />}>
              <Route path="/admin" element={<Admin />} />
            </Route>
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;