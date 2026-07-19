import { Outlet } from 'react-router-dom';
import { ShieldCheck, LogOut, UserCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function IntranetLayout() {
  const { logout, userRole } = useAuth();

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
    </div>
  );
}
