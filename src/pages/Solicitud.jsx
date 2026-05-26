import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { FileText, Upload, CreditCard, CheckCircle, ArrowRight, Calendar, Copy } from 'lucide-react';
import { initMercadoPago, Wallet } from '@mercadopago/sdk-react';

export default function Solicitud() {
  const location = useLocation();
  const navigate = useNavigate();
  
  // Inicialización de credenciales de Mercado Pago
  const MP_PUBLIC_KEY = import.meta.env.VITE_MP_PUBLIC_KEY; 
  const MP_ACCESS_TOKEN = import.meta.env.VITE_MP_ACCESS_TOKEN;
  initMercadoPago(MP_PUBLIC_KEY, { locale: 'es-PE' });

  const { empresaId, tipoTramite, razonSocial } = location.state || {};

  const [loading, setLoading] = useState(false);
  const [planoSeleccionado, setPlanoSeleccionado] = useState(null);
  const [fileObject, setFileObject] = useState(null);
  const [resultadoTramite, setResultadoTramite] = useState(null);
  const [error, setError] = useState('');
  
  const [emailContacto, setEmailContacto] = useState('');

  const [preferenceId, setPreferenceId] = useState(null);
  const [pagoAprobado, setPagoAprobado] = useState(false);

  const esRenovacionExpress = tipoTramite === 'renovacion_automatica';

  // Validación de retorno de pasarela de pagos
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const pagoExitoso = urlParams.get('status') === 'approved' || urlParams.get('collection_status') === 'approved';

    // 1. Si el pago fue un éxito, encendemos el check verde
    if (pagoExitoso) {
      setPagoAprobado(true);
    }
    // --- MAGIA: RECUPERAR EL PDF DESPUÉS DE RECUPERAR LA PÁGINA ---
    const savedPdfName = sessionStorage.getItem('mpt_saved_pdf_name');
    const savedPdfData = sessionStorage.getItem('mpt_saved_pdf_data');
    
    // Si hay un archivo guardado en memoria y aún no lo hemos cargado en el estado
    if (savedPdfName && savedPdfData && !fileObject) {
      setPlanoSeleccionado(savedPdfName);
      // Reensamblamos el PDF
      fetch(savedPdfData)
        .then(res => res.blob())
        .then(blob => {
          const recoveredFile = new File([blob], savedPdfName, { type: blob.type || 'application/pdf' });
          setFileObject(recoveredFile);
        });
    }

    // 2. Control de la memoria de React (Para cuando el usuario cancela o regresa)
    if (!empresaId) {
      // Si React perdió la memoria por la recarga, intentamos rescatarla
      const savedState = JSON.parse(sessionStorage.getItem('mpt_tramite_state'));
      if (savedState) {
        navigate(location.pathname, { state: savedState, replace: true });
      } else {
        // Solo si definitivamente no hay nada en la memoria, lo botamos al login
        navigate('/');
      }
    } else {
      // Si tenemos los datos, los guardamos en la caja fuerte por si viaja a Mercado Pago
      sessionStorage.setItem('mpt_tramite_state', JSON.stringify(location.state));
    }
  }, [navigate, empresaId, location]);

  const handleFileChange = (e) => {
    if (e.target.files.length > 0) {
      const file = e.target.files[0];
      setPlanoSeleccionado(file.name);
      setFileObject(file);

      // Truco de ingeniería: Transformar PDF a Base64 para que sobreviva al viaje a Mercado Pago
      const reader = new FileReader();
      reader.onloadend = () => {
        sessionStorage.setItem('mpt_saved_pdf_name', file.name);
        sessionStorage.setItem('mpt_saved_pdf_data', reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Generación de preferencia de cobro dinámico
  const generarBotonDePago = async (montoACobrar) => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/mp-api/checkout/preferences', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          items: [
            {
              title: montoACobrar === 180 ? 'Tasa por Derecho de Trámite - Licencia MPT' : 'Demo Prueba Técnica Yape',
              description: `Empresa: ${razonSocial}`,
              unit_price: montoACobrar,
              quantity: 1,
              currency_id: 'PEN'
            }
          ],
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
    
    // 1. Validación de correo (Obligatorio para la seguridad)
    if (!emailContacto || !emailContacto.includes('@')) {
      setError('Por favor, ingrese un correo electrónico válido para enviarle su código.');
      return;
    }

    // 2. Validación de archivo (Solo si es nuevo trámite)
    if (!esRenovacionExpress && !fileObject) {
      setError('Por favor, adjunte el plano estructural antes de finalizar.');
      return;
    }

    // 3. Validación de pago
    if (!pagoAprobado) {
      setError('Debe completar el pago en la pasarela para proceder.');
      return;
    }

    setLoading(true);

    try {
      let planoPublicUrl = 'No requiere (Renovación)';

      // Subida de plano si corresponde
      if (!esRenovacionExpress && fileObject) {
        const fileName = `${Date.now()}-${Math.floor(Math.random() * 1000)}.pdf`;
        const { error: uploadError } = await supabase.storage.from('planos').upload(fileName, fileObject);
        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from('planos').getPublicUrl(fileName);
        planoPublicUrl = urlData.publicUrl;
      }

      const codigoExpediente = `MPT-2026-${Math.floor(1000 + Math.random() * 9000)}`;
      const estadoInicial = esRenovacionExpress ? 'Aprobado' : 'Pendiente';

      // Registro en Base de Datos (Solo con correo)
      const { data: expData, error: insertError } = await supabase
        .from('expedientes')
        .insert([{ 
          codigo: codigoExpediente, 
          empresa_id: empresaId, 
          plano_url: planoPublicUrl, 
          pago_realizado: true, 
          estado: estadoInicial,
          correo_contacto: emailContacto // Solo correo
        }])
        .select().single();

      if (insertError) throw insertError;

      // Programar inspección si no es renovación
      if (!esRenovacionExpress) {
        const fechaVisita = new Date();
        fechaVisita.setDate(fechaVisita.getDate() + 4); 
        await supabase.from('inspecciones').insert([{ 
          expediente_id: expData.id, 
          fecha_programada: fechaVisita.toISOString().split('T')[0], 
          estado: 'Programada' 
        }]);
      }

      // Simulación profesional de notificación al correo
      console.log("--- NOTIFICACIÓN MUNICIPAL ENVIADA ---");
      console.log("Destinatario:", emailContacto);
      console.log("Código de Seguimiento:", codigoExpediente);
      
      setResultadoTramite({ codigo: codigoExpediente, esExpress: esRenovacionExpress, email: emailContacto });
      sessionStorage.removeItem('mpt_saved_pdf_name');
      sessionStorage.removeItem('mpt_saved_pdf_data');

    } catch (err) {
      console.error(err);
      setError('Error al registrar el trámite: ' + err.message);
    } finally {
      setLoading(false);
    }
  };
//prueba
  

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
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <FileText className="text-blue-700 w-6 h-6" /> Requisitos y Pago
            </h2>
            <p className="text-gray-500 text-sm mt-1">Empresa: <strong>{razonSocial}</strong></p>
          </div>

          {error && <div className="bg-red-100 text-red-700 p-3 rounded mb-4 text-sm font-semibold">{error}</div>}

          <div className="space-y-6">
            
            {!esRenovacionExpress && (
              <div className="border-2 border-dashed border-blue-400 bg-blue-50 rounded-xl p-6 text-center transition-all shadow-sm">
                <Upload className="mx-auto text-blue-500 w-10 h-10 mb-3" />
                <label className="cursor-pointer block">
                  <span className="bg-blue-600 text-white font-bold px-6 py-3 rounded-lg text-sm hover:bg-blue-700 transition shadow-md">
                    Adjuntar Plano Estructural (PDF)
                  </span>
                  <input type="file" accept=".pdf,image/*" onChange={handleFileChange} className="hidden" />
                </label>
                {planoSeleccionado && (
                  <div className="mt-4 text-sm text-green-800 font-bold bg-green-100 py-2 px-4 rounded-lg inline-block border border-green-300">
                    ✓ {planoSeleccionado}
                  </div>
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
                <div className="mt-4">
                  <Wallet initialization={{ preferenceId: preferenceId }} />
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <button
                    type="button"
                    onClick={() => generarBotonDePago(180)}
                    disabled={loading}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg text-sm transition shadow-md"
                  >
                    {loading ? 'Conectando con Mercado Pago...' : 'Pagar S/ 180.00 Oficial'}
                  </button>
                </div>
              )}
            </div>
            {/* --- AQUÍ DEBES PONER EL CAMPO DE CORREO --- */}
            <div className="bg-white p-6 rounded-xl shadow-sm mb-6 border border-gray-200">
              <label className="text-xs font-bold block mb-1">Correo Electrónico para notificaciones</label>
              <input 
                type="email" 
                value={emailContacto} // Asegúrate de tener este valor
                onChange={(e) => setEmailContacto(e.target.value)} 
                className="w-full p-3 border border-gray-300 rounded-lg" 
                placeholder="nombre@empresa.com" 
                required 
              />
            </div>

            {/* --- BLOQUE DE VALIDACIÓN DINÁMICA DE ENTRADAS (HU02) --- */}
            <div className="pt-4 border-t border-slate-100 flex flex-col gap-2">
              
              {/* Alerta 1: Falta el Pago */}
              {!pagoAprobado && (
                <p className="text-xs sm:text-sm font-medium text-amber-600 bg-amber-50 border border-amber-200 py-2 px-3 rounded-lg flex items-center justify-center gap-1.5">
                  ⚠️ Pendiente: Debe procesar el pago de la tasa administrativa.
                </p>
              )}

              {/* Alerta 2: Falta el Plano (Solo si no es renovación express) */}
              {!esRenovacionExpress && !planoSeleccionado && (
                <p className="text-xs sm:text-sm font-medium text-amber-600 bg-amber-50 border border-amber-200 py-2 px-3 rounded-lg flex items-center justify-center gap-1.5">
                  ⚠️ Pendiente: Debe adjuntar el plano estructural del local comercial.
                </p>
              )}

              {/* Botón de acción final controlado por los dos estados anteriores */}
              <button
                type="button"
                onClick={handleSubmitTramite}
                disabled={loading || !pagoAprobado || (!esRenovacionExpress && !planoSeleccionado)}
                className={`w-full font-bold py-4 px-4 rounded-xl transition-all flex items-center justify-center gap-2 text-lg shadow-md ${
                  pagoAprobado && (esRenovacionExpress || planoSeleccionado)
                    ? 'bg-blue-900 text-white hover:bg-blue-950 active:scale-[0.99] cursor-pointer' // Encendido si cumple AMBOS
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed opacity-80 shadow-none' // Apagado si falta alguno
                }`}
              >
                {loading ? 'Procesando expediente...' : 'Generar Expediente y Finalizar'} <ArrowRight className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}