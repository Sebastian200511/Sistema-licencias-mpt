import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { FileText, Upload, CreditCard, CheckCircle, ArrowRight, RefreshCcw, Calendar, Copy } from 'lucide-react';
import { initMercadoPago, Wallet } from '@mercadopago/sdk-react';

export default function Solicitud() {
  const location = useLocation();
  const navigate = useNavigate();
  
  // 1. CREDENCIALES DE MERCADO PAGO (Pega las tuyas aquí)
  const MP_PUBLIC_KEY = 'APP_USR-8960d27a-c571-4828-a15b-4f1248f2c38b'; 
  const MP_ACCESS_TOKEN = 'APP_USR-8543008696349524-052502-16e187e28332543ee3e5ed172bacc749-3423925786';
  
  // Inicializamos Mercado Pago
  initMercadoPago(MP_PUBLIC_KEY, { locale: 'es-PE' });

  const { empresaId, tipoTramite, razonSocial } = location.state || {};

  const [loading, setLoading] = useState(false);
  const [planoSeleccionado, setPlanoSeleccionado] = useState(null);
  const [fileObject, setFileObject] = useState(null);
  const [resultadoTramite, setResultadoTramite] = useState(null);
  const [error, setError] = useState('');
  
  // Estados para Mercado Pago
  const [preferenceId, setPreferenceId] = useState(null);
  const [pagoAprobado, setPagoAprobado] = useState(false);

  const esRenovacionExpress = tipoTramite === 'renovacion_automatica';

  // Efecto para detectar si Mercado Pago nos devolvió a esta página tras un pago exitoso
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('status') === 'approved' || urlParams.get('collection_status') === 'approved') {
      setPagoAprobado(true);
      // Recuperamos el estado de sessionStorage en caso de que la redirección lo haya borrado
      const savedState = JSON.parse(sessionStorage.getItem('mpt_tramite_state'));
      if (savedState && !empresaId) {
        navigate(location.pathname, { state: savedState, replace: true });
      }
    } else if (empresaId) {
      // Guardamos en sessionStorage por si Mercado Pago hace redirección
      sessionStorage.setItem('mpt_tramite_state', JSON.stringify(location.state));
    } else if (!empresaId && !urlParams.get('status')) {
      navigate('/');
    }
  }, [navigate, empresaId, location]);

  const handleFileChange = (e) => {
    if (e.target.files.length > 0) {
      const file = e.target.files[0];
      setPlanoSeleccionado(file.name);
      setFileObject(file);
    }
  };

  // 2. FUNCIÓN QUE CREA EL COBRO EN MERCADO PAGO
  const generarBotonDePago = async () => {
    setLoading(true);
    setError('');
    try {
      // Usamos el Proxy de Vite que configuraste (/mp-api)
      const response = await fetch('/mp-api/checkout/preferences', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          items: [
            {
              title: 'Tasa por Derecho de Trámite - Licencia MPT',
              description: `Empresa: ${razonSocial}`,
              unit_price: 180, // Puedes cambiarlo a 1 para probar
              quantity: 1,
              currency_id: 'PEN'
            }
          ],
          // Si el pago es exitoso, regresará a esta misma página agregando ?status=approved
          back_urls: {
            success: window.location.href,
            failure: window.location.href,
            pending: window.location.href
          },
          auto_return: 'approved',
        })
      });

      const data = await response.json();
      if (data.id) {
        setPreferenceId(data.id);
      } else {
        throw new Error('Error al generar la preferencia de pago.');
      }
    } catch (err) {
      setError('Fallo al conectar con la pasarela de pagos.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitTramite = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!esRenovacionExpress && !fileObject && !pagoAprobado) {
      setError('Por favor, adjunte el plano estructural del local.');
      setLoading(false);
      return;
    }
    if (!pagoAprobado) {
      setError('Debe completar el pago en la pasarela para proceder.');
      setLoading(false);
      return;
    }

    try {
      let planoPublicUrl = 'No requiere (Renovación)';

      if (!esRenovacionExpress && fileObject) {
        const fileExt = fileObject.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.floor(Math.random() * 1000)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage.from('planos').upload(fileName, fileObject);
        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from('planos').getPublicUrl(fileName);
        planoPublicUrl = urlData.publicUrl;
      }

      const numeroAleatorio = Math.floor(1000 + Math.random() * 9000);
      const codigoExpediente = `MPT-2026-${numeroAleatorio}`;
      const estadoInicial = esRenovacionExpress ? 'Aprobado' : 'Pendiente';

      const { data: expData, error: insertError } = await supabase
        .from('expedientes')
        .insert([{ codigo: codigoExpediente, empresa_id: empresaId, plano_url: planoPublicUrl, pago_realizado: true, estado: estadoInicial }])
        .select().single();

      if (insertError) throw insertError;

      let fechaVisitaStr = null;
      if (!esRenovacionExpress) {
        const fechaVisita = new Date();
        fechaVisita.setDate(fechaVisita.getDate() + 4); 
        fechaVisitaStr = fechaVisita.toISOString().split('T')[0];

        const { error: inspError } = await supabase.from('inspecciones')
          .insert([{ expediente_id: expData.id, fecha_programada: fechaVisitaStr, estado: 'Programada' }]);

        if (inspError) throw inspError;
      }

      setResultadoTramite({ codigo: codigoExpediente, esExpress: esRenovacionExpress, fechaVisita: fechaVisitaStr });
    } catch (err) {
      setError('Error al registrar el trámite en la base de datos.');
    } finally {
      setLoading(false);
    }
  };

  if (!empresaId && !pagoAprobado) return null;

  if (resultadoTramite) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="bg-white p-8 rounded-xl shadow-xl w-full max-w-md text-center border-t-4 border-green-600">
          <div className="flex justify-center mb-4"><CheckCircle className="text-green-600 w-16 h-16" /></div>
          <h2 className="text-2xl font-bold text-gray-800">¡Trámite Registrado!</h2>
          
          <div className="bg-blue-50 p-4 rounded-lg my-6 border border-blue-200 relative">
            <span className="text-xs text-blue-700 font-bold uppercase tracking-wider">Código de Expediente</span>
            <div className="flex items-center justify-center gap-3 mt-1">
              <p className="text-3xl font-mono font-bold text-blue-900">{resultadoTramite.codigo}</p>
              <button 
                onClick={() => { navigator.clipboard.writeText(resultadoTramite.codigo); alert("¡Código copiado al portapapeles!"); }}
                className="bg-blue-200 hover:bg-blue-300 text-blue-800 p-2 rounded-full transition" title="Copiar Código"
              >
                <Copy className="w-5 h-5" />
              </button>
            </div>
          </div>

          {resultadoTramite.esExpress ? (
            <div className="bg-green-50 text-green-800 p-4 rounded-lg mb-6 text-sm border border-green-200">
              <p className="font-bold mb-1">✅ Renovación Automática Aprobada</p>
              <p>Su certificado de licencia ha sido extendido por 1 año. Ya puede descargarlo desde su buzón.</p>
            </div>
          ) : (
            <div className="bg-orange-50 text-orange-800 p-4 rounded-lg mb-6 text-sm border border-orange-200">
              <p className="font-bold flex items-center justify-center gap-2 mb-1"><Calendar className="w-4 h-4"/> Inspección Programada</p>
              <p>El inspector municipal visitará su local el: <strong>{resultadoTramite.fechaVisita}</strong></p>
            </div>
          )}

          <button onClick={() => navigate('/')} className="w-full bg-blue-700 text-white font-bold py-2.5 px-4 rounded hover:bg-blue-800 transition">
            Finalizar y Salir
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <header className="bg-blue-900 text-white shadow-md py-4 px-6 flex justify-between items-center">
        <div>
          <h1 className="text-lg font-bold tracking-wide">MUNICIPALIDAD PROVINCIAL DE TRUJILLO</h1>
        </div>
        <span className="bg-blue-800 text-xs px-3 py-1 rounded font-medium">Pasarela de Pagos</span>
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
            
            {!esRenovacionExpress && !pagoAprobado && (
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <Upload className="mx-auto text-gray-400 w-12 h-12 mb-2" />
                <label className="cursor-pointer block">
                  <span className="bg-blue-100 text-blue-700 font-semibold px-4 py-2 rounded text-sm hover:bg-blue-200">
                    Adjuntar Plano Estructural
                  </span>
                  <input type="file" accept=".pdf,image/*" onChange={handleFileChange} className="hidden" />
                </label>
                {planoSeleccionado && (
                  <div className="mt-3 text-sm text-green-700 font-medium bg-green-50 py-1 px-3 rounded inline-block">✓ {planoSeleccionado}</div>
                )}
              </div>
            )}

            <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="font-bold text-gray-800 flex items-center gap-2">
                    <CreditCard className="text-blue-700 w-5 h-5" /> Tasa por Derecho de Trámite
                  </h3>
                </div>
                <span className="text-xl font-mono font-bold text-gray-900">S/ 180.00</span>
              </div>

              {pagoAprobado ? (
                <div className="bg-green-100 text-green-800 p-4 rounded-lg text-sm font-bold text-center flex items-center justify-center gap-2 border border-green-300">
                  <CheckCircle className="w-5 h-5" /> ¡Pago Verificado Exitosamente por Mercado Pago!
                </div>
              ) : preferenceId ? (
                // 3. AQUÍ SE RENDERIZA LA PASARELA REAL DE MERCADO PAGO
                <div className="mt-4">
                  <Wallet initialization={{ preferenceId: preferenceId }} />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={generarBotonDePago}
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg text-sm transition shadow-md"
                >
                  {loading ? 'Conectando con Mercado Pago...' : 'Pagar S/ 180.00 con Tarjeta o Yape'}
                </button>
              )}
            </div>

            {pagoAprobado && (
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-900 text-white font-bold py-4 px-4 rounded-lg hover:bg-blue-950 transition flex items-center justify-center gap-2 text-lg shadow-xl"
              >
                {loading ? 'Procesando expediente...' : 'Generar Expediente y Finalizar'} <ArrowRight className="w-6 h-6" />
              </button>
            )}
          </form>
        </div>
      </main>
    </div>
  );
}