import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { ShieldCheck, LogOut, UserCircle, KeyRound } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { authService } from '../services/authService';
import Button from '../components/Button';
import InputField from '../components/InputField';
import Alert from '../components/Alert';

export default function IntranetLayout() {
  const { logout, userRole } = useAuth();
  
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passError, setPassError] = useState('');
  const [passSuccess, setPassSuccess] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setPassError('');
    setPassSuccess('');

    if (newPassword.length < 6) {
      setPassError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPassError('Las contraseñas no coinciden.');
      return;
    }

    setIsUpdating(true);
    try {
      await authService.actualizarPassword(newPassword);
      setPassSuccess('Contraseña actualizada correctamente.');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setShowPasswordModal(false), 2000);
    } catch (err) {
      setPassError(err.message || 'Error al actualizar contraseña.');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 pb-12 font-sans">
      <header className="bg-slate-900 text-white py-4 px-6 flex justify-between items-center shadow-md">
        <div>
          <h1 className="text-lg font-bold tracking-wide flex items-center gap-2">
            {userRole === 'Inspector' ? (
              <ShieldCheck className="text-blue-400 w-5 h-5" />
            ) : userRole === 'Admin' ? (
              <UserCircle className="text-purple-400 w-5 h-5" />
            ) : (
              <UserCircle className="text-teal-400 w-5 h-5" />
            )}
            MUNICIPALIDAD PROVINCIAL DE TRUJILLO
          </h1>
          <p className="text-xs text-slate-400">
            {userRole === 'Inspector' ? 'Bandeja Técnica de Evaluación de Licencias' : 
             userRole === 'Admin' ? 'Panel de Administración (TI)' : 
             'Terminal de Caja y Mesa de Partes'}
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="hidden sm:block text-xs font-semibold bg-slate-800 px-3 py-1 rounded border border-slate-700">
            Rol: <span className="text-white">{userRole}</span>
          </div>
          <button 
            onClick={() => { setShowPasswordModal(true); setPassError(''); setPassSuccess(''); setNewPassword(''); setConfirmPassword(''); }} 
            className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded text-xs font-semibold transition"
          >
            <KeyRound className="w-4 h-4" /> Cambiar Clave
          </button>
          <button 
            onClick={logout} 
            className="flex items-center gap-1 bg-slate-800 hover:bg-red-900 px-3 py-1.5 rounded text-xs font-semibold transition"
          >
            <LogOut className="w-4 h-4" /> Salir
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto mt-8 p-4">
        {/* Aquí se renderizarán los Dashboards (Inspector o Cajero) */}
        <Outlet />
      </main>

      {/* Modal de Cambio de Contraseña */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full font-sans">
            <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-teal-600" /> Cambiar Contraseña
            </h3>
            
            {passError && <Alert type="error" message={passError} />}
            {passSuccess && <Alert type="success" message={passSuccess} />}

            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <InputField
                label="Nueva Contraseña"
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
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
              
              <div className="flex gap-2 mt-6">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowPasswordModal(false)}>Cancelar</Button>
                <Button type="submit" className="flex-1" isLoading={isUpdating}>Guardar</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
