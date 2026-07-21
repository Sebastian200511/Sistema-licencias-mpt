import { useState, useEffect } from 'react';
import { Users, UserPlus, ShieldAlert, CheckCircle, XCircle, Trash2, LayoutDashboard, DollarSign, Wallet, TrendingUp, FileText, Search } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { authService } from '../services/authService';
import { reportesService } from '../services/reportesService';
import Button from '../components/Button';
import Alert from '../components/Alert';
import InputField from '../components/InputField';

export default function Admin() {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mensajeExito, setMensajeExito] = useState('');
  
  const [tabActual, setTabActual] = useState('directorio'); // 'directorio' | 'reportes' | 'expedientes'
  const [reporteFinanciero, setReporteFinanciero] = useState(null);
  
  // Expedientes State
  const [expedientes, setExpedientes] = useState([]);
  const [filtroBusqueda, setFiltroBusqueda] = useState('');

  // Formulario nuevo usuario (Solo crea el perfil si el auth.user ya existe, 
  // en un entorno real se usaría una Edge Function con service_role para crear el auth.user)
  const [form, setForm] = useState({ id: '', email: '', password: '', rol: 'Cajero', nombre_completo: '' });

  const cargarUsuarios = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('usuarios_internos')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsuarios(data);
    } catch (err) {
      setError('Error al cargar usuarios: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const cargarReportes = async () => {
    setLoading(true);
    try {
      const reporte = await reportesService.obtenerReporteFinanciero();
      setReporteFinanciero(reporte);
    } catch (err) {
      setError('Error al cargar reporte: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const cargarExpedientes = async () => {
    setLoading(true);
    try {
      const data = await reportesService.obtenerTodosExpedientes();
      setExpedientes(data || []);
    } catch (err) {
      setError('Error al cargar expedientes: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tabActual === 'directorio') {
      cargarUsuarios();
    } else if (tabActual === 'reportes') {
      cargarReportes();
    } else if (tabActual === 'expedientes') {
      cargarExpedientes();
    }
  }, [tabActual]);

  const toggleActivo = async (id, estadoActual) => {
    setError('');
    setMensajeExito('');
    try {
      const { error } = await supabase
        .from('usuarios_internos')
        .update({ activo: !estadoActual })
        .eq('id', id);

      if (error) throw error;
      setMensajeExito(`Usuario ${!estadoActual ? 'activado' : 'desactivado'} correctamente.`);
      cargarUsuarios();
    } catch (err) {
      setError('Error al cambiar estado: ' + err.message);
    }
  };

  const handleCrearUsuario = async (e) => {
    e.preventDefault();
    setError('');
    setMensajeExito('');
    setLoading(true);
    try {
      // Llamamos a nuestro servicio que internamente invoca la Edge Function
      await authService.crearPersonal(form);

      setMensajeExito('Usuario creado exitosamente. La sesión actual del administrador se mantiene intacta.');
      setForm({ id: '', email: '', password: '', rol: 'Cajero', nombre_completo: '' });
      cargarUsuarios();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-100 p-6 min-h-screen">
      <div className="max-w-6xl mx-auto space-y-6">
        
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-slate-800 p-3 rounded-xl">
              <ShieldAlert className="text-white w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800">Panel de Administración</h1>
          </div>
          
          <div className="flex bg-white rounded-lg shadow-sm border border-slate-200 p-1">
            <button 
              onClick={() => setTabActual('directorio')}
              className={`px-4 py-2 rounded-md font-bold text-sm transition-colors ${tabActual === 'directorio' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              Directorio de Personal
            </button>
            <button
              onClick={() => setTabActual('reportes')}
              className={`flex items-center gap-2 px-4 py-2 font-bold rounded-lg transition-colors ${tabActual === 'reportes' ? 'bg-slate-800 text-white shadow-md' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'}`}
            >
              <LayoutDashboard className="w-4 h-4" /> Reporte Financiero
            </button>
            <button
              onClick={() => setTabActual('expedientes')}
              className={`flex items-center gap-2 px-4 py-2 font-bold rounded-lg transition-colors ${tabActual === 'expedientes' ? 'bg-slate-800 text-white shadow-md' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'}`}
            >
              <FileText className="w-4 h-4" /> Gestión de Expedientes
            </button>
          </div>
        </div>

        {error && <Alert type="error" message={error} />}
        {mensajeExito && <Alert type="success" message={mensajeExito} />}

        {tabActual === 'directorio' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
            {/* Formulario de Creación */}
            <div className="bg-white p-6 rounded-xl shadow-md border-t-4 border-slate-700 h-fit">
              <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <UserPlus className="w-5 h-5" /> Nuevo Usuario Interno
              </h2>
              <form onSubmit={handleCrearUsuario} className="space-y-4">
                <InputField 
                  label="Nombre Completo" 
                  id="nombre_completo" 
                  value={form.nombre_completo} 
                  onChange={e => setForm({...form, nombre_completo: e.target.value})} 
                  required 
                />
                <InputField 
                  label="Correo Electrónico" 
                  type="email" 
                  id="email" 
                  value={form.email} 
                  onChange={e => setForm({...form, email: e.target.value})} 
                  required 
                />
                <InputField 
                  label="Contraseña Inicial" 
                  type="password" 
                  id="password" 
                  value={form.password} 
                  onChange={e => setForm({...form, password: e.target.value})} 
                  required 
                />
                <p className="text-xs text-slate-500 mt-1 mb-3">El usuario podrá cambiar esta contraseña al iniciar sesión en su cuenta.</p>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Rol en el Sistema</label>
                  <select 
                    className="w-full p-2 border border-slate-300 rounded focus:ring-slate-500 focus:border-slate-500"
                    value={form.rol}
                    onChange={e => setForm({...form, rol: e.target.value})}
                  >
                    <option value="Cajero">Cajero (Ventanilla Presencial)</option>
                    <option value="Inspector">Inspector (Trabajo de Campo)</option>
                    <option value="Admin">Administrador (TI)</option>
                  </select>
                </div>
                <Button type="submit" isLoading={loading} className="w-full mt-4">Registrar Usuario</Button>
              </form>
            </div>

            {/* Lista de Usuarios */}
            <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-md">
              <h2 className="text-lg font-bold text-slate-800 mb-4">Directorio de Personal</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="p-3 text-sm font-bold text-slate-600">Nombre</th>
                      <th className="p-3 text-sm font-bold text-slate-600">Correo Electrónico</th>
                      <th className="p-3 text-sm font-bold text-slate-600">Rol</th>
                      <th className="p-3 text-sm font-bold text-slate-600">Estado</th>
                      <th className="p-3 text-sm font-bold text-slate-600 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usuarios.map(u => (
                      <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                        <td className="p-3 text-sm font-medium text-slate-800">{u.nombre_completo}</td>
                        <td className="p-3 text-sm text-slate-500">{u.email || '-'}</td>
                        <td className="p-3 text-sm text-slate-600">
                          <span className={`px-2 py-1 rounded text-xs font-bold ${u.rol === 'Admin' ? 'bg-purple-100 text-purple-700' : u.rol === 'Inspector' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                            {u.rol}
                          </span>
                        </td>
                        <td className="p-3 text-sm">
                          {u.activo ? 
                            <span className="flex items-center gap-1 text-green-600 font-medium text-xs"><CheckCircle className="w-3 h-3"/> Activo</span> : 
                            <span className="flex items-center gap-1 text-red-500 font-medium text-xs"><XCircle className="w-3 h-3"/> Inactivo</span>
                          }
                        </td>
                        <td className="p-3 text-center">
                          <button 
                            onClick={() => toggleActivo(u.id, u.activo)}
                            className={`text-xs px-3 py-1 rounded font-bold transition-colors ${u.activo ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}
                          >
                            {u.activo ? 'Dar de Baja' : 'Reactivar'}
                          </button>
                        </td>
                      </tr>
                    ))}
                    {usuarios.length === 0 && (
                      <tr>
                        <td colSpan="5" className="p-4 text-center text-slate-500">No hay usuarios registrados.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : tabActual === 'reportes' ? (
          <div className="space-y-6 animate-fade-in">
            {reporteFinanciero ? (
              <>
                {/* KPIs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                  <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <p className="text-sm font-bold text-slate-500 uppercase">Recaudación Total</p>
                    <p className="text-3xl font-black text-slate-800 mt-2">S/ {reporteFinanciero.totales.general.toFixed(2)}</p>
                  </div>
                  <div className="bg-green-50 p-6 rounded-xl shadow-sm border border-green-200">
                    <p className="text-sm font-bold text-green-700 uppercase">Total Efectivo</p>
                    <p className="text-2xl font-bold text-green-900 mt-2">S/ {reporteFinanciero.totales.efectivo.toFixed(2)}</p>
                  </div>
                  <div className="bg-purple-50 p-6 rounded-xl shadow-sm border border-purple-200">
                    <p className="text-sm font-bold text-purple-700 uppercase">Total Yape/Plin</p>
                    <p className="text-2xl font-bold text-purple-900 mt-2">S/ {reporteFinanciero.totales.yape.toFixed(2)}</p>
                  </div>
                  <div className="bg-yellow-50 p-6 rounded-xl shadow-sm border border-yellow-200">
                    <p className="text-sm font-bold text-yellow-700 uppercase">Total Virtual (MP)</p>
                    <p className="text-2xl font-bold text-yellow-900 mt-2">S/ {reporteFinanciero.totales.tarjeta?.toFixed(2) || '0.00'}</p>
                  </div>
                  <div className="bg-blue-50 p-6 rounded-xl shadow-sm border border-blue-200">
                    <p className="text-sm font-bold text-blue-700 uppercase">Trámites Atendidos</p>
                    <p className="text-2xl font-bold text-blue-900 mt-2">{reporteFinanciero.totales.tramites}</p>
                  </div>
                </div>

                {/* Tabla por Cajero */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                  <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <Users className="w-5 h-5 text-slate-500" /> Desempeño y Recaudación por Cajero
                  </h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-sm font-bold uppercase">
                          <th className="p-4">Cajero / Pasarela</th>
                          <th className="p-4 text-center">Trámites Cobrados</th>
                          <th className="p-4 text-right">Efectivo Recaudado</th>
                          <th className="p-4 text-right">Yape Recaudado</th>
                          <th className="p-4 text-right text-yellow-700">Virtual (MP)</th>
                          <th className="p-4 text-right text-slate-800">Total General</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reporteFinanciero.desgloseCajeros.map((c, index) => (
                          <tr key={index} className="border-b border-slate-100 hover:bg-slate-50 transition-colors text-sm">
                            <td className="p-4 font-medium text-slate-800">{c.nombre}</td>
                            <td className="p-4 text-center font-bold text-slate-600">{c.cantidad}</td>
                            <td className="p-4 text-right text-green-700">S/ {c.efectivo.toFixed(2)}</td>
                            <td className="p-4 text-right text-purple-700">S/ {c.yape.toFixed(2)}</td>
                            <td className="p-4 text-right text-yellow-700">S/ {(c.tarjeta || 0).toFixed(2)}</td>
                            <td className="p-4 text-right font-bold text-slate-800">S/ {c.total.toFixed(2)}</td>
                          </tr>
                        ))}
                        {reporteFinanciero.desgloseCajeros.length === 0 && (
                          <tr>
                            <td colSpan="6" className="p-4 text-center text-slate-500">No hay datos de recaudación registrados.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-10 text-slate-500">Cargando reporte...</div>
            )}
          </div>
        ) : tabActual === 'expedientes' ? (
          <div className="bg-white p-6 rounded-xl shadow-md animate-fade-in border border-slate-200">
            <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <FileText className="w-6 h-6 text-teal-600" />
                Bandeja Central de Expedientes
              </h2>
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input 
                  type="text"
                  placeholder="Buscar por código o empresa..."
                  className="w-full pl-9 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none text-sm"
                  value={filtroBusqueda}
                  onChange={(e) => setFiltroBusqueda(e.target.value)}
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-y border-slate-200 text-slate-600 text-xs font-bold uppercase">
                    <th className="p-3">Código</th>
                    <th className="p-3">Empresa</th>
                    <th className="p-3">Fecha de Ingreso</th>
                    <th className="p-3">Vencimiento</th>
                    <th className="p-3 text-center">Estado</th>
                    <th className="p-3 text-right">Monto (S/)</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {expedientes
                    .filter(e => 
                      (e.codigo || '').toLowerCase().includes(filtroBusqueda.toLowerCase()) || 
                      (e.empresas?.razon_social || '').toLowerCase().includes(filtroBusqueda.toLowerCase()) ||
                      (e.empresas?.ruc || '').includes(filtroBusqueda)
                    )
                    .map(exp => (
                    <tr key={exp.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="p-3 font-mono font-bold text-teal-700">{exp.codigo}</td>
                      <td className="p-3">
                        <p className="font-bold text-slate-800">{exp.empresas?.razon_social || 'Desconocido'}</p>
                        <p className="text-xs text-slate-500">RUC: {exp.empresas?.ruc}</p>
                      </td>
                      <td className="p-3 text-slate-600">{new Date(exp.created_at).toLocaleDateString()}</td>
                      <td className="p-3 text-slate-600">{exp.fecha_vencimiento ? new Date(exp.fecha_vencimiento).toLocaleDateString() : '-'}</td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-1 rounded text-xs font-bold 
                          ${exp.estado === 'Aprobado' ? 'bg-green-100 text-green-700' : 
                            exp.estado === 'Vencido' ? 'bg-red-100 text-red-700' :
                            exp.estado === 'Rechazado' ? 'bg-slate-200 text-slate-700' :
                            'bg-yellow-100 text-yellow-700'}`}>
                          {exp.estado}
                        </span>
                      </td>
                      <td className="p-3 text-right font-bold text-slate-700">
                        {Number(exp.monto_pagado).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                  {expedientes.length === 0 && (
                    <tr>
                      <td colSpan="6" className="p-8 text-center text-slate-500 italic">No se encontraron expedientes registrados.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
