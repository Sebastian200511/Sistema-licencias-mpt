 
import { useState, useEffect } from 'react';
import { Users, UserPlus, ShieldAlert, CheckCircle, XCircle, LayoutDashboard, FileText, Search, Edit, Save, X, AlertTriangle } from 'lucide-react';

import { supabase } from '../supabaseClient';
import { authService } from '../services/authService';
import { reportesService } from '../services/reportesService';
import { expedientesService } from '../services/expedientesService';
import Button from '../components/Button';
import Alert from '../components/Alert';
import InputField from '../components/InputField';

export default function Admin() {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mensajeExito, setMensajeExito] = useState('');
  
  const [tabActual, setTabActual] = useState(() => localStorage.getItem('adminTab') || 'reportes');
  const [fechaInicio] = useState('');
  const [fechaFin] = useState('');
  const [reporteFinanciero, setReporteFinanciero] = useState(null);
  
  // Expedientes State
  const [expedientes, setExpedientes] = useState([]);
  const [filtroBusqueda, setFiltroBusqueda] = useState('');

  // Estados del Modo Demo
  const [modoDemo, setModoDemo] = useState(false);
  const [expedienteEditando, setExpedienteEditando] = useState(null);
  const [datosDemo, setDatosDemo] = useState({ estado: '', fecha_vencimiento: '', created_at: '', mensaje: '' });
  const [guardandoDemo, setGuardandoDemo] = useState(false);

  // Formulario nuevo usuario (Solo crea el perfil si el auth.user ya existe, 
  // en un entorno real se usaría una Edge Function con service_role para crear el auth.user)
  const [form, setForm] = useState({ id: '', email: '', password: '', rol: 'Cajero', nombre_completo: '' });

  const handleReenviarCorreo = async (exp) => {
    if (!exp.empresas?.email_contacto) {
      alert("La empresa no tiene un correo de contacto registrado.");
      return;
    }
    
    setLoading(true);
    setError('');
    setMensajeExito('');
    
    try {
      const { email_contacto: email, razon_social: razonSocial } = exp.empresas;
      const { codigo, estado } = exp;
      let tipoNotificacion = '';
      let observaciones = '';
      let fechaVisita = '';
      
      const insps = exp.inspecciones ? [...exp.inspecciones] : [];
      const ultimaInspeccion = insps.sort((a, b) => new Date(b.fecha_programada) - new Date(a.fecha_programada))[0];

      if (estado === 'Aprobado') tipoNotificacion = 'aprobado';
      else if (estado === 'Rechazado' || estado === 'Denegado Definitivo') tipoNotificacion = 'rechazado';
      else if (estado === 'Vencido') tipoNotificacion = 'vencimiento';
      else if (estado === 'Observado') {
        tipoNotificacion = 'observacion';
        if (ultimaInspeccion) {
          fechaVisita = ultimaInspeccion.fecha_programada;
          observaciones = ultimaInspeccion.observaciones || "Observaciones de seguridad registradas por el inspector.";
        }
      } else if (estado === 'En Inspeccion') {
        tipoNotificacion = 'nueva_inspeccion';
        if (ultimaInspeccion) {
          fechaVisita = ultimaInspeccion.fecha_programada;
        }
      } else {
        alert("El estado actual (" + estado + ") no tiene un correo automático configurado para reenvío.");
        setLoading(false);
        return;
      }

      await expedientesService.enviarCorreoNotificacion({
        email,
        codigo,
        razonSocial,
        fechaVisita,
        observaciones,
        tipoNotificacion
      });
      
      setMensajeExito(`Correo reenviado exitosamente a ${email}`);
    } catch (err) {
      setError("Error al reenviar correo: " + err.message);
    } finally {
      setLoading(false);
    }
  };

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
      const reporte = await reportesService.obtenerReporteFinanciero(fechaInicio, fechaFin);
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
     
    localStorage.setItem('adminTab', tabActual);
    if (tabActual === 'directorio') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      cargarUsuarios();
    } else if (tabActual === 'reportes') {
      cargarReportes();
    } else if (tabActual === 'expedientes') {
      cargarExpedientes();
      const channel = supabase
        .channel('admin-expedientes-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'expedientes' }, () => {
          cargarExpedientes();
        })
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [tabActual]);

  const toggleActivo = async (id, estadoActual, rol) => {
    setError('');
    setMensajeExito('');
    try {
      if (estadoActual) { // Intento de dar de baja
        if (rol === 'Cajero') {
          const { data: sesiones } = await supabase
            .from('caja_sesiones')
            .select('id')
            .eq('cajero_id', id)
            .is('hora_cierre', null);
          if (sesiones && sesiones.length > 0) throw new Error('No se puede dar de baja a un cajero con una caja abierta.');
        } else if (rol === 'Inspector') {
          const { data: tramites } = await supabase
            .from('expedientes')
            .select('id')
            .eq('inspector_id', id)
            .in('estado', ['Pendiente', 'Observado', 'En Inspeccion', 'Subsanacion']);
          if (tramites && tramites.length > 0) throw new Error('No se puede dar de baja a un inspector con trámites en curso.');
        }
      }

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
                <div className="mt-2">
                  <label className="block text-sm font-bold text-slate-700 mb-1">Rol en el Sistema</label>
                  <select 
                    className="w-full p-2 border border-slate-300 rounded focus:ring-slate-500 focus:border-slate-500"
                    value={form.rol}
                    onChange={e => setForm({...form, rol: e.target.value})}
                  >
                    <option value="Cajero">Cajero (Ventanilla Presencial)</option>
                    <option value="Inspector">Inspector (Trabajo de Campo)</option>
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
                          {u.rol !== 'Admin' && (
                            <button 
                              onClick={() => toggleActivo(u.id, u.activo, u.rol)}
                              className={`text-xs px-3 py-1 rounded font-bold transition-colors ${u.activo ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}
                            >
                              {u.activo ? 'Dar de Baja' : 'Reactivar'}
                            </button>
                          )}
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
                {/* Gráfico Visual Simple */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                  <p className="text-sm font-bold text-slate-700 mb-2">Distribución de Ingresos (Porcentajes)</p>
                  <div className="h-6 w-full bg-slate-100 rounded-full overflow-hidden flex">
                    <div style={{width: `${reporteFinanciero.totales.general ? (reporteFinanciero.totales.efectivo/reporteFinanciero.totales.general)*100 : 0}%`}} className="bg-green-500 flex items-center justify-center text-[10px] text-white font-bold" title="Efectivo">
                      {reporteFinanciero.totales.general && (reporteFinanciero.totales.efectivo/reporteFinanciero.totales.general)*100 >= 5 ? Math.round((reporteFinanciero.totales.efectivo/reporteFinanciero.totales.general)*100) + '%' : ''}
                    </div>
                    <div style={{width: `${reporteFinanciero.totales.general ? (reporteFinanciero.totales.yape/reporteFinanciero.totales.general)*100 : 0}%`}} className="bg-purple-500 flex items-center justify-center text-[10px] text-white font-bold" title="Yape/Plin">
                      {reporteFinanciero.totales.general && (reporteFinanciero.totales.yape/reporteFinanciero.totales.general)*100 >= 5 ? Math.round((reporteFinanciero.totales.yape/reporteFinanciero.totales.general)*100) + '%' : ''}
                    </div>
                    <div style={{width: `${reporteFinanciero.totales.general ? (reporteFinanciero.totales.tarjeta/reporteFinanciero.totales.general)*100 : 0}%`}} className="bg-yellow-500 flex items-center justify-center text-[10px] text-white font-bold" title="Pagos Virtuales">
                      {reporteFinanciero.totales.general && (reporteFinanciero.totales.tarjeta/reporteFinanciero.totales.general)*100 >= 5 ? Math.round((reporteFinanciero.totales.tarjeta/reporteFinanciero.totales.general)*100) + '%' : ''}
                    </div>
                  </div>
                  <div className="flex gap-4 mt-2 text-xs text-slate-500 font-medium">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"></span> Efectivo</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-500"></span> Yape/Plin</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500"></span> Virtual (MP)</span>
                  </div>
                </div>

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
              <div className="flex items-center gap-4 w-full sm:w-auto">
                <label className="flex items-center gap-1 cursor-pointer opacity-40 hover:opacity-100 transition ml-2" title="Activar herramientas de Demostración">
                  <input 
                    type="checkbox" 
                    checked={modoDemo} 
                    onChange={(e) => setModoDemo(e.target.checked)} 
                    className="w-3 h-3 text-slate-400 focus:ring-0 rounded-sm"
                  />
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Demo</span>
                </label>
                <button
                  onClick={async () => {
                    if (window.confirm("¿Ejecutar proceso de revisión de licencias caducadas? (Esto enviará correos)")) {
                      try {
                        const count = await expedientesService.verificarVencimientos();
                        alert(`Se encontraron y vencieron ${count} licencias caducadas.`);
                        cargarExpedientes();
                      } catch (err) {
                        alert(err.message);
                      }
                    }
                  }}
                  className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg text-sm font-bold transition flex items-center gap-2"
                >
                  <AlertTriangle className="w-4 h-4" /> Vencimientos
                </button>
                <div className="relative flex-1 sm:w-72">
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
                    <th className="p-3">Inspección</th>
                    <th className="p-3 text-right">Monto (S/)</th>
                    <th className="p-3 text-center">Acciones</th>
                    {modoDemo && <th className="p-3 text-center text-purple-700">Demo</th>}
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
                      <td className="p-3 text-slate-600 font-bold">
                        {(() => {
                          const insps = exp.inspecciones ? [...exp.inspecciones] : [];
                          const ultimaInspeccion = insps.sort((a, b) => new Date(b.fecha_programada) - new Date(a.fecha_programada))[0];
                          return ultimaInspeccion?.fecha_programada || 'N/A';
                        })()}
                      </td>
                      <td className="p-3 text-right font-bold text-slate-700">
                        {Number(exp.monto_pagado).toFixed(2)}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => handleReenviarCorreo(exp)}
                          className="bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-200 transition font-bold text-xs flex items-center justify-center gap-1.5 mx-auto"
                          title="Reenviar Correo al Ciudadano"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21.2 8.4c.5.38.8.97.8 1.6v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V10a2 2 0 0 1 .8-1.6l8-6a2 2 0 0 1 2.4 0l8 6Z"/><path d="m22 10-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 10"/></svg>
                          Reenviar
                        </button>
                      </td>
                      {modoDemo && (
                        <td className="p-3 text-center">
                          <button 
                            onClick={() => {
                              setExpedienteEditando(exp);
                              setDatosDemo({
                                estado: exp.estado,
                                created_at: new Date(exp.created_at).toISOString().split('T')[0],
                                fecha_vencimiento: exp.fecha_vencimiento ? new Date(exp.fecha_vencimiento).toISOString().split('T')[0] : '',
                                fecha_programada: (() => {
                                  const insps = exp.inspecciones ? [...exp.inspecciones] : [];
                                  const ultimaInspeccion = insps.sort((a, b) => new Date(b.fecha_programada) - new Date(a.fecha_programada))[0];
                                  return ultimaInspeccion?.fecha_programada || '';
                                })(),
                                inspeccion_id: (() => {
                                  const insps = exp.inspecciones ? [...exp.inspecciones] : [];
                                  const ultimaInspeccion = insps.sort((a, b) => new Date(b.fecha_programada) - new Date(a.fecha_programada))[0];
                                  return ultimaInspeccion?.id || null;
                                })()
                              });
                            }}
                            className="bg-purple-100 text-purple-700 p-2 rounded hover:bg-purple-200 transition"
                            title="Editar en Modo Demo"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                  {expedientes.length === 0 && (
                    <tr>
                      <td colSpan={modoDemo ? "9" : "8"} className="p-8 text-center text-slate-500 italic">No se encontraron expedientes registrados.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>

      {/* Modal Modo Demo */}
      {expedienteEditando && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="bg-purple-600 p-4 text-white flex justify-between items-center">
              <h3 className="font-bold flex items-center gap-2"><Edit className="w-5 h-5"/> Modo Demo: Editar Expediente</h3>
              <button onClick={() => setExpedienteEditando(null)} className="text-white/80 hover:text-white"><X className="w-5 h-5"/></button>
            </div>
            
            <div className="p-6 flex-1 overflow-y-auto space-y-4">
              <div className="bg-purple-50 p-3 rounded text-sm text-purple-800 border border-purple-200">
                Estás editando directamente el expediente <strong>{expedienteEditando.codigo}</strong> de <strong>{expedienteEditando.empresas?.razon_social}</strong>. Estos cambios sobreescribirán la base de datos sin ejecutar lógicas de negocio (ideal para demos).
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Estado</label>
                <select 
                  value={datosDemo.estado} 
                  onChange={(e) => {
                    const nuevoEstado = e.target.value;
                    let nuevaFechaVenc = datosDemo.fecha_vencimiento;
                    let nuevoIngreso = datosDemo.created_at;
                    
                    if (nuevoEstado === 'Aprobado') {
                       const baseDate = nuevoIngreso ? new Date(`${nuevoIngreso}T12:00:00Z`) : new Date();
                       baseDate.setFullYear(baseDate.getFullYear() + 1);
                       baseDate.setDate(baseDate.getDate() + 15);
                       nuevaFechaVenc = baseDate.toISOString().split('T')[0];
                    } else if (nuevoEstado === 'Vencido') {
                       const ayer = new Date();
                       ayer.setDate(ayer.getDate() - 1);
                       nuevaFechaVenc = ayer.toISOString().split('T')[0];
                       
                       const haceUnAno = new Date(ayer);
                       haceUnAno.setFullYear(haceUnAno.getFullYear() - 1);
                       haceUnAno.setDate(haceUnAno.getDate() - 15);
                       nuevoIngreso = haceUnAno.toISOString().split('T')[0];
                    }
                    setDatosDemo({...datosDemo, estado: nuevoEstado, fecha_vencimiento: nuevaFechaVenc, created_at: nuevoIngreso});
                  }}
                  className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-purple-500 outline-none"
                >
                  <option value="Pendiente">Pendiente</option>
                  <option value="Observado">Observado</option>
                  <option value="En Inspeccion">En Inspeccion</option>
                  <option value="Subsanacion">Subsanacion</option>
                  <option value="Aprobado">Aprobado</option>
                  <option value="Rechazado">Rechazado</option>
                  <option value="Vencido">Vencido</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Fecha de Ingreso (Creación)</label>
                <input 
                  type="date" 
                  value={datosDemo.created_at} 
                  onChange={(e) => {
                    const fIngreso = e.target.value;
                    let nuevaFechaVenc = datosDemo.fecha_vencimiento;
                    if (datosDemo.estado === 'Vencido' || datosDemo.estado === 'Aprobado') {
                       const d = new Date(`${fIngreso}T12:00:00Z`);
                       d.setFullYear(d.getFullYear() + 1);
                       d.setDate(d.getDate() + 15);
                       nuevaFechaVenc = d.toISOString().split('T')[0];
                    }
                    setDatosDemo({...datosDemo, created_at: fIngreso, fecha_vencimiento: nuevaFechaVenc});
                  }}
                  className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-purple-500 outline-none"
                />
              </div>

              {(datosDemo.estado === 'Aprobado' || datosDemo.estado === 'Vencido') && (
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Fecha de Vencimiento (Solo Aprobados)</label>
                  <input 
                    type="date" 
                    value={datosDemo.fecha_vencimiento} 
                    onChange={(e) => {
                      const fVenc = e.target.value;
                      const d = new Date(`${fVenc}T12:00:00Z`);
                      d.setFullYear(d.getFullYear() - 1);
                      const approvalDateStr = d.toISOString().split('T')[0];
                      
                      let nuevoIngreso = datosDemo.created_at;
                      if (nuevoIngreso >= approvalDateStr) {
                         d.setDate(d.getDate() - 15);
                         nuevoIngreso = d.toISOString().split('T')[0];
                      }
                      setDatosDemo({...datosDemo, fecha_vencimiento: fVenc, created_at: nuevoIngreso});
                    }}
                    className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-purple-500 outline-none"
                  />
                </div>
              )}

              {datosDemo.inspeccion_id && (
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Fecha Programada de Inspección</label>
                  <input 
                    type="date" 
                    value={datosDemo.fecha_programada} 
                    onChange={(e) => setDatosDemo({...datosDemo, fecha_programada: e.target.value})}
                    className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-purple-500 outline-none"
                  />
                </div>
              )}
              {datosDemo.estado === 'Observado' && (
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Mensaje de Observación (Para el correo)</label>
                  <textarea 
                    value={datosDemo.mensaje} 
                    onChange={(e) => setDatosDemo({...datosDemo, mensaje: e.target.value})}
                    className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-purple-500 outline-none resize-none"
                    rows="3"
                    placeholder="Escribe el motivo de la observación que le llegará al usuario..."
                  />
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t flex justify-end gap-3">
              <button 
                onClick={() => setExpedienteEditando(null)} 
                className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-200 rounded"
                disabled={guardandoDemo}
              >
                Cancelar
              </button>
              <button 
                onClick={async () => {
                  setGuardandoDemo(true);
                  try {
                    const camposUpdate = {
                      estado: datosDemo.estado,
                      created_at: datosDemo.created_at ? new Date(`${datosDemo.created_at}T12:00:00Z`).toISOString() : expedienteEditando.created_at,
                      fecha_vencimiento: datosDemo.fecha_vencimiento ? new Date(`${datosDemo.fecha_vencimiento}T12:00:00Z`).toISOString() : null,
                    };
                    await reportesService.actualizarExpedienteDemo(expedienteEditando.id, camposUpdate);
                    
                    if (datosDemo.inspeccion_id && datosDemo.fecha_programada) {
                      await expedientesService.actualizarFechaInspeccion(datosDemo.inspeccion_id, datosDemo.fecha_programada);
                    }
                    
                    if (datosDemo.estado === 'Aprobado' || datosDemo.estado === 'Observado') {
                      const expData = expedientes.find(e => e.id === expedienteEditando.id);
                      if (expData?.empresas?.email_contacto) {
                        try {
                          await expedientesService.enviarCorreoNotificacion({
                            email: expData.empresas.email_contacto,
                            codigo: expData.codigo,
                            razonSocial: expData.empresas.razon_social,
                            fechaVisita: camposUpdate.fecha_vencimiento || new Date().toISOString(),
                            observaciones: datosDemo.estado === 'Observado' && datosDemo.mensaje ? datosDemo.mensaje : 'Actualización administrativa (Demostración)',
                            tipoNotificacion: datosDemo.estado === 'Aprobado' ? 'aprobacion' : 'observacion'
                          });
                        } catch (err) {
                          console.error("Error enviando correo en demo:", err);
                        }
                      }
                    }

                    await cargarExpedientes();
                    setExpedienteEditando(null);
                  } catch (error) {
                    alert('Error guardando en modo demo: ' + error.message);
                  } finally {
                    setGuardandoDemo(false);
                  }
                }} 
                disabled={guardandoDemo}
                className="px-4 py-2 bg-purple-600 text-white font-bold rounded hover:bg-purple-700 flex items-center gap-2"
              >
                {guardandoDemo ? 'Guardando...' : <><Save className="w-4 h-4"/> Forzar Cambios</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
