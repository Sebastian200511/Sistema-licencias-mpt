import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { ShieldCheck, ListFilter, ClipboardCheck, AlertTriangle, FileX, Calendar, RefreshCw, LogOut, ExternalLink } from 'lucide-react';

export default function Inspector() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [expedientes, setExpedientes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mensajeExito, setMensajeExito] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    
    try {
      const { data, error: authError } = await supabase
        .from('usuarios_internos')
        .select('*')
        .eq('email', loginData.email.trim())
        .eq('password', loginData.password)
        .single();

      if (authError || !data) {
        setError('Credenciales institucionales incorrectas.');
        return;
      }

      setIsAuthenticated(true);
      localStorage.setItem('inspector_session', 'true');
      cargarExpedientes();
    } catch (err) {
      setError('Error al conectar con el módulo de seguridad.');
    }
  };

  const cargarExpedientes = async () => {
    setLoading(true);
    try {
      const { data, error: fetchError } = await supabase
        .from('expedientes')
        .select(`
          *, 
          empresas(ruc, razon_social, domicilio_fiscal),
          inspecciones(fecha_programada, estado)
        `)
        .order('fecha_creacion', { ascending: false });

      if (fetchError) throw fetchError;
      setExpedientes(data);
    } catch (err) {
      console.error('Error al cargar trámites:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (localStorage.getItem('inspector_session') === 'true') {
      setIsAuthenticated(true);
      cargarExpedientes();
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('inspector_session');
    setIsAuthenticated(false);
  };

  const actualizarEstadoTramite = async (expedienteId, nuevoEstado) => {
    setError('');
    setMensajeExito('');

    // HU06: Exigir al inspector que anote la observación
    let textoObservacion = null;
    if (nuevoEstado === 'Observado') {
      textoObservacion = window.prompt("HU06: Por favor, detalle las observaciones encontradas en el local para registrarlas en el expediente:");
      
      // Si el inspector cancela el cuadro o lo deja vacío, detenemos el proceso
      if (!textoObservacion || textoObservacion.trim() === "") {
        return; 
      }
    }

    try {
      let fechaSegundaVisita = null;
      if (nuevoEstado === 'Observado') {
        const hoy = new Date();
        hoy.setDate(hoy.getDate() + 42); // 30 días hábiles
        fechaSegundaVisita = hoy.toISOString().split('T')[0];
      }

      const { error: updateError } = await supabase
        .from('expedientes')
        .update({ estado: nuevoEstado })
        .eq('id', expedienteId);

      if (updateError) throw updateError;

      const { error: inspError } = await supabase
        .from('inspecciones')
        .insert([{
          expediente_id: expedienteId,
          fecha_programada: new Date().toISOString().split('T')[0],
          estado: nuevoEstado === 'Aprobado' ? 'Conforme' : nuevoEstado,
          fecha_segunda_visita: fechaSegundaVisita,
          observaciones: textoObservacion // Guardamos lo que el inspector tipeó
        }]);

      if (inspError) throw inspError;

      setMensajeExito(`Expediente actualizado a [${nuevoEstado}] con éxito.`);
      cargarExpedientes();
    } catch (err) {
      setError('No se pudo procesar el cambio de estado técnico.');
      console.error(err);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
        <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-md border-t-4 border-blue-800">
          <div className="flex flex-col items-center mb-6">
            <div className="bg-blue-900 p-3 rounded-full mb-2 shadow-md">
              <ShieldCheck className="text-white w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-gray-800">Portal Interno MPT</h2>
            <p className="text-xs text-gray-500 mt-1">Cuerpo de Inspectores Municipales - Trujillo</p>
          </div>

          {error && <div className="bg-red-100 text-red-700 p-3 rounded mb-4 text-sm font-medium">{error}</div>}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Correo Institucional</label>
              <input 
                type="email" required
                value={loginData.email} onChange={(e) => setLoginData({...loginData, email: e.target.value})}
                className="mt-1 w-full p-2 border border-gray-300 rounded focus:ring-blue-800 focus:border-blue-800"
                placeholder="usuario@municipalidad.gob.pe"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Contraseña de Seguridad</label>
              <input 
                type="password" required
                value={loginData.password} onChange={(e) => setLoginData({...loginData, password: e.target.value})}
                className="mt-1 w-full p-2 border border-gray-300 rounded focus:ring-blue-800 focus:border-blue-800"
                placeholder="••••••••"
              />
            </div>
            <button type="submit" className="w-full bg-blue-900 hover:bg-blue-950 text-white font-bold py-2 px-4 rounded transition shadow">
              Autenticar Inspector
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 pb-12">
      <header className="bg-slate-900 text-white py-4 px-6 flex justify-between items-center shadow-md">
        <div>
          <h1 className="text-lg font-bold tracking-wide flex items-center gap-2">
            <ShieldCheck className="text-blue-400 w-5 h-5" /> MUNICIPALIDAD PROVINCIAL DE TRUJILLO
          </h1>
          <p className="text-xs text-slate-400">Bandeja Técnica de Evaluación de Licencias</p>
        </div>
        <button onClick={handleLogout} className="flex items-center gap-1 bg-slate-800 hover:bg-red-900 px-3 py-1.5 rounded text-xs font-semibold transition">
          <LogOut className="w-4 h-4" /> Salir del Portal
        </button>
      </header>

      <main className="max-w-6xl mx-auto mt-8 p-4">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <ListFilter className="text-blue-900" /> Trámites Asignados para Inspección Física
          </h2>
          <button onClick={cargarExpedientes} className="p-2 bg-white rounded-lg shadow hover:bg-gray-50 text-slate-600 transition">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {error && <div className="bg-red-100 text-red-700 p-3 rounded mb-4 text-sm font-semibold">{error}</div>}
        {mensajeExito && <div className="bg-green-100 text-green-800 p-3 rounded mb-4 text-sm font-semibold">{mensajeExito}</div>}

        {expedientes.length === 0 ? (
          <div className="bg-white p-8 rounded-xl shadow text-center text-gray-500 font-medium">
            No existen solicitudes de licencias pendientes en el sistema actualmente.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {expedientes.map((exp) => {
              const inspeccionAsignada = exp.inspecciones && exp.inspecciones[0];
              
              // Verificamos si es una URL real de internet o texto heredado de pruebas anteriores
              const tienePlanoUrlReal = exp.plano_url && exp.plano_url.startsWith('http');

              return (
                <div key={exp.id} className="bg-white rounded-xl shadow border-l-4 border-blue-900 p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-mono font-bold text-slate-900">{exp.codigo}</span>
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                        exp.estado === 'Pendiente' ? 'bg-yellow-100 text-yellow-800' :
                        exp.estado === 'Aprobado' ? 'bg-green-100 text-green-800' :
                        exp.estado === 'Observado' ? 'bg-orange-100 text-orange-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {exp.estado}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-slate-700">{exp.empresas?.razon_social}</h3>
                    <p className="text-xs text-slate-500">RUC: {exp.empresas?.ruc} | Dirección: {exp.empresas?.domicilio_fiscal}</p>
                    
                    {inspeccionAsignada && (
                      <div className="mt-2 inline-flex items-center gap-1.5 bg-blue-50 text-blue-800 px-2.5 py-1 rounded text-xs font-semibold border border-blue-200">
                        <Calendar className="w-3.5 h-3.5" /> 
                        Fecha Programada de Visita: {inspeccionAsignada.fecha_programada}
                      </div>
                    )}

                    {/* ENLACE REAL DE DESCARGA O APERTURA (Cero simulaciones) */}
                    <div className="pt-2">
                      {tienePlanoUrlReal ? (
                        <a 
                          href={exp.plano_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold py-2 px-3 rounded-lg border border-blue-200 transition"
                        >
                          <ExternalLink className="w-3.5 h-3.5" /> Abrir/Descargar Plano Original (PDF/Imagen)
                        </a>
                      ) : (
                        <span className="text-xs text-slate-400 italic bg-slate-50 p-1.5 border rounded">
                          Archivo: {exp.plano_url} (Registro antiguo sin Storage)
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex-shrink-0">
                    {exp.estado === 'Pendiente' ? (
                      <div className="flex flex-wrap gap-2 w-full md:w-auto">
                        <button 
                          onClick={() => actualizarEstadoTramite(exp.id, 'Aprobado')}
                          className="flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white font-bold py-1.5 px-3 rounded text-xs transition shadow"
                        >
                          <ClipboardCheck className="w-4 h-4" /> Dar Conformidad
                        </button>
                        <button 
                          onClick={() => actualizarEstadoTramite(exp.id, 'Observado')}
                          className="flex items-center gap-1 bg-orange-500 hover:bg-orange-600 text-white font-bold py-1.5 px-3 rounded text-xs transition shadow"
                        >
                          <AlertTriangle className="w-4 h-4" /> Observar Local
                        </button>
                      </div>
                    ) : exp.estado === 'Observado' ? (
                      <div className="flex flex-col gap-2 w-full md:w-auto border border-orange-200 bg-orange-50 p-2.5 rounded-lg shadow-sm">
                        <span className="text-xs font-bold text-orange-800 text-center uppercase tracking-wider">Acciones de 2da Visita (HU07)</span>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => actualizarEstadoTramite(exp.id, 'Aprobado')}
                            className="flex items-center justify-center gap-1 bg-green-600 hover:bg-green-700 text-white font-bold py-1.5 px-3 rounded text-xs transition shadow flex-1"
                          >
                            <ClipboardCheck className="w-4 h-4" /> Subsanado
                          </button>
                          <button 
                            onClick={() => actualizarEstadoTramite(exp.id, 'Denegado')}
                            className="flex items-center justify-center gap-1 bg-red-600 hover:bg-red-700 text-white font-bold py-1.5 px-3 rounded text-xs transition shadow flex-1"
                          >
                            <FileX className="w-4 h-4" /> Denegar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-400 italic font-medium border border-slate-200 py-1 px-3 rounded bg-slate-50">
                        Flujo Finalizado
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}