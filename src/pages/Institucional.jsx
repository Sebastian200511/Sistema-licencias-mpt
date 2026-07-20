import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Mail, Lock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { authService } from '../services/authService';
import Button from '../components/Button';
import InputField from '../components/InputField';
import Alert from '../components/Alert';

export default function Institucional() {
  const navigate = useNavigate();
  const { login, logout, isAuthenticated, userRole } = useAuth();
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      const rolNormalizado = userRole?.toLowerCase();
      if (rolNormalizado === 'inspector') navigate('/inspector', { replace: true });
      else if (rolNormalizado === 'cajero') navigate('/cajero', { replace: true });
      else if (rolNormalizado === 'admin') navigate('/admin', { replace: true });
    }
  }, [isAuthenticated, userRole, navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await authService.loginInterno(loginData.email, loginData.password);

      // Usar el contexto para iniciar sesión
      login(data.rol, data.id);

      // Enrutamiento inteligente basado en el rol (como en un entorno real)
      const rolNormalizado = data.rol?.toLowerCase();
      if (rolNormalizado === 'inspector') {
        navigate('/inspector');
      } else if (rolNormalizado === 'cajero') {
        navigate('/cajero');
      } else if (rolNormalizado === 'admin') {
        navigate('/admin');
      } else {
        setError('El rol asignado no tiene un portal definido.');
        logout();
      }
    } catch (err) {
      setError(err.message || 'Error al conectar con el módulo de seguridad.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4 font-sans">
      <div className="bg-white p-8 sm:p-10 rounded-2xl shadow-2xl w-full max-w-md border-t-8 border-slate-700">
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="bg-slate-800 p-4 rounded-full mb-4 shadow-lg ring-4 ring-slate-100">
            <ShieldCheck className="text-white w-8 h-8" />
          </div>
          <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">Intranet Municipal</h2>
          <p className="text-slate-500 font-medium mt-1 text-sm">Acceso exclusivo para personal autorizado</p>
        </div>

        {error && <Alert type="error" message={error} />}


        <form onSubmit={handleLogin} className="space-y-4">
          <InputField
            label="Correo Electrónico Institucional"
            id="email"
            type="email"
            value={loginData.email}
            onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
            placeholder="ejemplo@mpt.gob.pe"
            required
            icon={Mail}
          />
          
          <InputField
            label="Contraseña"
            id="password"
            type="password"
            value={loginData.password}
            onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
            placeholder="••••••••"
            required
            icon={Lock}
          />

          <Button type="submit" isLoading={loading} className="mt-6">
            Ingresar al Sistema
          </Button>
        </form>

      </div>
    </div>
  );
}
