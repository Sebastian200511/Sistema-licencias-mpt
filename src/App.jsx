import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import Solicitud from './pages/Solicitud';
import Seguimiento from './pages/Seguimiento';
import Inspector from './pages/Inspector';
import Cajero from './pages/Cajero';
import Institucional from './pages/Institucional'; // <- Nuevo login institucional

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/solicitud" element={<Solicitud />} />
        <Route path="/seguimiento" element={<Seguimiento />} />
        <Route path="/institucional" element={<Institucional />} /> {/* <- Nueva ruta Login */}
        <Route path="/inspector" element={<Inspector />} />
        <Route path="/cajero" element={<Cajero />} />
      </Routes>
    </Router>
  );
}

export default App;