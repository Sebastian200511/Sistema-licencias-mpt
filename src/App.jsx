import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import Solicitud from './pages/Solicitud';
import Seguimiento from './pages/Seguimiento';
import Inspector from './pages/Inspector'; // <- Nueva importación

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/solicitud" element={<Solicitud />} />
        <Route path="/seguimiento" element={<Seguimiento />} />
        <Route path="/inspector" element={<Inspector />} /> {/* <- Nueva ruta */}
      </Routes>
    </Router>
  );
}

export default App;