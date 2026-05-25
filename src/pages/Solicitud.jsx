import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { FileText, Upload, CreditCard, CheckCircle, ArrowRight, RefreshCcw, Calendar } from 'lucide-react';

export default function Solicitud() {
  const location = useLocation();
  const navigate = useNavigate();
  
  // 1. SEGURIDAD: Recuperamos los datos de la memoria, no del navegador
  const { empresaId, tipoTramite, razonSocial } = location.state || {};

  const [loading, setLoading] = useState(false);
  const [pagoSimulado, setPagoSimulado] = useState(false);
  const [planoSeleccionado, setPlanoSeleccionado] = useState(null);
  const [resultadoTramite, setResultadoTramite] = useState(null);
  const [error, setError] = useState('');

  // Identificamos si es una renovación express (HU08)
  const esRenovacionExpress = tipoTramite === 'renovacion_automatica';

  useEffect(() => {
    // Si entran por la URL sin pasar por el Login, los expulsamos a la raíz
    if (!empresaId) {
      navigate('/');
    }
  }, [navigate, empresaId]);

  const handleFileChange = (e) => {
    if (e.target.files.length > 0) {
      setPlanoSeleccionado(e.target.files[0].name);
    }
  };

  const handleSimularPago = () => {
    setLoading(true);
    setTimeout(() => {
      setPagoSimulado(true);
      setLoading(false);
    }, 1500);
  };

  const handleSubmitTramite = async (e) => {
    e.preventDefault();
    setError('');

    // Validación según el tipo de trámite
    if (!esRenovacionExpress && !planoSeleccionado) {
      setError('Por favor, adjunte el plano estructural del local.');
      return;
    }
    if (!pagoSimulado) {
      setError('Debe realizar la simulación del pago de S/ 180.00 para proceder.');
      return;
    }

    try {
      const numeroAleatorio = Math.floor(1000 + Math.random() * 9000);
      const codigoExpediente = `MPT-2026-${numeroAleatorio}`;
      
      // Si es express se aprueba directo, sino queda pendiente para inspección
      const estadoInicial = esRenovacionExpress ? 'Aprobado' : 'Pendiente';

      // 1. Insertar el Expediente
      const { data: expData, error: insertError } = await supabase
        .from('expedientes')
        .insert([
          {
            codigo: codigoExpediente,
            empresa_id: empresaId,
            plano_url: planoSeleccionado || 'No requiere (Renovación)',
            pago_realizado: true,
            estado: estadoInicial
          }
        ])
        .select()
        .single();

      if (insertError) throw insertError;

      let fechaVisitaStr = null;

      // 2. HU04: Programación Automática en la tabla Inspecciones
      if (!esRenovacionExpress) {
        const fechaVisita = new Date();
        // Corrección: Máximo 3 días hábiles según Criterios de Aceptación
        fechaVisita.setDate(fechaVisita.getDate() + 4); 
        fechaVisitaStr = fechaVisita.toISOString().split('T')[0];

        const { error: inspError } = await supabase
          .from('inspecciones')
          .insert([
            {
              expediente_id: expData.id,
              fecha_programada: fechaVisitaStr,
              estado: 'Programada'
            }
          ]);

        if (inspError) throw inspError;
      }

      setResultadoTramite({ 
        codigo: codigoExpediente, 
        esExpress: esRenovacionExpress,
        fechaVisita: fechaVisitaStr 
      });

    } catch (err) {
      setError('Error al registrar el trámite en la base de datos.');
      console.error(err);
    }
  };

  // Si no hay empresaId, no renderizamos nada para evitar parpadeos antes del redireccionamiento
  if (!empresaId) return null;

  // PANTALLA DE ÉXITO (HU03 y Finalización de HU08/HU04)
  if (resultadoTramite) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="bg-white p-8 rounded-xl shadow-xl w-full max-w-md text-center border-t-4 border-green-600">
          <div className="flex justify-center mb-4">
            <CheckCircle className="text-green-600 w-16 h-16" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800">¡Trámite Registrado!</h2>
          
          <div className="bg-blue-50 p-4 rounded-lg my-6 border border-blue-200">
            <span className="text-xs text-blue-700 font-bold uppercase tracking-wider">Código de Expediente</span>
            <p className="text-3xl font-mono font-bold text-blue-900 mt-1">{resultadoTramite.codigo}</p>
          </div>

          {resultadoTramite.esExpress ? (
            <div className="bg-green-50 text-green-800 p-4 rounded-lg mb-6 text-sm border border-green-200">
              <p className="font-bold mb-1">✅ Renovación Automática Aprobada</p>
              <p>Su certificado de licencia ha sido extendido por 1 año. Ya puede descargarlo desde su buzón.</p>
            </div>
          ) : (
            <div className="bg-orange-50 text-orange-800 p-4 rounded-lg mb-6 text-sm border border-orange-200">
              <p className="font-bold flex items-center justify-center gap-2 mb-1">
                <Calendar className="w-4 h-4"/> Inspección Programada (HU04)
              </p>
              <p>El inspector municipal visitará su local el: <strong>{resultadoTramite.fechaVisita}</strong></p>
            </div>
          )}

          <button 
            onClick={() => navigate('/')} 
            className="w-full bg-blue-700 text-white font-bold py-2.5 px-4 rounded hover:bg-blue-800 transition"
          >
            Finalizar y Salir
          </button>
        </div>
      </div>
    );
  }

  // PANTALLA DEL FORMULARIO
  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <header className="bg-blue-900 text-white shadow-md py-4 px-6 flex justify-between items-center">
        <div>
          <h1 className="text-lg font-bold tracking-wide">MUNICIPALIDAD PROVINCIAL DE TRUJILLO</h1>
          <p className="text-xs text-blue-200">Plataforma de Licencias de Funcionamiento Digital</p>
        </div>
        <span className="bg-blue-800 text-xs px-3 py-1 rounded text-blue-200 font-medium">
          {esRenovacionExpress ? 'Renovación Express' : 'Nueva Solicitud'}
        </span>
      </header>

      <main className="max-w-2xl mx-auto mt-8 p-4">
        <div className="bg-white p-8 rounded-xl shadow-md">
          <div className="mb-6 border-b pb-4">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <FileText className="text-blue-700 w-6 h-6" /> Requisitos y Pago
            </h2>
            <p className="text-gray-500 text-sm mt-1">Empresa: <strong>{razonSocial}</strong></p>
          </div>

          {error && <div className="bg-red-100 text-red-700 p-3 rounded mb-4 text-sm font-semibold">{error}</div>}

          <form onSubmit={handleSubmitTramite} className="space-y-6">
            
            {esRenovacionExpress ? (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-5 flex items-start gap-4">
                <RefreshCcw className="text-blue-600 w-8 h-8 flex-shrink-0" />
                <div>
                  <h3 className="font-bold text-blue-900">Renovación sin Cambios Estructurales</h3>
                  <p className="text-sm text-blue-800 mt-1">
                    Al declarar que no existen modificaciones físicas en el local, <strong>está exonerado</strong> de presentar nuevos planos.
                  </p>
                </div>
              </div>
            ) : (
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-500 transition">
                <Upload className="mx-auto text-gray-400 w-12 h-12 mb-2" />
                <label className="cursor-pointer block">
                  <span className="bg-blue-100 text-blue-700 font-semibold px-4 py-2 rounded text-sm hover:bg-blue-200 transition">
                    Adjuntar Plano Estructural del Local
                  </span>
                  <input type="file" accept=".pdf,image/*" onChange={handleFileChange} className="hidden" />
                </label>
                <p className="text-xs text-gray-400 mt-2">Formatos aceptados: PDF o Imágenes (Máx. 10MB)</p>
                {planoSeleccionado && (
                  <div className="mt-3 text-sm text-green-700 font-medium bg-green-50 py-1 px-3 rounded inline-block">
                    ✓ Archivo: {planoSeleccionado}
                  </div>
                )}
              </div>
            )}

            {/* SECCIÓN DE PAGO (Común para ambos flujos) */}
            <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="font-bold text-gray-800 flex items-center gap-2">
                    <CreditCard className="text-blue-700 w-5 h-5" /> Tasa por Derecho de Trámite
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {esRenovacionExpress ? 'Renovación de Licencia Municipal' : 'Emisión de Licencia de Funcionamiento'}
                  </p>
                </div>
                <span className="text-xl font-mono font-bold text-gray-900">S/ 180.00</span>
              </div>

              {pagoSimulado ? (
                <div className="bg-green-100 text-green-800 p-3 rounded text-sm font-semibold text-center">
                  ✓ Pago Procesado Correctamente
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleSimularPago}
                  disabled={loading}
                  className="w-full bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-bold py-2 px-4 rounded text-sm transition disabled:opacity-50"
                >
                  {loading ? 'Procesando pago...' : 'Simular Pago de Tasa'}
                </button>
              )}
            </div>

            <button
              type="submit"
              className="w-full bg-blue-700 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-800 transition flex items-center justify-center gap-2 text-base shadow"
            >
              {esRenovacionExpress ? 'Aprobar Renovación' : 'Enviar a Evaluación e Inspección'} <ArrowRight className="w-5 h-5" />
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}