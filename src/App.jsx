import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import Solicitud from './pages/Solicitud';
import Seguimiento from './pages/Seguimiento';
import Inspector from './pages/Inspector'; // <- Nueva importación
import Cajero from './pages/Cajero'; // <- Nueva importación Cajero

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/solicitud" element={<Solicitud />} />
        <Route path="/seguimiento" element={<Seguimiento />} />
        <Route path="/inspector" element={<Inspector />} /> {/* <- Nueva ruta */}
        <Route path="/cajero" element={<Cajero />} /> {/* <- Nueva ruta Cajero */}
      </Routes>
    </Router>
  );
}

export default App;