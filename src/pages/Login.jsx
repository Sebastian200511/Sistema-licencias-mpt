import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Building2, Search, CheckCircle, ArrowRight, RefreshCcw, Hammer } from 'lucide-react';
import { apiPeruService } from '../services/apiPeruService';
import { expedientesService } from '../services/expedientesService';
import { supabase } from '../supabaseClient';

export default function Login() {
  const navigate = useNavigate();
  const [ruc, setRuc] = useState('');
  const [empresaValidada, setEmpresaValidada] = useState(null);
  const [licenciaPrevia, setLicenciaPrevia] = useState(null);
  const [cambiosEstructurales, setCambiosEstructurales] = useState(null);
  const [emailContacto, setEmailContacto] = useState('');
  
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
      const data = await apiPeruService.consultarRuc(ruc);

      const calle = data.direccion || '';
      const distrito = data.distrito || '';
      const provincia = data.provincia || '';
      const departamento = data.departamento || '';
      
      const ubicacionCompleta = `${calle} ${distrito} ${provincia} ${departamento}`.toUpperCase();
      const esDeTrujillo = ubicacionCompleta.includes('TRUJILLO');

      if (!esDeTrujillo) {
        setError('Operación rechazada: El domicilio fiscal de este negocio no pertenece a la jurisdicción de Trujillo.');
        setBuscandoSunat(false);
        return; 
      }

      // Validar que no tenga tramite activo o licencia vigente antes de continuar
      const verificacion = await expedientesService.verificarTramiteActivo(data.ruc || ruc);
      if (verificacion.tieneTramite) {
        setError(verificacion.mensaje);
        setBuscandoSunat(false);
        return;
      }

      const direccionMostrar = `${calle}${distrito ? ', ' + distrito : ''}${provincia ? ' - ' + provincia : ''}`;

      setEmpresaValidada({
        ruc: data.ruc || ruc,
        razonSocial: data.nombre_o_razon_social || 'Razón Social No Disponible',
        domicilioFiscal: direccionMostrar || 'Dirección No Disponible',
        estado: data.estado || data.estado_del_contribuyente || 'NO DEFINIDO',
        condicion: data.condicion || data.condicion_de_domicilio || 'NO DEFINIDO'
      });

      const empresaDb = await expedientesService.obtenerEmpresaPorRuc(data.ruc || ruc);

      if (empresaDb?.expedientes && Array.isArray(empresaDb.expedientes)) {
        const vencida = empresaDb.expedientes.find(exp => exp?.estado === 'Vencido');
        if (vencida) {
          setError(`El RUC ingresado cuenta con una licencia VENCIDA (Código: ${vencida.codigo}). Por favor, utilice la opción "Consultar el estado de mi trámite" que está arriba para ingresar a su panel y solicitar la Renovación.`);
          setEmpresaValidada(null);
          setBuscandoSunat(false);
          return;
        }
        
        const aprobada = empresaDb.expedientes.find(exp => exp?.estado === 'Aprobado');
        if (aprobada) setLicenciaPrevia(aprobada); 
      }

    } catch (err) {
      setError(err.message || 'Error al validar el RUC.');
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
      const verificacion = await expedientesService.verificarTramiteActivo(empresaValidada.ruc);
      if (verificacion.tieneTramite) {
        setError(verificacion.mensaje);
        setIngresando(false);
        return;
      }

      const { data: empresaDb, error: errEmpresa } = await supabase
        .from('empresas')
        .upsert({ 
          ruc: empresaValidada.ruc, 
          razon_social: empresaValidada.razonSocial,
          domicilio_fiscal: empresaValidada.domicilioFiscal,
          email_contacto: emailContacto
        }, { onConflict: 'ruc' })
        .select()
        .single();

      if (errEmpresa) throw new Error("Error en base de datos: " + errEmpresa.message);

      const tipoTramite = (licenciaPrevia && cambiosEstructurales === false) ? 'renovacion_automatica' : 'nuevo';
      
      navigate('/solicitud', { 
        state: { 
          empresaId: empresaDb?.id, 
          tipoTramite: tipoTramite,
          razonSocial: empresaValidada?.razonSocial || 'Empresa',
          emailContacto: emailContacto
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
            {/* 🛡️ DEFENSA APLICADA: Envolvemos el texto de error en span */}
            <span>{error}</span>
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
                  setError('');
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
                className="bg-slate-800 text-white px-6 py-3 rounded-xl hover:bg-slate-900 transition-all flex items-center justify-center gap-2 disabled:opacity-70 font-semibold shadow-md min-w-[140px]"
              >
                {/* 🛡️ DEFENSA APLICADA: Envolvemos los textos condicionales en span */}
                {buscandoSunat ? <span>Validando...</span> : <div className="flex items-center gap-2"><Search className="w-5 h-5"/> <span>SUNAT</span></div>}
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
            <Search className="w-4 h-4" /> <span>Consultar el estado de mi trámite</span>
          </Link>
        </div>

        {empresaValidada && (
          <form onSubmit={handleSubmitFinal} className="space-y-5 animate-fade-in mt-6">
            <div className="bg-green-50 border border-green-300 p-5 rounded-xl mb-4 shadow-sm">
              <div className="flex items-center gap-2 mb-4 border-b border-green-200 pb-2">
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

            <div className="bg-white border border-slate-200 p-5 rounded-xl mb-4 shadow-sm">
              <label className="block text-sm font-bold text-slate-700 mb-2">Correo Electrónico (Notificaciones)</label>
              <input 
                type="email" 
                required
                value={emailContacto}
                onChange={(e) => setEmailContacto(e.target.value)}
                className="w-full pl-4 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-900 focus:border-blue-900 transition-all outline-none" 
                placeholder="ejemplo@empresa.com"
              />
              <p className="text-xs text-slate-500 mt-2">A este correo llegarán las credenciales de seguimiento y fechas de inspección.</p>
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
                {/* 🛡️ DEFENSA APLICADA: Textos envueltos en span */}
                {ingresando ? <span>Iniciando...</span> : <div className="flex items-center gap-2"><span>Continuar Trámite</span> <ArrowRight className="w-5 h-5" /></div>}
              </button>
            </div>
          </form>
        )}
      </div>

      <div className="mt-8 text-center animate-fade-in flex flex-col items-center justify-center">
        <Link 
          to="/institucional"
          className="inline-block text-slate-400 hover:text-slate-700 text-sm font-semibold transition-colors border-b border-transparent hover:border-slate-700 pb-0.5"
        >
          <span>Acceso Institucional</span>
        </Link>
      </div>
    </div>
  );
}