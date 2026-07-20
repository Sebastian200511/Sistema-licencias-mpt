import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound, CheckCircle } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { authService } from '../services/authService';
import Button from '../components/Button';
import InputField from '../components/InputField';
import Alert from '../components/Alert';

export default function ActualizarPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [mensajeExito, setMensajeExito] = useState('');
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState(null);

  useEffect(() => {
    // Verificar si Supabase pudo canjear el token del hash de la URL
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) {
        setError('El enlace de recuperación es inválido o ha expirado. Por favor, solicita uno nuevo.');
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setSession(session);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleUpdate = async (e) => {
    e.preventDefault();
    setError('');
    
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setLoading(true);
    try {
      await authService.actualizarPassword(password);
      setMensajeExito('Tu contraseña ha sido actualizada correctamente.');
      
      // Desloguear por seguridad y enviar al login institucional
      setTimeout(async () => {
        await supabase.auth.signOut();
        navigate('/institucional', { replace: true });
      }, 3000);
      
    } catch (err) {
      setError(err.message || 'Ocurrió un error al actualizar la contraseña.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4 font-sans">
      <div className="bg-white p-8 sm:p-10 rounded-2xl shadow-2xl w-full max-w-md border-t-8 border-slate-700 text-center">
        <div className="flex flex-col items-center mb-6">
          <div className="bg-slate-800 p-4 rounded-full mb-4 shadow-lg ring-4 ring-slate-100">
            <KeyRound className="text-white w-8 h-8" />
          </div>
          <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">Establecer Nueva Contraseña</h2>
          <p className="text-slate-500 font-medium mt-1 text-sm">Crea una contraseña segura para tu cuenta</p>
        </div>

        {error && <Alert type="error" message={error} />}
        
        {mensajeExito ? (
          <div className="bg-green-50 p-6 rounded-lg border border-green-200">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <p className="text-green-800 font-bold mb-2">{mensajeExito}</p>
            <p className="text-sm text-green-700">Redirigiendo al inicio de sesión...</p>
          </div>
        ) : session ? (
          <form onSubmit={handleUpdate} className="space-y-4 text-left mt-6">
            <InputField
              label="Nueva Contraseña"
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 6 caracteres"
              required
            />
            
            <InputField
              label="Confirmar Contraseña"
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repite la contraseña"
              required
            />

            <Button type="submit" isLoading={loading} className="w-full mt-6">
              Actualizar Contraseña
            </Button>
          </form>
        ) : (
          <div className="mt-6">
             <Button type="button" onClick={() => navigate('/institucional')} className="w-full bg-slate-200 text-slate-800 hover:bg-slate-300">
               Volver al Inicio
             </Button>
          </div>
        )}
      </div>
    </div>
  );
}
