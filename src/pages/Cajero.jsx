import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { UserCircle, Search, CheckCircle, Upload, ArrowRight, Building2, Calendar, FileText, RefreshCw, LogOut } from 'lucide-react';

export default function Cajero() {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const [ruc, setRuc] = useState('');
  const [empresaValidada, setEmpresaValidada] = useState(null);
  const [licenciaPrevia, setLicenciaPrevia] = useState(null);
  const [buscandoSunat, setBuscandoSunat] = useState(false);
  const [esRenovacionExpress, setEsRenovacionExpress] = useState(false);
  
  const [planoSeleccionado, setPlanoSeleccionado] = useState(null);
  const [fileObject, setFileObject] = useState(null);
  const [resultadoTramite, setResultadoTramite] = useState(null);

  useEffect(() => {
    if (localStorage.getItem('inst_session') === 'true' && localStorage.getItem('inst_role') === 'Cajero') {
      setIsAuthenticated(true);
    } else {
      navigate('/institucional');
    }
  }, [navigate]);


  const handleLogout = () => {
    localStorage.clear();
    setIsAuthenticated(false);
    navigate('/institucional');
    resetForm();
  };

  const resetForm = () => {
    setRuc('');
    setEmpresaValidada(null);
    setLicenciaPrevia(null);
    setEsRenovacionExpress(false);
    setPlanoSeleccionado(null);
    setFileObject(null);
    setResultadoTramite(null);
    setError('');
  };

  const handleConsultarRUC = async (e) => {
    e.preventDefault();
    setError('');
    setEmpresaValidada(null);
    setLicenciaPrevia(null);
    setEsRenovacionExpress(false);

    if (!ruc || ruc.length !== 11) {
      setError('El RUC debe tener exactamente 11 dígitos.');
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

      if (!response.ok) throw new Error('RUC no encontrado en SUNAT.');

      const resData = await response.json();

      if (resData?.success && resData?.data) {
        const calle = resData.data.direccion || '';
        const distrito = resData.data.distrito || '';
        const provincia = resData.data.provincia || '';
        const departamento = resData.data.departamento || '';
        
        const ubicacionCompleta = `${calle} ${distrito} ${provincia} ${departamento}`.toUpperCase();
        if (!ubicacionCompleta.includes('TRUJILLO')) {
          setError('El domicilio fiscal no pertenece a Trujillo.');
          setBuscandoSunat(false);
          return;
        }

        const direccionMostrar = `${calle}${distrito ? ', ' + distrito : ''}${provincia ? ' - ' + provincia : ''}`;

        setEmpresaValidada({
          ruc: resData.data.ruc || ruc,
          razonSocial: resData.data.nombre_o_razon_social || 'Desconocida',
          domicilioFiscal: direccionMostrar || 'Desconocida'
        });

        const { data: empresaDb } = await supabase
          .from('empresas')
          .select(`id, expedientes(codigo, estado)`)
          .eq('ruc', resData.data.ruc || ruc)
          .maybeSingle();

        if (empresaDb?.expedientes) {
          const aprobada = empresaDb.expedientes.find(exp => exp?.estado === 'Aprobado');
          if (aprobada) setLicenciaPrevia(aprobada); 
        }

      } else {
        setError(resData?.message || 'RUC inválido.');
      }
    } catch (err) {
      setError(err.message || 'Error de conexión.');
    } finally {
      setBuscandoSunat(false);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files.length > 0) {
      const file = e.target.files[0];
      setPlanoSeleccionado(file.name);
      setFileObject(file);
    }
  };

  const procesarTramiteCaja = async () => {
    setError('');
    setLoading(true);

    if (!esRenovacionExpress && !fileObject) {
      setError('Debe adjuntar el plano estructural para un trámite nuevo.');
      setLoading(false);
      return;
    }

    try {
      // 1. Guardar/Actualizar Empresa
      const { data: empresaDb, error: errEmpresa } = await supabase
        .from('empresas')
        .upsert({ 
          ruc: empresaValidada.ruc, 
          razon_social: empresaValidada.razonSocial,
          domicilio_fiscal: empresaValidada.domicilioFiscal 
        }, { onConflict: 'ruc' })
        .select()
        .single();

      if (errEmpresa) throw errEmpresa;

      // 2. Subir Plano si aplica
      let planoPublicUrl = 'No requiere (Renovación)';
      if (!esRenovacionExpress && fileObject) {
        const fileExt = fileObject.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.floor(Math.random() * 1000)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage.from('planos').upload(fileName, fileObject);
        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from('planos').getPublicUrl(fileName);
        planoPublicUrl = urlData.publicUrl;
      }

      // 3. Crear Expediente (Ya pagado)
      const numeroAleatorio = Math.floor(1000 + Math.random() * 9000);
      const codigoExpediente = `MPT-2026-${numeroAleatorio}`;
      const estadoInicial = esRenovacionExpress ? 'Aprobado' : 'Pendiente';

      const { data: expData, error: insertError } = await supabase
        .from('expedientes')
        .insert([{ 
          codigo: codigoExpediente, 
          empresa_id: empresaDb.id, 
          plano_url: planoPublicUrl, 
          pago_realizado: true, // Cajero confirma pago
          estado: estadoInicial 
        }])
        .select().single();

      if (insertError) throw insertError;

      // 4. Programar Inspección (Para el mismo día o al día siguiente)
      let fechaVisitaStr = null;
      if (!esRenovacionExpress) {
        const fechaVisita = new Date();
        // Programación inmediata (hoy)
        fechaVisitaStr = fechaVisita.toISOString().split('T')[0];

        const { error: inspError } = await supabase.from('inspecciones')
          .insert([{ 
            expediente_id: expData.id, 
            fecha_programada: fechaVisitaStr, 
            estado: 'Programada' 
          }]);

        if (inspError) throw inspError;
      }

      setResultadoTramite({ codigo: codigoExpediente, esExpress: esRenovacionExpress, fechaVisita: fechaVisitaStr });

    } catch (err) {
      setError('Error al procesar el trámite en base de datos: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      <header className="bg-teal-900 text-white py-4 px-6 flex justify-between items-center shadow-md">
        <div>
          <h1 className="text-lg font-bold flex items-center gap-2">
            <Building2 className="w-5 h-5" /> Atención Presencial - Licencias
          </h1>
        </div>
        <button onClick={handleLogout} className="flex items-center gap-1 bg-teal-800 hover:bg-red-700 px-3 py-1.5 rounded text-xs font-semibold transition">
          <LogOut className="w-4 h-4" /> Cerrar Turno
        </button>
      </header>

      <main className="max-w-3xl mx-auto mt-8 p-4">
        
        {resultadoTramite ? (
          <div className="bg-white p-8 rounded-xl shadow-xl text-center border-t-4 border-teal-500">
             <div className="flex justify-center mb-4"><CheckCircle className="text-teal-600 w-16 h-16" /></div>
             <h2 className="text-2xl font-bold text-gray-800">Pago Registrado y Trámite Generado</h2>
             <div className="bg-slate-100 p-4 rounded-lg my-6 border">
               <span className="text-xs text-slate-500 font-bold uppercase">Código de Expediente</span>
               <p className="text-4xl font-mono font-bold text-teal-900 mt-2">{resultadoTramite.codigo}</p>
             </div>
             
             {resultadoTramite.esExpress ? (
                <div className="bg-green-50 text-green-800 p-4 rounded-lg mb-6 border border-green-200">
                  <p className="font-bold">Renovación Automática Aprobada</p>
                  <p className="text-sm">Indique al ciudadano que puede descargar su licencia renovada en el portal virtual usando su código.</p>
                </div>
              ) : (
                <div className="bg-blue-50 text-blue-800 p-4 rounded-lg mb-6 border border-blue-200">
                  <p className="font-bold flex items-center justify-center gap-2 mb-1"><Calendar className="w-4 h-4"/> Inspección Programada Inmediata</p>
                  <p className="text-sm">El inspector visitará el local el: <strong>{resultadoTramite.fechaVisita}</strong></p>
                </div>
              )}

              <button onClick={resetForm} className="bg-teal-700 text-white font-bold py-2 px-6 rounded hover:bg-teal-800 transition">
                Atender Siguiente Ciudadano
              </button>
          </div>
        ) : (
          <div className="bg-white p-6 rounded-xl shadow-md border border-slate-200">
            <h2 className="text-xl font-bold text-slate-800 mb-6 border-b pb-2">Registro de Solicitud</h2>
            
            {error && <div className="bg-red-100 text-red-700 p-3 rounded mb-4 text-sm font-semibold">{error}</div>}

            <form onSubmit={handleConsultarRUC} className="mb-6 flex gap-3">
              <input 
                type="text" maxLength={11} required value={ruc} 
                onChange={(e) => setRuc(e.target.value.replace(/\D/g, ''))}
                disabled={empresaValidada !== null || buscandoSunat}
                className="flex-1 p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-600 outline-none disabled:bg-slate-100"
                placeholder="RUC del ciudadano"
              />
              {!empresaValidada && (
                <button type="submit" disabled={buscandoSunat || ruc.length !== 11} className="bg-slate-800 text-white px-6 rounded-lg font-bold hover:bg-slate-900 disabled:opacity-50">
                  {buscandoSunat ? 'Buscando...' : 'Buscar'}
                </button>
              )}
            </form>

            {empresaValidada && (
              <div className="animate-fade-in space-y-6">
                <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
                  <p className="text-xs text-green-700 font-bold uppercase">Datos Validados (SUNAT)</p>
                  <p className="font-bold text-slate-800 mt-1">{empresaValidada.razonSocial}</p>
                  <p className="text-sm text-slate-600">{empresaValidada.domicilioFiscal}</p>
                </div>

                {licenciaPrevia && (
                  <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                    <p className="font-bold text-yellow-800 mb-2">Renovación Disponible</p>
                    <label className="flex items-center gap-2 cursor-pointer bg-white p-3 border rounded shadow-sm">
                      <input type="checkbox" checked={esRenovacionExpress} onChange={(e) => setEsRenovacionExpress(e.target.checked)} className="w-5 h-5 text-teal-600" />
                      <span className="font-medium text-slate-700">El ciudadano declara no haber realizado cambios estructurales (Renovación Express)</span>
                    </label>
                  </div>
                )}

                {!esRenovacionExpress && (
                  <div className="border-2 border-dashed border-slate-300 p-6 rounded-lg text-center bg-slate-50">
                    <FileText className="mx-auto text-slate-400 w-10 h-10 mb-2" />
                    <label className="cursor-pointer">
                      <span className="bg-teal-100 text-teal-800 px-4 py-2 rounded font-bold text-sm hover:bg-teal-200 transition">Subir PDF del Plano</span>
                      <input type="file" accept=".pdf" onChange={handleFileChange} className="hidden" />
                    </label>
                    {planoSeleccionado && <p className="mt-3 text-sm text-teal-700 font-bold">✓ {planoSeleccionado}</p>}
                  </div>
                )}

                <div className="bg-slate-800 p-4 rounded-lg text-white flex justify-between items-center">
                   <div>
                     <p className="font-bold">Pago en Caja Municipal</p>
                     <p className="text-xs text-slate-300">Tasa administrativa por Licencia</p>
                   </div>
                   <p className="text-2xl font-bold font-mono">S/ 180.00</p>
                </div>

                <div className="flex gap-3">
                  <button onClick={resetForm} type="button" className="px-4 py-3 border border-slate-300 text-slate-600 rounded-lg font-bold hover:bg-slate-100">
                    Cancelar
                  </button>
                  <button 
                    onClick={procesarTramiteCaja}
                    disabled={loading || (!esRenovacionExpress && !fileObject)}
                    className="flex-1 bg-teal-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-teal-700 transition flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loading ? 'Procesando...' : 'Confirmar Pago y Generar Expediente'} <CheckCircle className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
