import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { Building2, Search, CheckCircle2, ArrowRight } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const [ruc, setRuc] = useState('');
  const [empresaValidada, setEmpresaValidada] = useState(null);
  const [error, setError] = useState('');
  const [buscandoSunat, setBuscandoSunat] = useState(false);
  const [ingresando, setIngresando] = useState(false);

  // 1. Consulta a la API Real de SUNAT (Corregido y unificado)
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
      const token = "be1d3141d0ee425615d12760d06e97807b39ccacb0fdd4d4bb19e768ab7ba970"; 
      const response = await fetch(`https://apiperu.dev/api/ruc/${ruc}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const resData = await response.json();

      if (resData.success) {
        setEmpresaValidada({
          ruc: resData.data.ruc,
          razonSocial: resData.data.nombre_o_razon_social,
          domicilioFiscal: resData.data.direccion,
          estado: resData.data.estado,
          condicion: resData.data.condicion
        });
      } else {
        setError('RUC no encontrado en el padrón de SUNAT');
      }
    } catch (err) {
      console.error(err);
      setError('Error al conectar con los servidores de SUNAT.');
    } finally {
      setBuscandoSunat(false);
    }
  };

  // 2. Creación de Empresa y Expediente en Supabase
  const handleSubmitFinal = async (e) => {
    e.preventDefault();
    if (!empresaValidada) return;
    
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

      if (errEmpresa) throw new Error("Error al registrar empresa: " + errEmpresa.message);

      const numeroAleatorio = Math.floor(1000 + Math.random() * 9000);
      const codigoExp = `MPT-2026-${numeroAleatorio}`;

      const { error: errExpediente } = await supabase
        .from('expedientes')
        .insert([
          { 
            codigo: codigoExp,
            empresa_id: empresaDb.id,
            estado: 'Borrador',
            pago_realizado: false
          }
        ]);

      if (errExpediente) throw new Error("Error al crear expediente: " + errExpediente.message);

      localStorage.setItem('empresa_id', empresaDb.id);
      localStorage.setItem('expediente_actual', JSON.stringify({
        id: codigoExp,
        razon_social: empresaValidada.razonSocial
      }));

      navigate('/solicitud');

    } catch (err) {
      setError(err.message || 'Error interno al registrar la empresa en el sistema.');
      console.error(err);
    } finally {
      setIngresando(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 p-4 font-sans">
      <div className="bg-white p-8 sm:p-10 rounded-2xl shadow-2xl w-full max-w-lg border-t-8 border-mpt-blue transition-all duration-300">
        
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="bg-mpt-blue p-4 rounded-full mb-4 shadow-lg ring-4 ring-blue-50">
            <Building2 className="text-white w-10 h-10" />
          </div>
          <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">Mesa de Partes Virtual</h2>
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
                type="number" 
                value={ruc} 
                onChange={(e) => setRuc(e.target.value)} 
                required 
                disabled={empresaValidada !== null || buscandoSunat}
                className="w-full pl-4 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-mpt-blue focus:border-mpt-blue disabled:bg-slate-100 disabled:text-slate-500 transition-all outline-none" 
                placeholder="Ingrese RUC (11 dígitos)"
              />
            </div>
            {!empresaValidada && (
              <button 
                type="submit" 
                disabled={buscandoSunat}
                className="bg-slate-800 text-white px-6 py-3 rounded-xl hover:bg-slate-900 transition-all flex items-center justify-center gap-2 disabled:opacity-70 font-semibold shadow-md"
              >
                {buscandoSunat ? 'Validando...' : <><Search className="w-5 h-5"/> SUNAT</>}
              </button>
            )}
          </div>
        </form>

        {empresaValidada && (
          <form onSubmit={handleSubmitFinal} className="space-y-5 animate-fade-in">
            <div className="bg-green-50 border border-green-200 p-4 rounded-xl flex items-start gap-3 shadow-sm">
              <CheckCircle2 className="text-green-600 w-6 h-6 flex-shrink-0" />
              <div>
                <p className="text-sm font-bold text-green-800">RUC Validado Exitosamente</p>
                <p className="text-xs text-green-700 mt-0.5">Estado: <span className="font-bold">{empresaValidada.estado}</span> | Condición: <span className="font-bold">{empresaValidada.condicion}</span></p>
              </div>
            </div>

            <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Razón Social Obtenida</label>
                <input 
                  type="text" 
                  value={empresaValidada.razonSocial} 
                  readOnly 
                  className="w-full p-2.5 bg-transparent border-b border-slate-300 text-slate-800 font-bold focus:outline-none cursor-not-allowed" 
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Domicilio Fiscal Registrado</label>
                <textarea 
                  value={empresaValidada.domicilioFiscal} 
                  readOnly 
                  rows="2"
                  className="w-full p-2.5 bg-transparent border-b border-slate-300 text-slate-700 font-medium focus:outline-none cursor-not-allowed resize-none" 
                />
              </div>
            </div>
            
            <div className="pt-2 flex flex-col sm:flex-row gap-3">
              <button 
                type="button" 
                onClick={() => { setEmpresaValidada(null); setRuc(''); }}
                className="px-4 py-3 border-2 border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 font-bold transition-all"
              >
                Cambiar RUC
              </button>
              <button 
                type="submit" 
                disabled={ingresando}
                className="flex-1 bg-mpt-blue text-white font-bold py-3 px-4 rounded-xl hover:bg-blue-900 transition-all shadow-lg hover:shadow-xl disabled:opacity-70 flex items-center justify-center gap-2"
              >
                {ingresando ? 'Iniciando...' : 'Continuar Trámite'} <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </form>
        )}

        {!empresaValidada && (
          <div className="mt-8 pt-6 border-t border-slate-200 text-center">
            <p className="text-sm text-slate-500 mb-3 font-medium">¿Ya cuenta con un trámite en evaluación?</p>
            <button 
              onClick={() => navigate('/seguimiento')}
              className="w-full bg-white border-2 border-mpt-blue text-mpt-blue font-bold py-3 px-4 rounded-xl hover:bg-blue-50 transition-all flex items-center justify-center gap-2"
            >
              Consultar Estado de Expediente
            </button>
          </div>
        )}
      </div>
    </div>
  );
}