import { Outlet } from 'react-router-dom';

export default function PublicLayout() {
  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <main>
        {/* Aquí se renderizarán las páginas públicas (Login, Solicitud, Seguimiento) */}
        <Outlet />
      </main>
    </div>
  );
}
