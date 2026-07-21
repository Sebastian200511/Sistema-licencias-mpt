import { useState, useEffect } from 'react';
import { ListFilter, ClipboardCheck, AlertTriangle, FileX, Calendar, RefreshCw, ExternalLink } from 'lucide-react';
import { expedientesService } from '../services/expedientesService';
import { supabase } from '../supabaseClient';
import Alert from '../components/Alert';
import Button from '../components/Button';

export default function Inspector() {
  const [expedientes, setExpedientes] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [tabActual, setTabActual] = useState('pendientes');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mensajeExito, setMensajeExito] = useState('');


  const cargarExpedientes = async () => {
    setLoading(true);
    try {
      if (tabActual === 'pendientes') {
        const pendientes = await expedientesService.obtenerInspeccionesPendientes();
        setExpedientes(pendientes);
      } else {
        const h = await expedientesService.obtenerHistorialInspecciones();
        setHistorial(h);
      }
    } catch (err) {
      setError(err.message || 'Error al cargar trámites.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarExpedientes();

    // Configuración de Supabase Realtime para la "Reactividad en Vivo"
    const channel = supabase
      .channel('expedientes-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'expedientes' },
        (payload) => {
          cargarExpedientes(); // Actualiza automáticamente la bandeja sin F5
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tabActual]);

  const actualizarEstadoTramite = async (expedienteId, nuevoEstado) => {
    setError('');
    setMensajeExito('');

    let textoObservacion = null;
    
    // Validar captura de observaciones 
    if (nuevoEstado === 'Observado') {
      textoObservacion = window.prompt("Detalle las observaciones encontradas en el local para registrarlas en el expediente:");
      
      // Abortar si no se proporciona justificación
      if (!textoObservacion || textoObservacion.trim() === "") {
        return; 
      }
    }

    try {
      await expedientesService.actualizarEstadoExpediente(expedienteId, nuevoEstado);

      if (nuevoEstado === 'Observado') {
        const fechaFutura = new Date();
        fechaFutura.setDate(fechaFutura.getDate() + 42);
        const fechaSegundaVisita = fechaFutura.toISOString().split('T')[0];
        
        await expedientesService.crearInspeccion({
          expediente_id: expedienteId, 
          fecha_programada: fechaSegundaVisita, 
          estado: 'Programada',
          observaciones: 'Reprogramación por primera visita observada'
        });

        const expData = expedientes.find(e => e.id === expedienteId);
        if (expData?.empresas?.email_contacto) {
          expedientesService.enviarCorreoNotificacion({
            email: expData.empresas.email_contacto,
            codigo: expData.codigo,
            razonSocial: expData.empresas.razon_social,
            fechaVisita: fechaSegundaVisita,
            observaciones: textoObservacion,
            tipoNotificacion: 'observacion'
          }).catch(err => console.error("Error enviando correo observacion:", err));
        }

        setMensajeExito(`Expediente observado. Se programó 2da visita y se notificó al negocio (Fecha: ${fechaSegundaVisita}).`);
      } else {
        setMensajeExito('Se emitió la Resolución de Aprobación.');
      }
      cargarExpedientes();
    } catch (err) {
      setError('No se pudo procesar el cambio de estado técnico.');
      console.error(err);
    }
  };

  const reprogramarVisita = async (inspeccionId, nuevaFecha) => {
    if (!nuevaFecha) return;
    setLoading(true);
    try {
      await expedientesService.actualizarFechaInspeccion(inspeccionId, nuevaFecha);
      setMensajeExito('Fecha de inspección reprogramada correctamente.');
      cargarExpedientes();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const hoyStr = new Date().toISOString().split('T')[0];
  const manana = new Date();
  manana.setDate(manana.getDate() + 1);
  const mananaStr = manana.toISOString().split('T')[0];

  const agrupados = { atrasadas: [], hoy: [], manana: [], futuras: [] };
  
  if (tabActual === 'pendientes') {
    expedientes.forEach(exp => {
      const f = exp.inspecciones?.[0]?.fecha_programada;
      if (!f) return;
      if (f < hoyStr) agrupados.atrasadas.push(exp);
      else if (f === hoyStr) agrupados.hoy.push(exp);
      else if (f === mananaStr) agrupados.manana.push(exp);
      else agrupados.futuras.push(exp);
    });
  }

  const renderGrupo = (titulo, lista, colorClase) => {
    if (lista.length === 0) return null;
    return (
      <div className="mb-8">
        <h3 className={`text-lg font-bold border-b pb-2 mb-4 ${colorClase}`}>{titulo} ({lista.length})</h3>
        <div className="grid grid-cols-1 gap-4">
          {lista.map((exp) => {
            const inspeccionAsignada = exp.inspecciones && exp.inspecciones[0];
            const tienePlanoUrlReal = exp.plano_url && exp.plano_url.startsWith('http');

            return (
              <div key={exp.id} className="bg-white rounded-xl shadow border-l-4 border-slate-400 p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:shadow-md transition">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-mono font-bold text-slate-900">{exp.codigo}</span>
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold bg-blue-100 text-blue-800`}>
                      {exp.estado}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-700">{exp.empresas?.razon_social}</h3>
                  <p className="text-xs text-slate-500">RUC: {exp.empresas?.ruc} | Dirección: {exp.empresas?.domicilio_fiscal}</p>
                  
                  {inspeccionAsignada && (
                    <div className="mt-2 flex items-center gap-2">
                      <div className="inline-flex items-center gap-1.5 bg-slate-50 text-slate-700 px-2.5 py-1 rounded text-xs font-semibold border border-slate-200">
                        <Calendar className="w-3.5 h-3.5" /> 
                        Visita: 
                        <input 
                          type="date" 
                          defaultValue={inspeccionAsignada.fecha_programada}
                          onBlur={(e) => {
                            if (e.target.value !== inspeccionAsignada.fecha_programada) {
                              reprogramarVisita(inspeccionAsignada.id, e.target.value);
                            }
                          }}
                          className="bg-transparent outline-none border-b border-slate-300 ml-1 focus:border-blue-500 cursor-pointer"
                        />
                      </div>
                      <span className="text-[10px] text-slate-400 italic">Cambiar fecha actualizará el sistema</span>
                    </div>
                  )}

                  <div className="pt-2">
                    {tienePlanoUrlReal ? (
                      <a 
                        href={exp.plano_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold py-2 px-3 rounded-lg border border-blue-200 transition"
                      >
                        <ExternalLink className="w-3.5 h-3.5" /> Abrir Documento Adjunto
                      </a>
                    ) : (
                      <span className="text-xs text-slate-400 italic bg-slate-50 p-1.5 border rounded">
                        Archivo: {exp.plano_url} (Registro heredado)
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex-shrink-0">
                  <div className="flex flex-wrap gap-2 w-full md:w-auto">
                    <Button 
                      onClick={() => actualizarEstadoTramite(exp.id, 'Aprobado')}
                      variant="success"
                      className="w-auto px-4 py-2 text-xs h-8 whitespace-nowrap"
                    >
                      Dar Conformidad
                    </Button>
                    <Button 
                      onClick={() => actualizarEstadoTramite(exp.id, 'Observado')}
                      variant="danger"
                      className="w-auto px-4 py-2 text-xs h-8 whitespace-nowrap"
                    >
                      Observar Local
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-slate-100 min-h-screen p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <ListFilter className="text-blue-900 w-6 h-6" /> Bandeja de Inspecciones
          </h2>
          <Button onClick={cargarExpedientes} isLoading={loading} variant="secondary" className="w-auto px-4 py-2 text-sm bg-white shadow-sm border border-slate-200 text-slate-700 hover:bg-slate-50">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Actualizar Lista
          </Button>
        </div>

        <div className="flex space-x-1 bg-slate-200 p-1 rounded-lg mb-6 max-w-sm">
          <button
            onClick={() => setTabActual('pendientes')}
            className={`flex-1 py-2 text-sm font-bold rounded-md transition ${tabActual === 'pendientes' ? 'bg-white shadow text-blue-800' : 'text-slate-600 hover:bg-slate-300'}`}
          >
            Pendientes
          </button>
          <button
            onClick={() => setTabActual('historial')}
            className={`flex-1 py-2 text-sm font-bold rounded-md transition ${tabActual === 'historial' ? 'bg-white shadow text-blue-800' : 'text-slate-600 hover:bg-slate-300'}`}
          >
            Historial
          </button>
        </div>

        {error && <Alert type="error" message={error} />}
        {mensajeExito && <Alert type="success" message={mensajeExito} />}

        {tabActual === 'pendientes' ? (
          expedientes.length === 0 ? (
            <div className="bg-white p-12 rounded-xl shadow border border-slate-200 text-center text-slate-500 font-medium flex flex-col items-center justify-center">
              <ClipboardCheck className="w-16 h-16 text-slate-300 mb-4" />
              <p className="text-lg">No hay inspecciones pendientes programadas en este momento.</p>
              <p className="text-sm font-normal mt-1 text-slate-400">Buen trabajo, la bandeja está limpia.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {renderGrupo("⚠️ Atrasadas", agrupados.atrasadas, "text-red-700 border-red-200")}
              {renderGrupo("📅 Para Hoy", agrupados.hoy, "text-blue-800 border-blue-200")}
              {renderGrupo("⏳ Para Mañana", agrupados.manana, "text-teal-700 border-teal-200")}
              {renderGrupo("📆 Futuras", agrupados.futuras, "text-slate-600 border-slate-200")}
            </div>
          )
        ) : (
          <div className="space-y-4">
            {historial.length === 0 ? (
              <div className="bg-white p-12 rounded-xl shadow border border-slate-200 text-center text-slate-500 font-medium">
                <p className="text-lg">No hay trámites en el historial.</p>
              </div>
            ) : (
              historial.map((exp) => {
                const tienePlanoUrlReal = exp.plano_url && exp.plano_url.startsWith('http');
                return (
                  <div key={exp.id} className="bg-white rounded-xl shadow border-l-4 border-slate-300 p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-base font-mono font-bold text-slate-900">{exp.codigo}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${exp.estado === 'Aprobado' ? 'bg-green-100 text-green-800' : exp.estado === 'Rechazado' ? 'bg-red-100 text-red-800' : 'bg-orange-100 text-orange-800'}`}>
                          {exp.estado}
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-slate-700">{exp.empresas?.razon_social}</h3>
                      <p className="text-xs text-slate-500">Fecha Prog: {exp.inspecciones?.[0]?.fecha_programada}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}