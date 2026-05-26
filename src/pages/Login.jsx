import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
// ⚠️ SOLUCIÓN: Cambiamos CheckCircle2 por CheckCircle (Estable)
import { Building2, Search, CheckCircle, ArrowRight, RefreshCcw, Hammer } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const [ruc, setRuc] = useState('');
  const [empresaValidada, setEmpresaValidada] = useState(null);
  const [licenciaPrevia, setLicenciaPrevia] = useState(null);
  const [cambiosEstructurales, setCambiosEstructurales] = useState(null);
  
  const [error, setError] = useState('');
  const [buscandoSunat, setBuscandoSunat] = useState(false);
  const [ingresando, setIngresando] = useState(false);

  const handleConsultarRUC = async (e) => {
    e.preventDefault();
    setError('');
    setEmpresaValidada(null);
    setLicenciaPrevia(null);
    setCambiosEstructurales(null);

    if (!ruc || ruc.length !== 11) {
      setError('El RUC debe tener exactamente 11 dígitos numéricos.');
      return;
    }

    setBuscandoSunat(true);

    try {
      const token = "73aae707fbb5c6faea3a40fd8fbb260bb68b273b73e4c2d5b0be476832ee9d1b"; 
      const response = await fetch(`https://apiperu.dev/api/ruc/${ruc}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      // ⚠️ DEFENSA 2: Si la API devuelve un error HTML en vez de JSON, no explotará
      if (!response.ok) {
        throw new Error(`La API de consulta falló con estado: ${response.status}`);
      }

      let resData;
      try {
        resData = await response.json();
      } catch (parseError) {
        throw new Error('El servicio de SUNAT devolvió un formato inválido. Intente nuevamente.');
      }

      if (resData?.success && resData?.data) {
        setEmpresaValidada({
          ruc: resData.data.ruc || ruc,
          razonSocial: resData.data.nombre_o_razon_social || 'Razón Social No Disponible',
          domicilioFiscal: resData.data.direccion || 'Dirección No Disponible',
          estado: resData.data.estado || 'NO DEFINIDO',
          condicion: resData.data.condicion || 'NO DEFINIDO'
        });

        // Búsqueda en Supabase con defensa
        if (supabase) {
          const { data: empresaDb } = await supabase
            .from('empresas')
            .select(`id, expedientes(codigo, estado)`)
            .eq('ruc', resData.data.ruc || ruc)
            .maybeSingle();

          if (empresaDb?.expedientes && Array.isArray(empresaDb.expedientes)) {
            const aprobada = empresaDb.expedientes.find(exp => exp?.estado === 'Aprobado');
            if (aprobada) setLicenciaPrevia(aprobada); 
          }
        }
      } else {
        setError(resData?.message || 'RUC no encontrado o inactivo en el padrón.');
      }
    } catch (err) {
      console.error("Error capturado:", err);
      setError(err.message || 'Error de conexión. Verifique su internet o intente más tarde.');
    } finally {
      setBuscandoSunat(false);
    }
  };

  const handleSubmitFinal = async (e) => {
    e.preventDefault();
    if (!empresaValidada) return;
    
    if (licenciaPrevia && cambiosEstructurales === null) {
      setError('Debe indicar si su local ha sufrido modificaciones físicas.');
      return;
    }

    setIngresando(true);
    setError('');

    try {
      const { data: empresaDb, error: errEmpresa } = await supabase
        .from('empresas')
        .upsert({ 
          ruc: empresaValidada.ruc, 
          razon_social: empresaValidada.razonSocial,
          domicilio_fiscal: empresaValidada.domicilioFiscal 
        }, { onConflict: 'ruc' })
        .select()
        .single();

      if (errEmpresa) throw new Error("Error en base de datos: " + errEmpresa.message);

      const tipoTramite = (licenciaPrevia && cambiosEstructurales === false) ? 'renovacion_automatica' : 'nuevo';
      
      navigate('/solicitud', { 
        state: { 
          empresaId: empresaDb?.id, 
          tipoTramite: tipoTramite,
          razonSocial: empresaValidada?.razonSocial || 'Empresa'
        } 
      });

    } catch (err) {
      setError(err.message || 'Error interno al registrar los datos en el sistema.');
      console.error(err);
    } finally {
      setIngresando(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 p-4 font-sans">
      <div className="bg-white p-8 sm:p-10 rounded-2xl shadow-2xl w-full max-w-lg border-t-8 border-blue-900 transition-all duration-300">

        <div className="flex flex-col items-center mb-8 text-center">
          <div className="bg-blue-900 p-4 rounded-full mb-4 shadow-lg ring-4 ring-blue-50">
            <Building2 className="text-white w-10 h-10" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-800 tracking-tight text-center">Licencias de Funcionamiento</h2>
          <p className="text-slate-500 font-medium mt-1">Municipalidad Provincial de Trujillo</p>
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded mb-6 text-sm font-medium animate-pulse">
            {error}
          </div>
        )}

        <form onSubmit={handleConsultarRUC} className="mb-6">
          <label className="block text-sm font-bold text-slate-700 mb-2">Identificación del Negocio</label>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <input 
                type="text" 
                maxLength={11}
                value={ruc} 
                onChange={(e) => {
                  const valorSoloNumeros = e.target.value.replace(/\D/g, '');
                  if (valorSoloNumeros.length <= 11) {
                    setRuc(valorSoloNumeros);
                  }
                }} 
                required 
                disabled={empresaValidada !== null || buscandoSunat}
                className="w-full pl-4 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-900 focus:border-blue-900 disabled:bg-slate-100 disabled:text-slate-500 transition-all outline-none" 
                placeholder="Ingrese RUC (11 dígitos)"
              />
            </div>
            {!empresaValidada && (
              <button 
                type="submit" 
                disabled={buscandoSunat || ruc.length !== 11}
                className="bg-slate-800 text-white px-6 py-3 rounded-xl hover:bg-slate-900 transition-all flex items-center justify-center gap-2 disabled:opacity-70 font-semibold shadow-md"
              >
                {buscandoSunat ? 'Validando...' : <><Search className="w-5 h-5"/> SUNAT</>}
              </button>
            )}
          </div>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-200 text-center">
          <p className="text-sm text-slate-500 mb-2">¿Ya realizó su solicitud?</p>
          <Link 
            to="/seguimiento" 
            className="text-blue-900 font-bold hover:underline flex items-center justify-center gap-2 mx-auto w-fit"
          >
            <Search className="w-4 h-4" /> Consultar el estado de mi trámite
          </Link>
        </div>

        {empresaValidada && (
          <form onSubmit={handleSubmitFinal} className="space-y-5 animate-fade-in mt-6">
            <div className="bg-green-50 border border-green-300 p-5 rounded-xl mb-4 shadow-sm">
              <div className="flex items-center gap-2 mb-4 border-b border-green-200 pb-2">
                {/* ICONO SEGURO Y COMPATIBLE */}
                <CheckCircle className="text-green-700 w-5 h-5" />
                <p className="text-sm font-bold text-green-800">RUC Validado Exitosamente en SUNAT</p>
              </div>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-green-800 mb-1">Razón Social</label>
                  <input 
                    type="text" 
                    value={empresaValidada?.razonSocial || ''} 
                    disabled 
                    className="w-full p-2 bg-white border border-green-200 rounded text-sm text-slate-700 font-semibold cursor-not-allowed" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-green-800 mb-1">Domicilio Fiscal</label>
                  <input 
                    type="text" 
                    value={empresaValidada?.domicilioFiscal || ''} 
                    disabled 
                    className="w-full p-2 bg-white border border-green-200 rounded text-sm text-slate-700 font-semibold cursor-not-allowed" 
                  />
                </div>
                <div>
                  <p className="text-xs text-green-700 mt-1">Estado: <span className="font-bold">{empresaValidada?.estado || 'N/A'}</span> | Condición: <span className="font-bold">{empresaValidada?.condicion || 'N/A'}</span></p>
                </div>
              </div>
            </div>

            {licenciaPrevia && (
              <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 shadow-inner">
                <h3 className="font-bold text-blue-900 mb-2 flex items-center gap-2">
                  <RefreshCcw className="w-4 h-4" /> Renovación de Licencia Detectada
                </h3>
                <p className="text-xs text-blue-800 mb-3">
                  Su local ya cuenta con el expediente <strong>{licenciaPrevia?.codigo || 'Registrado'}</strong>. Para continuar, declare lo siguiente:
                </p>
                
                <div className="space-y-2">
                  <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ${cambiosEstructurales === false ? 'bg-white border-blue-600 shadow-sm' : 'border-blue-200 hover:bg-blue-100/50'}`}>
                    <input type="radio" name="cambios" checked={cambiosEstructurales === false} onChange={() => setCambiosEstructurales(false)} className="w-4 h-4 text-blue-600 focus:ring-blue-600" />
                    <div>
                      <p className="text-sm font-bold text-slate-700">Sin cambios estructurales</p>
                      <p className="text-xs text-slate-500">Renovación automática express</p>
                    </div>
                  </label>

                  <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ${cambiosEstructurales === true ? 'bg-white border-orange-500 shadow-sm' : 'border-blue-200 hover:bg-blue-100/50'}`}>
                    <input type="radio" name="cambios" checked={cambiosEstructurales === true} onChange={() => setCambiosEstructurales(true)} className="w-4 h-4 text-orange-500 focus:ring-orange-500" />
                    <div>
                      <p className="text-sm font-bold text-slate-700">Con modificaciones físicas</p>
                      <p className="text-xs text-slate-500 flex items-center gap-1"><Hammer className="w-3 h-3"/> Requiere nuevos planos e inspección</p>
                    </div>
                  </label>
                </div>
              </div>
            )}
            
            <div className="pt-2 flex flex-col sm:flex-row gap-3">
              <button 
                type="button" 
                onClick={() => { setEmpresaValidada(null); setRuc(''); setLicenciaPrevia(null); setCambiosEstructurales(null); }}
                className="px-4 py-3 border-2 border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 font-bold transition-all"
              >
                Cambiar RUC
              </button>
              <button 
                type="submit" 
                disabled={ingresando}
                className="flex-1 bg-blue-900 text-white font-bold py-3 px-4 rounded-xl hover:bg-blue-950 transition-all shadow-lg hover:shadow-xl disabled:opacity-70 flex items-center justify-center gap-2"
              >
                {ingresando ? 'Iniciando...' : 'Continuar Trámite'} <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </form>
        )}
      </div>

      <div className="mt-8 text-center animate-fade-in">
        <Link 
          to="/inspector"
          className="inline-block text-slate-400 hover:text-blue-900 text-sm font-semibold transition-colors border-b border-transparent hover:border-blue-900 pb-0.5"
        >
          Acceso Institucional
        </Link>
      </div>

    </div>
  );
}