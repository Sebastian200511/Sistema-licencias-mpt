import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { Building2, Search, CheckCircle2 } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const [ruc, setRuc] = useState('');
  const [empresaValidada, setEmpresaValidada] = useState(null);
  const [error, setError] = useState('');
  const [buscandoSunat, setBuscandoSunat] = useState(false);
  const [ingresando, setIngresando] = useState(false);

  // CONSUMO DE API REAL (Directo a la v2 oficial sin proxy)
  const consultarAPI_SUNAT = async (numeroRuc) => {
    try {
      // 1. Tu llave de seguridad real de apis.net.pe
      const TU_TOKEN = 'sk_15825.U4NzHHB93F8EuzO9HISC5KLm4rNPWhxL'; 
      
      // 2. Apuntamos a la versión 2 (v2) que soporta peticiones directas desde React
      const urlAPI = `https://api.apis.net.pe/v2/sunat/ruc?numero=${numeroRuc}`;

      // 3. Petición HTTP directa enviando tu credencial
      const response = await fetch(urlAPI, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${TU_TOKEN}`
        }
      });

      if (!response.ok) {
        throw new Error('El RUC no existe en SUNAT o el Token ingresado es incorrecto.');
      }

      const data = await response.json();

      // Validación de regla de negocio (HU01)
      if (data.estado !== 'ACTIVO') {
        throw new Error(`El RUC se encuentra en estado: ${data.estado}. No apto para trámite.`);
      }

      // Mapeamos los datos de la v2 a nuestro sistema
      return {
        ruc: data.numeroDocumento,
        razonSocial: data.razonSocial, // En la v2 este campo se llama razonSocial
        domicilioFiscal: data.direccion || 'Dirección no especificada en el padrón',
        estado: data.estado,
        condicion: data.condicion
      };
    } catch (error) {
      throw new Error(error.message === 'Failed to fetch' 
        ? 'Error de conexión: Revisa tu conexión a internet o asegúrate de haber pegado bien tu Token.' 
        : error.message);
    }
  };

  const handleConsultarRUC = async (e) => {
    e.preventDefault();
    setError('');
    setEmpresaValidada(null);

    if (ruc.length !== 11) {
      setError('El RUC debe tener exactamente 11 dígitos numéricos.');
      return;
    }

    setBuscandoSunat(true);

    try {
      // 1. Consumir la "API de SUNAT"
      const datosSunat = await consultarAPI_SUNAT(ruc);
      setEmpresaValidada(datosSunat);
    } catch (err) {
      setError(err.message || 'Error al conectar con los servidores de SUNAT.');
    } finally {
      setBuscandoSunat(false);
    }
  };

  const handleSubmitFinal = async (e) => {
    e.preventDefault();
    if (!empresaValidada) return;
    
    setIngresando(true);
    setError('');

    try {
      // 2. Buscamos si la empresa ya existe en nuestra base de datos (Supabase)
      let { data: empresaBD, error: fetchError } = await supabase
        .from('empresas')
        .select('*')
        .eq('ruc', empresaValidada.ruc)
        .single();

      // 3. Si es la primera vez que entra, la guardamos en nuestra BD
      if (!empresaBD) {
        const { data: newEmpresa, error: insertError } = await supabase
          .from('empresas')
          .insert([{ 
            ruc: empresaValidada.ruc, 
            razon_social: empresaValidada.razonSocial, 
            domicilio_fiscal: empresaValidada.domicilioFiscal 
          }])
          .select()
          .single();
          
        if (insertError) throw insertError;
        empresaBD = newEmpresa;
      }

      // 4. Guardamos la sesión y pasamos a la HU02
      localStorage.setItem('empresa_id', empresaBD.id);
      navigate('/solicitud');

    } catch (err) {
      setError('Error interno al registrar la empresa en el sistema municipal.');
      console.error(err);
    } finally {
      setIngresando(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="bg-white p-8 rounded-xl shadow-xl w-full max-w-md border-t-4 border-blue-800">
        <div className="flex flex-col items-center mb-6 text-center">
          <div className="bg-blue-900 p-3 rounded-full mb-3 shadow-md">
            <Building2 className="text-white w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800">Mesa de Partes Virtual</h2>
          <p className="text-gray-500 text-sm mt-1">Municipalidad Provincial de Trujillo</p>
        </div>

        {error && <div className="bg-red-100 text-red-700 p-3 rounded mb-4 text-sm font-medium border border-red-200">{error}</div>}

        {/* Formulario 1: Consulta a SUNAT */}
        <form onSubmit={handleConsultarRUC} className="mb-6">
          <label className="block text-sm font-bold text-gray-700 mb-1">RUC de la Empresa</label>
          <div className="flex gap-2">
            <input 
              type="number" 
              value={ruc} 
              onChange={(e) => setRuc(e.target.value)} 
              required 
              disabled={empresaValidada !== null || buscandoSunat}
              className="flex-1 p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-800 focus:border-blue-800 disabled:bg-gray-100 disabled:text-gray-500" 
              placeholder="Ingrese los 11 dígitos"
            />
            {!empresaValidada && (
              <button 
                type="submit" 
                disabled={buscandoSunat}
                className="bg-slate-800 text-white px-4 py-2 rounded-lg hover:bg-slate-900 transition flex items-center gap-2 disabled:opacity-70"
              >
                {buscandoSunat ? 'Consultando...' : <><Search className="w-4 h-4"/> SUNAT</>}
              </button>
            )}
          </div>
        </form>

        {/* Datos autocompletados (Solo de lectura) */}
        {empresaValidada && (
          <form onSubmit={handleSubmitFinal} className="space-y-4 animate-fade-in">
            <div className="bg-green-50 border border-green-200 p-3 rounded-lg flex items-start gap-3 mb-4">
              <CheckCircle2 className="text-green-600 w-5 h-5 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-bold text-green-800">RUC Validado Correctamente</p>
                <p className="text-xs text-green-700">Estado: {empresaValidada.estado} | Condición: {empresaValidada.condicion}</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase">Razón Social Obtenida</label>
              <input 
                type="text" 
                value={empresaValidada.razonSocial} 
                readOnly 
                className="mt-1 w-full p-2.5 bg-gray-100 border border-gray-200 rounded-lg text-gray-700 font-medium cursor-not-allowed" 
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase">Domicilio Fiscal Obtenido</label>
              <input 
                type="text" 
                value={empresaValidada.domicilioFiscal} 
                readOnly 
                className="mt-1 w-full p-2.5 bg-gray-100 border border-gray-200 rounded-lg text-gray-700 font-medium cursor-not-allowed" 
              />
            </div>
            
            <div className="pt-4 flex gap-3">
              <button 
                type="button" 
                onClick={() => { setEmpresaValidada(null); setRuc(''); }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition"
              >
                Cambiar RUC
              </button>
              <button 
                type="submit" 
                disabled={ingresando}
                className="flex-1 bg-blue-700 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-800 transition shadow-md disabled:opacity-70"
              >
                {ingresando ? 'Iniciando Trámite...' : 'Continuar Solicitud'}
              </button>
            </div>
          </form>
        )}

        {/* Enlace al Seguimiento (HU09) */}
        {!empresaValidada && (
          <div className="mt-8 pt-6 border-t border-gray-200 text-center">
            <p className="text-sm text-gray-600 mb-3">¿Ya tiene un trámite en curso?</p>
            <button 
              onClick={() => navigate('/seguimiento')}
              className="w-full bg-white border-2 border-blue-800 text-blue-900 font-bold py-2.5 px-4 rounded-lg hover:bg-blue-50 transition"
            >
              Consultar Estado de Expediente
            </button>
          </div>
        )}
      </div>
    </div>
  );
}