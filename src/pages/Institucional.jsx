import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { ShieldCheck } from 'lucide-react';

export default function Institucional() {
  const navigate = useNavigate();
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data, error: authError } = await supabase
        .from('usuarios_internos')
        .select('*')
        .eq('email', loginData.email.trim())
        .eq('password', loginData.password)
        .single();

      if (authError || !data) {
        setError('Credenciales institucionales incorrectas.');
        setLoading(false);
        return;
      }

      // Guardamos la sesión y el rol
      localStorage.setItem('inst_session', 'true');
      localStorage.setItem('inst_role', data.rol);

      // Enrutamiento inteligente basado en el rol (como en un entorno real)
      if (data.rol === 'Inspector') {
        navigate('/inspector');
      } else if (data.rol === 'Cajero') {
        navigate('/cajero');
      } else {
        setError('El rol asignado no tiene un portal definido.');
        localStorage.clear();
      }
    } catch (err) {
      setError('Error al conectar con el módulo de seguridad.');
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

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded mb-6 text-sm font-medium">
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Correo Electrónico</label>
            <input 
              type="email" required
              value={loginData.email} onChange={(e) => setLoginData({...loginData, email: e.target.value})}
              className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-800 focus:border-slate-800 outline-none transition"
              placeholder="usuario@mpt.gob.pe"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Contraseña</label>
            <input 
              type="password" required
              value={loginData.password} onChange={(e) => setLoginData({...loginData, password: e.target.value})}
              className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-800 focus:border-slate-800 outline-none transition"
              placeholder="••••••••"
            />
          </div>
          <button disabled={loading} type="submit" className="w-full bg-slate-800 hover:bg-slate-950 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg hover:shadow-xl disabled:opacity-70 mt-2">
            {loading ? 'Autenticando...' : 'Iniciar Sesión'}
          </button>
        </form>
      </div>
    </div>
  );
}
