import CertificadoLicencia from '../components/CertificadoLicencia';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { Search, FileText, CheckCircle, Clock, AlertCircle, XCircle, ArrowLeft, Download, Calendar } from 'lucide-react';
import jsPDF from 'jspdf'; 

export default function Seguimiento() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ ruc: '', codigo: '' });
  const [tramite, setTramite] = useState(null);
  const [empresa, setEmpresa] = useState(null);
  const [ultimaInspeccion, setUltimaInspeccion] = useState(null); // NUEVO: Para guardar la inspección
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleBuscar = async (e) => {
    e.preventDefault();
    setError('');
    setTramite(null);
    setUltimaInspeccion(null);
    setLoading(true);

    try {
      const { data: expData, error: expError } = await supabase
        .from('expedientes')
        .select('*, empresas ( ruc, razon_social, domicilio_fiscal ), inspecciones (*)')
        .eq('codigo', formData.codigo.trim().toUpperCase())
        .single();

      if (expError || !expData) throw new Error('Expediente no encontrado.');
      if (expData.empresas.ruc !== formData.ruc.trim()) throw new Error('El RUC no coincide.');

      // CORRECCIÓN: Buscamos específicamente la inspección que tiene la observación
      if (expData.inspecciones && expData.inspecciones.length > 0) {
        
        // 1. Intentamos buscar la inspección que causó la observación
        const inspeccionConObservacion = expData.inspecciones.find(
          insp => insp.estado === 'Observado' && insp.observaciones
        );

        if (inspeccionConObservacion) {
          setUltimaInspeccion(inspeccionConObservacion);
        } else {
          // 2. Si no la encuentra (por si acaso), ordenamos por fecha de creación de forma segura
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

  const generarLicenciaPDF = () => {
    const doc = new jsPDF();
    const fechaEmision = new Date();
    const fechaVencimiento = new Date();
    fechaVencimiento.setFullYear(fechaEmision.getFullYear() + 1);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(30, 58, 138); 
    doc.text("MUNICIPALIDAD PROVINCIAL DE TRUJILLO", 105, 30, { align: "center" });
    
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text("LICENCIA DE FUNCIONAMIENTO DEFINITIVA", 105, 40, { align: "center" });
    
    doc.line(20, 45, 190, 45); 

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    
    doc.text(`N° Expediente: ${tramite.codigo}`, 20, 60);
    doc.text(`Fecha de Emisión: ${fechaEmision.toLocaleDateString()}`, 130, 60);
    
    doc.setFont("helvetica", "bold");
    doc.text("DATOS DEL TITULAR Y ESTABLECIMIENTO", 20, 80);
    
    doc.setFont("helvetica", "normal");
    doc.text(`Razón Social: ${empresa.razon_social}`, 20, 95);
    doc.text(`RUC: ${empresa.ruc}`, 20, 105);
    doc.text(`Ubicación del Local: ${empresa.domicilio_fiscal}`, 20, 115);
    
    doc.setFillColor(240, 248, 255);
    doc.rect(20, 135, 170, 25, "F");
    doc.setFont("helvetica", "bold");
    doc.text("VIGENCIA DE LA LICENCIA: 01 AÑO", 105, 145, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.text(`Válido hasta: ${fechaVencimiento.toLocaleDateString()}`, 105, 153, { align: "center" });

    doc.line(60, 220, 150, 220);
    doc.setFont("helvetica", "bold");
    doc.text("Subgerencia de Licencias y Comercialización", 105, 227, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.text("Municipalidad Provincial de Trujillo", 105, 233, { align: "center" });

    doc.save(`Licencia_MPT_${tramite.codigo}.pdf`);
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
          <button onClick={() => navigate('/')} className="hover:bg-blue-800 p-2 rounded transition">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-bold tracking-wide">MUNICIPALIDAD PROVINCIAL DE TRUJILLO</h1>
            <p className="text-xs text-blue-200">Plataforma de Consulta de Trámites</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto mt-8 p-4">
        <div className="bg-white p-6 rounded-xl shadow-md mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Search className="text-blue-700" /> Consultar Estado de Expediente
          </h2>
          <form onSubmit={handleBuscar} className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">RUC de la Empresa</label>
              <input type="number" required value={formData.ruc} onChange={(e) => setFormData({...formData, ruc: e.target.value})} className="w-full p-2 border rounded" placeholder="11 dígitos" />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Código de Expediente</label>
              <input type="text" required value={formData.codigo} onChange={(e) => setFormData({...formData, codigo: e.target.value})} className="w-full p-2 border rounded uppercase" placeholder="Ej. MPT-2026-1234" />
            </div>
            <div className="flex items-end">
              <button disabled={loading} type="submit" className="w-full md:w-auto bg-blue-700 text-white font-bold py-2 px-6 rounded hover:bg-blue-800 transition">
                {loading ? 'Buscando...' : 'Buscar'}
              </button>
            </div>
          </form>
          {error && <div className="mt-4 bg-red-100 text-red-700 p-3 rounded text-sm">{error}</div>}
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

              {/* BLOQUE DE OBSERVACIONES PARA EL DUEÑO DEL NEGOCIO */}
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
                <div className="mt-8 w-full flex flex-col items-center">
                  {/* Tu botón original de descargar PDF */}
                  <button 
                    onClick={generarLicenciaPDF}
                    className="mb-8 flex items-center gap-2 bg-green-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-green-700 transition shadow-lg"
                  >
                    <Download className="w-5 h-5" /> Descargar Licencia Oficial (PDF)
                  </button>

                  {/* AQUÍ INSERTAMOS EL CERTIFICADO VISUAL CON LOS DATOS REALES DE TU BASE */}
                  <div className="w-full overflow-x-auto border-t-2 border-dashed border-gray-200 pt-8 mt-2">
                    <p className="text-gray-500 font-bold mb-4 text-sm text-center">VISTA PREVIA DEL CERTIFICADO OFICIAL:</p>
                    <div className="transform scale-75 md:scale-100 origin-top flex justify-center">
                      <CertificadoLicencia 
                        datosLicencia={{
                          razonSocial: empresa.razon_social,
                          ruc: empresa.ruc,
                          direccionLocal: empresa.domicilio_fiscal,
                          codigoExpediente: tramite.codigo,
                          nombreComercial: empresa.nombre_comercial || empresa.razon_social, 
                          representanteLegal: empresa.representante_legal || '-',
                          dniRepresentante: empresa.dni_representante || '-',
                          giro: empresa.giro || 'Comercio General',
                          area: empresa.area || '-',
                          zonificacion: empresa.zonificacion || 'RDA',
                          horarioAtencion: empresa.horario || '08:00 a 20:00',
                          numeroLicencia: tramite.id ? `00${tramite.id}` : '002307'
                        }} 
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}