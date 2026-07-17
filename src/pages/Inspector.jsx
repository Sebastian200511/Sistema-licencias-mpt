import { useState, useEffect } from 'react';
import { ListFilter, ClipboardCheck, AlertTriangle, FileX, Calendar, RefreshCw, ExternalLink } from 'lucide-react';
import { expedientesService } from '../services/expedientesService';
import Alert from '../components/Alert';
import Button from '../components/Button';

export default function Inspector() {
  const [expedientes, setExpedientes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mensajeExito, setMensajeExito] = useState('');


  const cargarExpedientes = async () => {
    setLoading(true);
    try {
      const expedientesDeHoy = await expedientesService.obtenerInspeccionesDeHoy();
      setExpedientes(expedientesDeHoy);
    } catch (err) {
      setError(err.message || 'Error al cargar trámites.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarExpedientes();
  }, []);

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
        fechaFutura.setDate(fechaFutura.getDate() + 30);
        const fechaSegundaVisita = fechaFutura.toISOString().split('T')[0];
        
        await expedientesService.crearInspeccion({
          expediente_id: expedienteId, 
          fecha_programada: fechaSegundaVisita, 
          estado: 'Programada',
          observaciones: 'Reprogramación por primera visita observada'
        });

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

  return (
    <div className="bg-slate-100">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <ListFilter className="text-blue-900" /> Inspecciones Programadas para Hoy
          </h2>
          <Button onClick={cargarExpedientes} isLoading={loading} variant="secondary" className="w-auto px-4 py-2 text-sm">
            Actualizar Lista
          </Button>
        </div>

        {error && <Alert type="error" message={error} />}
        {mensajeExito && <Alert type="success" message={mensajeExito} />}

        {expedientes.length === 0 ? (
          <div className="bg-white p-8 rounded-xl shadow text-center text-gray-500 font-medium">
            No existen solicitudes de licencias pendientes en el sistema actualmente.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {expedientes.map((exp) => {
              const inspeccionAsignada = exp.inspecciones && exp.inspecciones[0];
              
              // Validar formato de URL del plano
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
                    {exp.estado === 'Pendiente' ? (
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
                    ) : exp.estado === 'Observado' ? (
                      <div className="flex flex-col gap-2 w-full md:w-auto border border-orange-200 bg-orange-50 p-2.5 rounded-lg shadow-sm">
                        <span className="text-xs font-bold text-orange-800 text-center uppercase tracking-wider">Acciones de 2da Visita</span>
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
    </div>
  );
}