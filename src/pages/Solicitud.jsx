import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { FileText, Upload, CreditCard, CheckCircle, ArrowRight } from 'lucide-react';

export default function Solicitud() {
  const navigate = useNavigate();
  const [empresaId, setEmpresaId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pagoSimulado, setPagoSimulado] = useState(false);
  const [planoSeleccionado, setPlanoSeleccionado] = useState(null);
  const [expedienteCreado, setExpedienteCreado] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    // Verificar que venimos del login con una empresa validada
    const id = localStorage.getItem('empresa_id');
    if (!id) {
      navigate('/');
    } else {
      setEmpresaId(id);
    }
  }, [navigate]);

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
    }, 1500); // Simula un procesamiento de 1.5 segundos
  };

  const handleSubmitTramite = async (e) => {
    e.preventDefault();
    setError('');

    if (!planoSeleccionado) {
      setError('Por favor, adjunte el plano estructural del local.');
      return;
    }
    if (!pagoSimulado) {
      setError('Debe realizar la simulación del pago de S/ 180.00 para proceder.');
      return;
    }

    try {
      // Generar código de expediente único (Ej: MPT-2026-8492)
      const numeroAleatorio = Math.floor(1000 + Math.random() * 9000);
      const codigoExpediente = `MPT-2026-${numeroAleatorio}`;

      // Insertar trámite en Supabase
      const { data, error: insertError } = await supabase
        .from('expedientes')
        .insert([
          {
            codigo: codigoExpediente,
            empresa_id: empresaId,
            plano_url: planoSeleccionado, // Guardamos el nombre del archivo adjunto
            pago_realizado: true,
            estado: 'Pendiente'
          }
        ])
        .select()
        .single();

      if (insertError) throw insertError;

      // Guardar el código generado para mostrarlo en la confirmación
      setExpedienteCreado(codigoExpediente);

    } catch (err) {
      setError('Error al registrar el trámite en la base de datos.');
      console.error(err);
    }
  };

  // Si el expediente ya fue creado, mostramos la pantalla de éxito (HU03)
  if (expedienteCreado) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="bg-white p-8 rounded-xl shadow-xl w-full max-w-md text-center border-t-4 border-green-600">
          <div className="flex justify-center mb-4">
            <CheckCircle className="text-green-600 w-16 h-16" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800">¡Solicitud Registrada!</h2>
          <p className="text-gray-600 mt-2">El pago y los requisitos han sido validados con éxito por la plataforma de la MPT.</p>
          
          <div className="bg-blue-50 p-4 rounded-lg my-6 border border-blue-200">
            <span className="text-xs text-blue-700 font-bold uppercase tracking-wider">Código de Expediente</span>
            <p className="text-3xl font-mono font-bold text-blue-900 mt-1">{expedienteCreado}</p>
          </div>

          <p className="text-sm text-gray-500 mb-6">
            Guarde este código. Lo necesitará para consultar el estado de su inspección técnica.
          </p>

          <button 
            onClick={() => navigate('/')} 
            className="w-full bg-blue-700 text-white font-bold py-2.5 px-4 rounded hover:bg-blue-800 transition"
          >
            Volver al Inicio
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      {/* Encabezado MPT */}
      <header className="bg-blue-900 text-white shadow-md py-4 px-6 flex justify-between items-center">
        <div>
          <h1 className="text-lg font-bold tracking-wide">MUNICIPALIDAD PROVINCIAL DE TRUJILLO</h1>
          <p className="text-xs text-blue-200">Plataforma de Licencias de Funcionamiento Digital</p>
        </div>
        <span className="bg-blue-800 text-xs px-3 py-1 rounded text-blue-200 font-medium">Nueva Solicitud</span>
      </header>

      <main className="max-w-2xl mx-auto mt-8 p-4">
        <div className="bg-white p-8 rounded-xl shadow-md">
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2 mb-6">
            <FileText className="text-blue-700 w-6 h-6" /> Requisitos y Derecho de Trámite
          </h2>

          {error && <div className="bg-red-100 text-red-700 p-3 rounded mb-4 text-sm">{error}</div>}

          <form onSubmit={handleSubmitTramite} className="space-y-6">
            
            {/* Sección de Carga del Plano */}
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

            {/* Sección de Pago de Tasa */}
            <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="font-bold text-gray-800 flex items-center gap-2">
                    <CreditCard className="text-blue-700 w-5 h-5" /> Tasa por Derecho de Trámite
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">TUPA - Licencia de Funcionamiento Municipal</p>
                </div>
                <span className="text-xl font-mono font-bold text-gray-900">S/ 180.00</span>
              </div>

              {pagoSimulado ? (
                <div className="bg-green-100 text-green-800 p-3 rounded text-sm font-semibold text-center">
                  ✓ Pago Procesado Correctamente (Simulación Virtual)
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleSimularPago}
                  disabled={loading}
                  className="w-full bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-bold py-2 px-4 rounded text-sm transition disabled:opacity-50"
                >
                  {loading ? 'Procesando pago con pasarela...' : 'Simular Pago de Tasa (S/ 180.00)'}
                </button>
              )}
            </div>

            {/* Botón de Envío Final */}
            <button
              type="submit"
              className="w-full bg-blue-700 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-800 transition flex items-center justify-center gap-2 text-base shadow"
            >
              Enviar Solicitud a Evaluación <ArrowRight className="w-5 h-5" />
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}