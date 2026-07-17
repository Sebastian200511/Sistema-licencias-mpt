import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Search, FileText, CheckCircle, Clock, AlertCircle, XCircle, ArrowLeft, Download, Calendar } from 'lucide-react';
import { expedientesService } from '../services/expedientesService';
import { pdfGenerator } from '../utils/pdfGenerator';

export default function Seguimiento() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ ruc: '', codigo: '' });
  const [tramite, setTramite] = useState(null);
  const [empresa, setEmpresa] = useState(null);
  const [ultimaInspeccion, setUltimaInspeccion] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [modoRecuperacion, setModoRecuperacion] = useState(false);
  const [codigoRecuperado, setCodigoRecuperado] = useState(null);
  const [loadingRecuperacion, setLoadingRecuperacion] = useState(false);
  const [subsanacionFile, setSubsanacionFile] = useState(null);
  const [subsanacionLoading, setSubsanacionLoading] = useState(false);
  const [subsanacionExito, setSubsanacionExito] = useState(false);

  const handleBuscar = async (e) => {
    e.preventDefault();
    setError('');
    setTramite(null);
    setUltimaInspeccion(null);
    setLoading(true);

    try {
      const expData = await expedientesService.buscarExpediente(formData.codigo.trim().toUpperCase());

      if (expData.empresas.ruc !== formData.ruc.trim()) throw new Error('El RUC no coincide.');

      if (expData.inspecciones && expData.inspecciones.length > 0) {
        // Buscar la inspección que causó la observación
        const inspeccionConObservacion = expData.inspecciones.find(
          insp => insp.estado === 'Observado' && insp.observaciones
        );

        if (inspeccionConObservacion) {
          setUltimaInspeccion(inspeccionConObservacion);
        } else {
          // Fallback: ordenar por fecha de creación
          const ordenadasPorFecha = expData.inspecciones.sort(
            (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)
          );
          setUltimaInspeccion(ordenadasPorFecha[0]);
        }
      }

      setTramite(expData);
      setEmpresa(expData.empresas);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  const handleRecuperarCodigo = async (e) => {
    e.preventDefault();
    setError('');
    setCodigoRecuperado(null);
    setLoadingRecuperacion(true);

    if (formData.ruc.length !== 11) {
      setError('Ingrese un RUC válido de 11 dígitos.');
      setLoadingRecuperacion(false);
      return;
    }

    try {
      // Usamos el nombre correcto de la columna: fecha_creacion
      const data = await expedientesService.obtenerEmpresaPorRuc(formData.ruc.trim());

      if (!data || !data.expedientes || data.expedientes.length === 0) {
        throw new Error('No se encontraron trámites registrados para este RUC.');
      }

      // Ordenamos usando fecha_creacion
      const tramitesOrdenados = data.expedientes.sort((a, b) => {
        // Aseguramos que si alguna fecha es nula, no rompa la matemática
        const fechaA = new Date(a.fecha_creacion || 0);
        const fechaB = new Date(b.fecha_creacion || 0);
        return fechaB - fechaA;
      });
      
      setCodigoRecuperado(tramitesOrdenados[0].codigo);
      
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingRecuperacion(false);
    }
  };

  const handleSubsanar = async () => {
    if(!subsanacionFile) return;
    setSubsanacionLoading(true);
    setError('');
    try {
        const planoPublicUrl = await expedientesService.subirPlanoSubsanacion(tramite.codigo, subsanacionFile);
        await expedientesService.actualizarPlanoExpediente(tramite.id, planoPublicUrl);
        
        setSubsanacionExito(true);
        setTramite({...tramite, plano_url: planoPublicUrl});
    } catch (err) {
        setError('Error al subir documento de subsanación: ' + err.message);
    } finally {
        setSubsanacionLoading(false);
    }
  };

  const generarLicenciaPDF = () => {
    pdfGenerator.generarLicencia(tramite);
  };

  const getStatusUI = (estado) => {
    switch(estado) {
      case 'Pendiente': return { color: 'text-yellow-600', bg: 'bg-yellow-100', icon: <Clock className="w-10 h-10"/>, texto: 'En Evaluación Técnica' };
      case 'Aprobado': return { color: 'text-green-600', bg: 'bg-green-100', icon: <CheckCircle className="w-10 h-10"/>, texto: 'Trámite Aprobado' };
      case 'Observado': return { color: 'text-orange-600', bg: 'bg-orange-100', icon: <AlertCircle className="w-10 h-10"/>, texto: 'Local Observado (Plazo 30 días)' };
      case 'Denegado': return { color: 'text-red-600', bg: 'bg-red-100', icon: <XCircle className="w-10 h-10"/>, texto: 'Licencia Denegada' };
      default: return { color: 'text-gray-600', bg: 'bg-gray-100', icon: <FileText className="w-10 h-10"/>, texto: estado };
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <header className="bg-blue-900 text-white shadow-md py-4 px-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/" className="hover:bg-blue-800 p-2 rounded transition inline-flex">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-lg font-bold tracking-wide">MUNICIPALIDAD PROVINCIAL DE TRUJILLO</h1>
            <p className="text-xs text-blue-200">Plataforma de Consulta de Trámites</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto mt-8 p-4">
        <div className="bg-white p-6 rounded-xl shadow-md mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Search className="text-blue-700" /> {modoRecuperacion ? 'Recuperar Código Perdido' : 'Consultar Estado de Expediente'}
          </h2>

          {!modoRecuperacion ? (
            // --- MODO NORMAL: BUSCAR CON RUC Y CÓDIGO ---
            <>
              <form onSubmit={handleBuscar} className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">RUC de la Empresa</label>
                  <input type="text" maxLength={11} required value={formData.ruc} onChange={(e) => { const val = e.target.value.replace(/\D/g, ''); if (val.length <= 11) setFormData({...formData, ruc: val}); }} className="w-full p-2 border rounded outline-none focus:ring-2 focus:ring-blue-900" placeholder="11 dígitos" />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Código de Expediente</label>
                  <input type="text" required value={formData.codigo} onChange={(e) => setFormData({...formData, codigo: e.target.value})} className="w-full p-2 border rounded uppercase outline-none focus:ring-2 focus:ring-blue-900" placeholder="Ej. MPT-2026-1234" />
                </div>
                <div className="flex items-end">
                  <button disabled={loading} type="submit" className="w-full md:w-auto bg-blue-700 text-white font-bold py-2 px-6 rounded hover:bg-blue-800 transition">
                    {loading ? 'Buscando...' : 'Buscar'}
                  </button>
                </div>
              </form>
              <div className="mt-4 text-right">
                <button type="button" onClick={() => { setModoRecuperacion(true); setError(''); setTramite(null); }} className="text-sm text-blue-600 hover:text-blue-800 font-semibold hover:underline">
                  ¿Olvidó su código de expediente?
                </button>
              </div>
            </>
          ) : (
            // --- MODO RECUPERACIÓN: SOLO PIDE RUC ---
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
              <p className="text-sm text-slate-600 mb-4">Ingrese el RUC de su negocio. El sistema buscará su código de trámite más reciente.</p>
              <form onSubmit={handleRecuperarCodigo} className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <input type="text" maxLength={11} required value={formData.ruc} onChange={(e) => { const val = e.target.value.replace(/\D/g, ''); if (val.length <= 11) setFormData({...formData, ruc: val}); }} className="w-full p-2 border rounded outline-none focus:ring-2 focus:ring-blue-900" placeholder="Ingrese su RUC (11 dígitos)" />
                </div>
                <div className="flex items-end">
                  <button disabled={loadingRecuperacion} type="submit" className="w-full md:w-auto bg-slate-800 text-white font-bold py-2 px-6 rounded hover:bg-slate-900 transition">
                    {loadingRecuperacion ? 'Buscando...' : 'Recuperar Código'}
                  </button>
                </div>
              </form>
              
              {codigoRecuperado && (
                <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg text-center">
                  <p className="text-sm text-green-800 font-semibold mb-1">Su código de expediente es:</p>
                  <p className="text-2xl font-mono font-bold text-green-900 tracking-wider select-all">{codigoRecuperado}</p>
                </div>
              )}

              <div className="mt-4 text-left">
                <button type="button" onClick={() => { setModoRecuperacion(false); setCodigoRecuperado(null); setError(''); }} className="text-sm text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 hover:underline">
                  <ArrowLeft className="w-4 h-4" /> Volver a la consulta normal
                </button>
              </div>
            </div>
          )}

          {error && <div className="mt-4 bg-red-100 text-red-700 p-3 rounded text-sm font-semibold">{error}</div>}
        </div>

        {tramite && (
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="bg-gray-100 p-4 border-b flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-500 font-bold uppercase">Expediente Encontrado</p>
                <p className="text-xl font-mono font-bold text-gray-900">{tramite.codigo}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-gray-800">{empresa.razon_social}</p>
                <p className="text-xs text-gray-500">RUC: {empresa.ruc}</p>
              </div>
            </div>

            <div className="p-8 flex flex-col items-center text-center">
              <div className={`p-4 rounded-full ${getStatusUI(tramite.estado).bg} ${getStatusUI(tramite.estado).color} mb-4`}>
                {getStatusUI(tramite.estado).icon}
              </div>
              <h3 className={`text-2xl font-bold ${getStatusUI(tramite.estado).color} mb-2`}>
                {getStatusUI(tramite.estado).texto}
              </h3>

              {/* Observaciones del negocio */}
              {tramite.estado === 'Observado' && ultimaInspeccion && (
                <div className="mt-4 p-5 bg-orange-50 border border-orange-200 rounded-lg text-left w-full shadow-inner">
                  <p className="text-sm font-bold text-orange-900 flex items-center gap-2 mb-2">
                    <AlertCircle className="w-5 h-5" /> Motivo de la Observación Técnica:
                  </p>
                  <p className="text-sm text-orange-800 italic bg-white p-3 rounded border border-orange-100">
                    "{ultimaInspeccion.observaciones}"
                  </p>
                  <div className="mt-4 pt-3 border-t border-orange-200 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-orange-700" />
                    <p className="text-xs text-orange-800 font-semibold">
                      El inspector realizará una segunda visita el: <strong>{ultimaInspeccion.fecha_segunda_visita}</strong>
                    </p>
                  </div>
                  
                  {/* Formulario de subsanación */}
                  <div className="mt-4 pt-4 border-t border-orange-200">
                    <p className="text-sm font-bold text-orange-900 mb-2">Subsanar Observación (Adjuntar Nuevo Plano):</p>
                    {subsanacionExito ? (
                      <div className="bg-green-100 text-green-800 p-3 rounded text-sm font-semibold flex items-center gap-2">
                        <CheckCircle className="w-4 h-4"/> Documento actualizado correctamente para la segunda visita.
                      </div>
                    ) : (
                      <div className="flex flex-col sm:flex-row gap-3">
                        <input 
                          type="file" accept=".pdf" 
                          onChange={(e) => setSubsanacionFile(e.target.files[0])}
                          className="flex-1 text-sm bg-white border border-orange-300 rounded p-2"
                        />
                        <button 
                          onClick={handleSubsanar}
                          disabled={!subsanacionFile || subsanacionLoading}
                          className="bg-orange-600 text-white font-bold py-2 px-4 rounded hover:bg-orange-700 disabled:opacity-50 text-sm"
                        >
                          {subsanacionLoading ? 'Subiendo...' : 'Enviar Corrección'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {tramite.estado === 'Pendiente' && (
                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg text-left w-full">
                  <p className="text-sm font-bold text-blue-900 flex items-center gap-2">
                    <Clock className="w-4 h-4" /> Próxima Inspección Municipal
                  </p>
                  <p className="text-sm text-blue-700 mt-1">
                    Su local ha sido programado para una inspección técnica. Por favor, mantenga sus planos y documentación a la mano.
                  </p>
                </div>
              )}
              
              {tramite.estado === 'Aprobado' && (
                <div className="mt-6 w-full flex flex-col items-center">
                  {new Date() > new Date(new Date(tramite.fecha_creacion || new Date()).setFullYear(new Date(tramite.fecha_creacion || new Date()).getFullYear() + 1)) && (
                    <div className="w-full bg-red-100 text-red-800 p-4 rounded-lg mb-4 text-sm font-bold border border-red-200 text-center">
                      ⚠️ Esta licencia ha expirado. Su PDF se generará con marca de agua "VENCIDA". Le invitamos a realizar su trámite de renovación.
                    </div>
                  )}
                  <button 
                    onClick={generarLicenciaPDF}
                    className="flex items-center gap-2 bg-green-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-green-700 transition shadow-lg"
                  >
                    <Download className="w-5 h-5" /> Descargar Licencia Oficial (PDF)
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}