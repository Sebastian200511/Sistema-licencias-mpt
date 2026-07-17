import { useState, useEffect } from 'react';
import { Search, CheckCircle, Upload, ArrowRight, Building2, Calendar, FileText, RefreshCw, Lock, DollarSign, LogOut } from 'lucide-react';
import { apiPeruService } from '../services/apiPeruService';
import { expedientesService } from '../services/expedientesService';
import { cajaService } from '../services/cajaService';
import Alert from '../components/Alert';
import Button from '../components/Button';

export default function Cajero() {
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

  // Módulo de Caja
  const [sesionCaja, setSesionCaja] = useState(null);
  const [montoInicial, setMontoInicial] = useState('');
  const [modalVuelto, setModalVuelto] = useState(false);
  const [efectivoRecibido, setEfectivoRecibido] = useState('');
  const [modalCierre, setModalCierre] = useState(false);
  const [montoFisicoCierre, setMontoFisicoCierre] = useState('');
  const [cajaCerradaResult, setCajaCerradaResult] = useState(null);
  const TARIFA = 3.00;

  useEffect(() => {
    cargarCaja();
  }, []);

  const cargarCaja = async () => {
    try {
      const caja = await cajaService.obtenerCajaAbierta();
      setSesionCaja(caja);
    } catch (err) {
      console.error(err);
    }
  };

  const abrirCaja = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const caja = await cajaService.abrirCaja(montoInicial);
      setSesionCaja(caja);
    } catch (err) {
      setError('Error al abrir caja: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const cerrarCaja = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const totalEsperado = sesionCaja.monto_inicial + 0; // Se ajustaría con BD si es necesario
      const caja = await cajaService.cerrarCaja(sesionCaja.id, totalEsperado, montoFisicoCierre);
      setSesionCaja(null);
      setCajaCerradaResult(caja);
      setModalCierre(false);
    } catch (err) {
      setError('Error al cerrar caja: ' + err.message);
    } finally {
      setLoading(false);
    }
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
      const data = await apiPeruService.consultarRuc(ruc);
      
      const calle = data.direccion || '';
      const distrito = data.distrito || '';
      const provincia = data.provincia || '';
      const departamento = data.departamento || '';
        
      const ubicacionCompleta = `${calle} ${distrito} ${provincia} ${departamento}`.toUpperCase();
      if (!ubicacionCompleta.includes('TRUJILLO')) {
        setError('El domicilio fiscal no pertenece a Trujillo.');
        setBuscandoSunat(false);
        return;
      }

      const direccionMostrar = `${calle}${distrito ? ', ' + distrito : ''}${provincia ? ' - ' + provincia : ''}`;

      setEmpresaValidada({
        ruc: data.ruc || ruc,
        razonSocial: data.nombre_o_razon_social || 'Desconocida',
        domicilioFiscal: direccionMostrar || 'Desconocida'
      });

      const empresaDb = await expedientesService.obtenerEmpresaPorRuc(data.ruc || ruc);
      if (empresaDb?.expedientes) {
        const aprobada = empresaDb.expedientes.find(exp => exp?.estado === 'Aprobado');
        if (aprobada) setLicenciaPrevia(aprobada); 
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

  const registrarTramitePresencial = async () => {
    setError('');
    setLoading(true);

    if (!esRenovacionExpress && !fileObject) {
      setError('Debe adjuntar el plano estructural para un trámite nuevo.');
      setLoading(false);
      return;
    }

    try {
      const empresaDb = await expedientesService.guardarEmpresa({
        ruc: empresaValidada.ruc,
        razonSocial: empresaValidada.razonSocial,
        domicilioFiscal: empresaValidada.domicilioFiscal
      });

      const numeroAleatorio = Math.floor(1000 + Math.random() * 9000);
      const codigoExpediente = `MPT-2026-${numeroAleatorio}`;

      let planoPublicUrl = 'No requiere (Renovación)';
      if (!esRenovacionExpress && fileObject) {
        planoPublicUrl = await expedientesService.subirPlanoSubsanacion(codigoExpediente, fileObject);
      }

      const resultado = await expedientesService.crearExpediente({
        codigo: codigoExpediente,
        empresa_id: empresaDb.id,
        plano_url: planoPublicUrl,
        pago_realizado: true,
        monto_pagado: TARIFA,
        estado: esRenovacionExpress ? 'Aprobado' : 'Pendiente'
      });

      if (!esRenovacionExpress) {
        await expedientesService.crearInspeccion({
          expediente_id: resultado.id,
          fecha_programada: new Date().toISOString().split('T')[0],
          estado: 'Programada'
        });
      }

      setResultadoTramite({ 
        codigo: resultado.codigo, 
        esExpress: esRenovacionExpress, 
        fechaVisita: !esRenovacionExpress ? new Date().toISOString().split('T')[0] : null 
      });

    } catch (err) {
      setError('Error al procesar el trámite en base de datos: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-50 relative">
      {cajaCerradaResult && (
        <div className="bg-white p-8 rounded-xl shadow-xl text-center border-t-4 border-slate-800 mb-6">
          <LogOut className="mx-auto w-16 h-16 text-slate-800 mb-4" />
          <h2 className="text-2xl font-bold">Turno Cerrado Correctamente</h2>
          <p className="mt-2 text-slate-600">Sistema: S/ {cajaCerradaResult.monto_calculado} | Físico: S/ {cajaCerradaResult.monto_fisico}</p>
          <Button onClick={() => setCajaCerradaResult(null)} variant="outline" className="mt-4">Nueva Sesión</Button>
        </div>
      )}

      {!sesionCaja && !cajaCerradaResult ? (
        <div className="bg-white p-8 rounded-xl shadow-xl max-w-md mx-auto mt-10 border border-slate-200 text-center">
          <DollarSign className="mx-auto w-16 h-16 text-teal-600 mb-4" />
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Apertura de Caja</h2>
          <p className="text-slate-600 mb-6 text-sm">Debe registrar su "sencillo" (Monto Inicial) para comenzar a cobrar trámites físicos.</p>
          {error && <Alert type="error" message={error} />}
          <form onSubmit={abrirCaja} className="space-y-4">
            <input 
              type="number" step="0.01" min="0" required 
              value={montoInicial} onChange={(e) => setMontoInicial(e.target.value)}
              placeholder="Ej: 50.00"
              className="w-full p-3 border border-slate-300 rounded-lg text-center text-xl font-bold"
            />
            <Button type="submit" isLoading={loading} className="w-full">
              Abrir Caja
            </Button>
          </form>
        </div>
      ) : sesionCaja ? (
        <>
          <div className="flex justify-between items-center mb-6 bg-white p-4 rounded-lg shadow-sm border border-slate-200">
            <div>
              <p className="font-bold text-slate-800 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" /> Caja Abierta
              </p>
              <p className="text-xs text-slate-500">Monto Inicial: S/ {sesionCaja.monto_inicial.toFixed(2)}</p>
            </div>
            <Button variant="danger" onClick={() => setModalCierre(true)} className="px-4 py-2 text-sm">
              Cuadrar y Cerrar
            </Button>
          </div>
          
          {modalCierre && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full">
                <h3 className="text-xl font-bold mb-4">Cierre de Caja</h3>
                <form onSubmit={cerrarCaja}>
                  <label className="block text-sm font-bold text-slate-700 mb-2">¿Cuánto dinero físico tiene en la caja?</label>
                  <input type="number" step="0.01" min="0" required value={montoFisicoCierre} onChange={e => setMontoFisicoCierre(e.target.value)} className="w-full p-3 border rounded-lg text-xl mb-4 font-bold" />
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" className="flex-1" onClick={() => setModalCierre(false)}>Cancelar</Button>
                    <Button type="submit" variant="danger" className="flex-1" isLoading={loading}>Confirmar</Button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {modalVuelto && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full text-center">
                <h3 className="text-xl font-bold text-slate-800 mb-2">Calculadora de Vuelto</h3>
                <div className="bg-slate-100 p-3 rounded-lg mb-4">
                  <span className="text-sm text-slate-500">Monto a Cobrar</span>
                  <p className="text-3xl font-black text-slate-800">S/ {TARIFA.toFixed(2)}</p>
                </div>
                
                <div className="text-left mb-4">
                  <label className="text-sm font-bold text-slate-700 block mb-1">Efectivo Recibido</label>
                  <input 
                    type="number" step="0.01" min={TARIFA} required 
                    value={efectivoRecibido} 
                    onChange={e => setEfectivoRecibido(e.target.value)}
                    className="w-full p-3 border border-slate-300 rounded-lg text-xl font-bold"
                  />
                </div>

                {efectivoRecibido && Number(efectivoRecibido) >= TARIFA && (
                  <div className="bg-green-100 border border-green-300 p-3 rounded-lg mb-6">
                    <span className="text-sm text-green-800 font-bold">Vuelto a Entregar</span>
                    <p className="text-4xl font-black text-green-700">S/ {(Number(efectivoRecibido) - TARIFA).toFixed(2)}</p>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setModalVuelto(false)}>Atrás</Button>
                  <Button 
                    type="button" 
                    variant="success" 
                    className="flex-1" 
                    disabled={!efectivoRecibido || Number(efectivoRecibido) < TARIFA}
                    onClick={() => {
                      setModalVuelto(false);
                      registrarTramitePresencial();
                    }}
                  >
                    Confirmar Pago
                  </Button>
                </div>
              </div>
            </div>
          )}
        
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

              <Button onClick={resetForm} variant="outline" className="mt-6 w-auto px-8 mx-auto">
              Registrar Siguiente Trámite
            </Button>
          </div>
        ) : (
          <div className="bg-white p-6 rounded-xl shadow-md border border-slate-200">
            <h2 className="text-xl font-bold text-slate-800 mb-6 border-b pb-2">Registro de Solicitud</h2>
            
            {error && <Alert type="error" message={error} />}

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
                   <p className="text-2xl font-bold font-mono">S/ {TARIFA.toFixed(2)}</p>
                </div>

                <div className="flex gap-3">
                  <button onClick={resetForm} type="button" className="px-4 py-3 border border-slate-300 text-slate-600 rounded-lg font-bold hover:bg-slate-100">
                    Cancelar
                  </button>
                  <Button 
                  onClick={() => setModalVuelto(true)} 
                  isLoading={loading}
                  disabled={(!esRenovacionExpress && !fileObject) || !empresaValidada.ruc}
                  variant="primary"
                >
                  <CheckCircle className="w-5 h-5" /> Completar Pago y Trámite
                </Button>
                </div>
              </div>
            )}
          </div>
        )}
        </>
      ) : null}
    </div>
  );
}
