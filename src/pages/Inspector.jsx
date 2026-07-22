import { useState, useEffect, useCallback } from 'react';
import { ListFilter, ClipboardCheck, Calendar, RefreshCw, ExternalLink, X, AlertTriangle } from 'lucide-react';
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
  const hoyStr = new Date().toISOString().split('T')[0];
  const [searchTerm, setSearchTerm] = useState('');

  const [modalObs, setModalObs] = useState({ 
    visible: false, 
    expedienteId: null,
    opciones: {
      planos: false,
      extintores: false,
      senalizacion: false,
      tablero: false,
      evacuacion: false,
    },
    textoExtra: ''
  });

  const cargarExpedientes = useCallback(async () => {
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
  }, [tabActual]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargarExpedientes();

    // Configuración de Supabase Realtime para la "Reactividad en Vivo"
    const channel = supabase
      .channel('expedientes-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'expedientes' },
        () => {
          cargarExpedientes(); // Actualiza automáticamente la bandeja sin F5
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [cargarExpedientes]);

  const actualizarEstadoTramite = async (expedienteId, nuevoEstado, textoObservacionGenerado = null) => {
    setError('');
    setMensajeExito('');

    // Si no es por modal y es Observado, no debe ejecutarse aquí directamente (se ataja por UI)
    if (nuevoEstado === 'Observado' && !textoObservacionGenerado) {
      return; 
    }

    try {
      await expedientesService.actualizarEstadoExpediente(expedienteId, nuevoEstado);

      if (nuevoEstado === 'Observado') {
        // Cálculo estricto de 30 días hábiles (Lunes a Viernes)
        const calcularFechaHabil = (diasPlazo) => {
          let fecha = new Date();
          let diasAgregados = 0;
          while (diasAgregados < diasPlazo) {
            fecha.setDate(fecha.getDate() + 1);
            // 0 = Domingo, 6 = Sábado
            if (fecha.getDay() !== 0 && fecha.getDay() !== 6) {
              diasAgregados++;
            }
          }
          return fecha.toISOString().split('T')[0];
        };
        const fechaSegundaVisita = calcularFechaHabil(30);
        
        await expedientesService.crearInspeccion({
          expediente_id: expedienteId, 
          fecha_programada: fechaSegundaVisita, 
          estado: 'Programada',
          observaciones: textoObservacionGenerado
        });

        const expData = expedientes.find(e => e.id === expedienteId);
        if (expData?.empresas?.email_contacto) {
          expedientesService.enviarCorreoNotificacion({
            email: expData.empresas.email_contacto,
            codigo: expData.codigo,
            razonSocial: expData.empresas.razon_social,
            fechaVisita: fechaSegundaVisita,
            observaciones: textoObservacionGenerado,
            tipoNotificacion: 'observacion'
          }).catch(err => console.error("Error enviando correo observacion:", err));
        }

        setMensajeExito(`Expediente observado. Se programó 2da visita y se notificó al negocio (Fecha: ${fechaSegundaVisita}).`);
      } else if (nuevoEstado === 'Aprobado' || nuevoEstado === 'Rechazado' || nuevoEstado === 'Denegado Definitivo') {
        const expData = expedientes.find(e => e.id === expedienteId);
        if (expData?.empresas?.email_contacto) {
          expedientesService.enviarCorreoNotificacion({
            email: expData.empresas.email_contacto,
            codigo: expData.codigo,
            razonSocial: expData.empresas.razon_social,
            tipoNotificacion: nuevoEstado === 'Aprobado' ? 'aprobado' : 'rechazado'
          }).catch(err => console.error("Error enviando correo resultado final:", err));
        }
        setMensajeExito(`Trámite marcado como ${nuevoEstado} y notificado.`);
      } else {
        setMensajeExito('Se actualizó el estado del trámite.');
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


  const agrupados = { atrasadas: [], hoy: [] };
  
  if (tabActual === 'pendientes') {
    expedientes.forEach(exp => {
      if (['Aprobado', 'Rechazado', 'Observado', 'Denegado Definitivo'].includes(exp.estado)) return;
      
      // Find the inspection with the latest scheduled date
      const ultimaInspeccion = exp.inspecciones?.sort((a, b) => new Date(b.fecha_programada) - new Date(a.fecha_programada))[0];
      const f = ultimaInspeccion?.fecha_programada;
      if (!f) return;

      if (f < hoyStr) agrupados.atrasadas.push(exp);
      else if (f === hoyStr) agrupados.hoy.push(exp);
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
                          onChange={(e) => {
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
                    {exp.estado !== 'Observado' && (
                      <Button
                        variant="danger"
                        onClick={() => {
                          setModalObs({
                            visible: true,
                            expedienteId: exp.id,
                            opciones: { planos: false, extintores: false, senalizacion: false, tablero: false, evacuacion: false },
                            textoExtra: ''
                          });
                        }}
                        className="w-full text-sm font-bold"
                      >
                        Observar Local
                      </Button>
                    )}
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
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-blue-50 px-4 py-2 rounded-lg border border-blue-200 shadow-sm">
              <ClipboardCheck className="w-5 h-5 text-blue-600" />
              <span className="text-sm text-blue-800 font-bold">Lista Diaria de Tareas</span>
            </div>

            <Button onClick={cargarExpedientes} isLoading={loading} variant="secondary" className="w-auto px-4 py-2 text-sm bg-white shadow-sm border border-slate-200 text-slate-700 hover:bg-slate-50">
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Actualizar
            </Button>
          </div>
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

        {tabActual === 'todos' ? (
          <div className="space-y-4">
            {expedientes.filter(exp => {
              if (!searchTerm) return true;
              const term = searchTerm.toLowerCase();
              return (
                (exp.codigo && exp.codigo.toLowerCase().includes(term)) ||
                (exp.empresas?.ruc && exp.empresas.ruc.toLowerCase().includes(term)) ||
                (exp.empresas?.razon_social && exp.empresas.razon_social.toLowerCase().includes(term))
              );
            }).length === 0 ? (
              <div className="bg-white p-12 rounded-xl shadow border border-slate-200 text-center text-slate-500 font-medium flex flex-col items-center justify-center">
                <p className="text-lg">No se encontraron expedientes con ese término.</p>
              </div>
            ) : (
              renderGrupo(
                "Todas las Inspecciones", 
                expedientes.filter(exp => {
                  if (!searchTerm) return true;
                  const term = searchTerm.toLowerCase();
                  return (
                    (exp.codigo && exp.codigo.toLowerCase().includes(term)) ||
                    (exp.empresas?.ruc && exp.empresas.ruc.toLowerCase().includes(term)) ||
                    (exp.empresas?.razon_social && exp.empresas.razon_social.toLowerCase().includes(term))
                  );
                }).sort((a, b) => {
                  const inspA = a.inspecciones?.sort((x, y) => new Date(y.fecha_programada) - new Date(x.fecha_programada))[0];
                  const inspB = b.inspecciones?.sort((x, y) => new Date(y.fecha_programada) - new Date(x.fecha_programada))[0];
                  const dateA = inspA ? new Date(inspA.fecha_programada) : new Date(8640000000000000);
                  const dateB = inspB ? new Date(inspB.fecha_programada) : new Date(8640000000000000);
                  return dateA - dateB;
                }), 
                "text-slate-800 border-slate-300"
              )
            )}
          </div>
        ) : tabActual === 'pendientes' ? (
          (agrupados.atrasadas.length === 0 && agrupados.hoy.length === 0) ? (
            <div className="bg-white p-12 rounded-xl shadow border border-slate-200 text-center text-slate-500 font-medium flex flex-col items-center justify-center">
              <ClipboardCheck className="w-16 h-16 text-slate-300 mb-4" />
              <p className="text-lg">No hay inspecciones pendientes programadas para hoy.</p>
              <p className="text-sm font-normal mt-1 text-slate-400">Buen trabajo, la bandeja está limpia.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {renderGrupo("⚠️ Atrasadas", agrupados.atrasadas, "text-red-700 border-red-200")}
              {renderGrupo("📅 Inspecciones de Hoy", agrupados.hoy, "text-blue-800 border-blue-200")}
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
                const ultimaInspeccion = exp.inspecciones?.sort((a, b) => new Date(b.fecha_programada) - new Date(a.fecha_programada))[0];
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
                      <p className="text-xs text-slate-500">Fecha Prog: {ultimaInspeccion?.fecha_programada}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Modal de Observaciones */}
      {modalObs.visible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-slate-200 bg-slate-50">
              <h3 className="text-lg font-bold text-red-700 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" /> Registrar Observaciones
              </h3>
              <button 
                onClick={() => setModalObs({ ...modalObs, visible: false })}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-600 mb-2">Seleccione las infracciones o problemas encontrados durante la visita técnica:</p>
              
              <div className="space-y-3">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" className="mt-1 w-4 h-4 text-red-600" checked={modalObs.opciones.planos} onChange={(e) => setModalObs({...modalObs, opciones: {...modalObs.opciones, planos: e.target.checked}})} />
                  <div>
                    <span className="font-bold text-slate-700 block text-sm">Planos no coinciden con la realidad</span>
                    <span className="text-xs text-red-500 font-medium">⚠️ Requerirá que el ciudadano suba nuevos planos.</span>
                  </div>
                </label>
                
                <label className="flex items-center gap-3 cursor-pointer text-sm font-medium text-slate-700">
                  <input type="checkbox" className="w-4 h-4 text-red-600" checked={modalObs.opciones.extintores} onChange={(e) => setModalObs({...modalObs, opciones: {...modalObs.opciones, extintores: e.target.checked}})} />
                  Falta de extintores o extintores vencidos
                </label>
                
                <label className="flex items-center gap-3 cursor-pointer text-sm font-medium text-slate-700">
                  <input type="checkbox" className="w-4 h-4 text-red-600" checked={modalObs.opciones.senalizacion} onChange={(e) => setModalObs({...modalObs, opciones: {...modalObs.opciones, senalizacion: e.target.checked}})} />
                  Señalización de seguridad deficiente o nula
                </label>
                
                <label className="flex items-center gap-3 cursor-pointer text-sm font-medium text-slate-700">
                  <input type="checkbox" className="w-4 h-4 text-red-600" checked={modalObs.opciones.tablero} onChange={(e) => setModalObs({...modalObs, opciones: {...modalObs.opciones, tablero: e.target.checked}})} />
                  Tablero eléctrico expuesto o sin llaves termomagnéticas
                </label>
                
                <label className="flex items-center gap-3 cursor-pointer text-sm font-medium text-slate-700">
                  <input type="checkbox" className="w-4 h-4 text-red-600" checked={modalObs.opciones.evacuacion} onChange={(e) => setModalObs({...modalObs, opciones: {...modalObs.opciones, evacuacion: e.target.checked}})} />
                  Rutas de evacuación obstruidas
                </label>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100">
                <label className="block text-sm font-bold text-slate-700 mb-2">Otras observaciones adicionales (opcional):</label>
                <textarea 
                  className="w-full border border-slate-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-red-500 outline-none"
                  rows="3"
                  placeholder="Escriba aquí si hay detalles específicos..."
                  value={modalObs.textoExtra}
                  onChange={(e) => setModalObs({...modalObs, textoExtra: e.target.value})}
                ></textarea>
              </div>
            </div>
            
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
              <button 
                onClick={() => setModalObs({ ...modalObs, visible: false })}
                className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-lg"
              >
                Cancelar
              </button>
              <button 
                onClick={() => {
                  let obsArr = [];
                  if (modalObs.opciones.planos) obsArr.push("[REQUIERE NUEVOS PLANOS] Planos arquitectónicos no coinciden con la realidad.");
                  if (modalObs.opciones.extintores) obsArr.push("- Falta de extintores o extintores vencidos.");
                  if (modalObs.opciones.senalizacion) obsArr.push("- Señalización de seguridad deficiente o nula.");
                  if (modalObs.opciones.tablero) obsArr.push("- Tablero eléctrico expuesto o sin llaves termomagnéticas.");
                  if (modalObs.opciones.evacuacion) obsArr.push("- Rutas de evacuación obstruidas.");
                  if (modalObs.textoExtra.trim() !== '') obsArr.push(`- Otros: ${modalObs.textoExtra.trim()}`);
                  
                  if (obsArr.length === 0) {
                    alert("Debe seleccionar o escribir al menos una observación.");
                    return;
                  }
                  
                  const textoFinal = obsArr.join('\n');
                  actualizarEstadoTramite(modalObs.expedienteId, 'Observado', textoFinal);
                  setModalObs({ ...modalObs, visible: false });
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-bold flex items-center gap-2 shadow-sm"
              >
                <AlertTriangle className="w-4 h-4" /> Registrar Observación
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}