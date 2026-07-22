import { useState, useEffect, useCallback } from 'react';
import { CheckCircle, Calendar, FileText, DollarSign, LogOut, Printer, Smartphone, Banknote, History, Mail } from 'lucide-react';
import { apiPeruService } from '../services/apiPeruService';
import { expedientesService } from '../services/expedientesService';
import { cajaService } from '../services/cajaService';
import { pdfGenerator } from '../utils/pdfGenerator';
import Alert from '../components/Alert';
import Button from '../components/Button';

export default function Cajero() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [tabActual, setTabActual] = useState('ventanilla');
  const [egresos, setEgresos] = useState([]);
  const [modalEgreso, setModalEgreso] = useState(false);
  const [egresoMotivo, setEgresoMotivo] = useState('');
  const [egresoMonto, setEgresoMonto] = useState(''); // 'ventanilla' | 'historial'
  const [misCierres, setMisCierres] = useState([]);
  
  const [ruc, setRuc] = useState('');
  const [empresaValidada, setEmpresaValidada] = useState(null);
  const [licenciaPrevia, setLicenciaPrevia] = useState(null);
  const [buscandoSunat, setBuscandoSunat] = useState(false);
  const [esRenovacionExpress, setEsRenovacionExpress] = useState(false);
  
  const [sucursales, setSucursales] = useState([]);
  const [direccionEditada, setDireccionEditada] = useState('');
  const [isDireccionEditable, setIsDireccionEditable] = useState(false);
  
  const [planoSeleccionado, setPlanoSeleccionado] = useState(null);
  const [fileObject, setFileObject] = useState(null);
  const [resultadoTramite, setResultadoTramite] = useState(null);
  const [emailContacto, setEmailContacto] = useState('');
  const [tipoComprobante, setTipoComprobante] = useState('Boleta');

  // Módulo de Caja
  const [sesionCaja, setSesionCaja] = useState(null);
  const [montoInicial, setMontoInicial] = useState('');
  const [modalVuelto, setModalVuelto] = useState(false);
  const [efectivoRecibido, setEfectivoRecibido] = useState('');
  const [modalCierre, setModalCierre] = useState(false);
  const [montoFisicoCierre, setMontoFisicoCierre] = useState('');
  const [cajaCerradaResult, setCajaCerradaResult] = useState(null);
  const [metodoPago, setMetodoPago] = useState('Efectivo');
  const [historial, setHistorial] = useState([]);
  const [resumenCierre, setResumenCierre] = useState(null);
  const [tarifa, setTarifa] = useState(3.00);
  const [montoEfectivoMixto, setMontoEfectivoMixto] = useState('');
  const [montoYapeMixto, setMontoYapeMixto] = useState('');

  const cargarHistorialTurno = useCallback(async (cajaActual) => {
    try {
      const data = await cajaService.obtenerHistorialTurno(cajaActual.cajero_id, cajaActual.fecha_apertura);
      setHistorial(data);
    } catch (err) {
      console.error('Error al cargar historial', err);
    }
  }, []);

  const cargarCaja = useCallback(async () => {
    try {
      const caja = await cajaService.obtenerCajaAbierta();
      setSesionCaja(caja);
      if (caja) {
        cargarHistorialTurno(caja);
      }
    } catch (err) {
      console.error(err);
    }
  }, [cargarHistorialTurno]);

  const cargarMisCierres = useCallback(async () => {
    try {
      const data = await cajaService.obtenerMisCierres();
      setMisCierres(data);
    } catch (err) {
      console.error('Error cargando cierres:', err);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargarCaja();
  }, [cargarCaja]);

  useEffect(() => {
    if (tabActual === 'historial') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      cargarMisCierres();
    }
  }, [tabActual, cargarMisCierres]);


  useEffect(() => {
    if (sesionCaja) {
      const saved = localStorage.getItem('egresos_' + sesionCaja.id);
      if (saved) setEgresos(JSON.parse(saved));
    } else {
      setEgresos([]);
    }
  }, [sesionCaja]);

  useEffect(() => {
    async function fetchEmpresaBranch() {
      if (empresaValidada && direccionEditada) {
        try {
          const empresaDb = await expedientesService.obtenerEmpresaPorRuc(empresaValidada.ruc, direccionEditada);
          if (empresaDb) {
            if (empresaDb.email_contacto) setEmailContacto(empresaDb.email_contacto);
            if (empresaDb.expedientes && Array.isArray(empresaDb.expedientes)) {
              const vencida = empresaDb.expedientes.find(exp => exp?.estado === 'Vencido');
              if (vencida) {
                setError(`El RUC ingresado cuenta con una licencia VENCIDA en esta sucursal (Código: ${vencida.codigo}). Por favor indique al contribuyente que realice el trámite de renovación.`);
                setEmpresaValidada(null);
                return;
              }

              const activo = empresaDb.expedientes.find(exp => ['Pendiente', 'En Inspeccion', 'Subsanacion', 'Observado'].includes(exp?.estado));
              if (activo) {
                setError(`Ya existe un trámite activo para esta sucursal (Estado: ${activo.estado}). No puede registrar otro.`);
                setEmpresaValidada(null);
                return;
              }

              const aprobada = empresaDb.expedientes.find(exp => exp?.estado === 'Aprobado');
              setLicenciaPrevia(aprobada || null); 
            } else {
              setLicenciaPrevia(null);
            }
          } else {
            setLicenciaPrevia(null);
            setEmailContacto('');
          }
        } catch (err) {
          console.error("Error fetching branch data:", err);
        }
      }
    }
    fetchEmpresaBranch();
  }, [direccionEditada, empresaValidada]);

  const handleRegistrarEgreso = (e) => {
    e.preventDefault();
    if (!egresoMotivo || !egresoMonto) return;
    const newEgresos = [...egresos, { motivo: egresoMotivo, monto: parseFloat(egresoMonto), fecha: new Date().toISOString() }];
    setEgresos(newEgresos);
    localStorage.setItem('egresos_' + sesionCaja.id, JSON.stringify(newEgresos));
    setModalEgreso(false);
    setEgresoMotivo('');
    setEgresoMonto('');
  };

  const handleExtornar = async (expedienteId) => {
    if (!confirm('¿Está seguro de anular este cobro?')) return;
    setLoading(true);
    try {
      await cajaService.extornarPago(expedienteId);
      await cargarHistorialTurno(sesionCaja);
    } catch (err) {
      alert('Error al extornar: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const abrirCaja = async (e) => {
    e.preventDefault();
    setError('');
    
    if (parseFloat(montoInicial) < 50) {
      setError('El monto inicial mínimo para aperturar la caja debe ser S/ 50.00.');
      return;
    }

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

  const prepararCierre = async () => {
    setLoading(true);
    try {
      const calculo = await cajaService.calcularMontoTotalTurno(sesionCaja.cajero_id, sesionCaja.fecha_apertura);
      const totalEgresos = egresos.reduce((acc, curr) => acc + curr.monto, 0);
      setResumenCierre({...calculo, totalEgresos});
      setModalCierre(true);
    } catch (err) {
      setError('Error al preparar cierre: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const cerrarCaja = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(''); // Limpiar errores
    try {
      const totalEsperadoFisico = parseFloat(sesionCaja.monto_inicial) + parseFloat(resumenCierre.totalEfectivo) - parseFloat(resumenCierre.totalEgresos);
      const caja = await cajaService.cerrarCaja(sesionCaja.id, totalEsperadoFisico, montoFisicoCierre);
      setSesionCaja(null);
      setCajaCerradaResult({
        ...caja,
        totalRecaudado: resumenCierre.totalRecaudado,
        totalYape: resumenCierre.totalYape,
        totalEfectivo: resumenCierre.totalEfectivo,
        totalEgresos: resumenCierre.totalEgresos
      });
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
    setMetodoPago('Efectivo');
    setEfectivoRecibido('');
    setEmailContacto('');
    setError('');
  };

  const handleConsultarRUC = async (e) => {
    e.preventDefault();
    setError('');
    setEmpresaValidada(null);
    setLicenciaPrevia(null);
    setEsRenovacionExpress(false);
    setSucursales([]);
    setDireccionEditada('');
    setIsDireccionEditable(false);

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

      // Consultar anexos
      const anexos = await apiPeruService.consultarRucAnexos(data.ruc || ruc);
      if (anexos && anexos.length > 0) {
        setSucursales(anexos);
      }

      const direccionMostrar = `${calle}${distrito ? ', ' + distrito : ''}${provincia ? ' - ' + provincia : ''}`;
      
      // La validación de trámite activo se debe hacer al registrar el trámite con la dirección elegida
      // porque un RUC puede tener un trámite en una sucursal y permitir otro trámite en otra.

      setEmpresaValidada({
        ruc: data.ruc || ruc,
        razonSocial: data.nombre_o_razon_social || 'Desconocida',
        domicilioFiscal: direccionMostrar || 'Desconocida'
      });
      setDireccionEditada(direccionMostrar || 'Desconocida');

      setDireccionEditada(direccionMostrar || 'Desconocida');

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
      const verificacion = await expedientesService.verificarTramiteActivo(empresaValidada.ruc, direccionEditada);
      if (verificacion.tieneTramite) {
        setError(verificacion.mensaje);
        setLoading(false);
        return;
      }

      const empresaDb = await expedientesService.guardarEmpresa({
        ruc: empresaValidada.ruc,
        razonSocial: empresaValidada.razonSocial,
        domicilioFiscal: direccionEditada,
        emailContacto: emailContacto
      });

      const numeroAleatorio = Math.floor(1000 + Math.random() * 9000);
      const codigoExpediente = `MPT-2026-${numeroAleatorio}`;

      let planoPublicUrl = 'No requiere (Renovación)';
      if (!esRenovacionExpress && fileObject) {
        planoPublicUrl = await expedientesService.subirPlanoSubsanacion(codigoExpediente, fileObject);
      }

      const montoEfe = metodoPago === 'Mixto' ? (Number(montoEfectivoMixto) || 0) : (metodoPago === 'Efectivo' ? tarifa : 0);
      const montoYap = metodoPago === 'Mixto' ? (Number(montoYapeMixto) || 0) : (metodoPago === 'Yape' ? tarifa : 0);

      const resultado = await expedientesService.crearExpediente({
        codigo: codigoExpediente,
        empresa_id: empresaDb.id,
        plano_url: planoPublicUrl,
        monto_pagado: tarifa,
        monto_efectivo: montoEfe,
        monto_yape: montoYap,
        estado: esRenovacionExpress ? 'Aprobado' : 'En Inspeccion',
        modalidad_ingreso: 'Presencial',
        cajero_id: sesionCaja?.cajero_id,
        metodo_pago: metodoPago
      });

      let fechaVisitaAsignada = null;
      if (!esRenovacionExpress) {
        fechaVisitaAsignada = await expedientesService.asignarCupoInteligente(resultado.id);
      }

      setResultadoTramite({ 
        codigo: resultado.codigo, 
        esExpress: esRenovacionExpress, 
        fechaVisita: fechaVisitaAsignada 
      });

      // Generar Comprobante PDF (Boleta o Factura) y subir a Storage
      let comprobanteUrl = null;
      try {
        const { pdfBlob } = pdfGenerator.generarComprobanteSunat(resultado, empresaDb, tarifa, tipoComprobante);
        if (pdfBlob) {
          const fileName = `comprobante-${codigoExpediente}-${Date.now()}.pdf`;
          comprobanteUrl = await expedientesService.subirDocumento(fileName, pdfBlob, 'planos');
        }
      } catch (pdfErr) {
        console.error("Error generando PDF de comprobante:", pdfErr);
      }

      // Disparar correo real usando la Edge Function en segundo plano (sin bloquear UI)
      if (emailContacto) {
        expedientesService.enviarCorreoNotificacion({
          email: emailContacto,
          codigo: codigoExpediente,
          razonSocial: empresaValidada.razonSocial,
          esExpress: esRenovacionExpress,
          tipoComprobante: tipoComprobante, // Pasamos el tipo al backend
          adjuntoUrl: comprobanteUrl, // Mandamos la URL pública
          tipoNotificacion: 'comprobante_pago' // El correo será un comprobante
        }).catch(err => console.error("Error lanzando correo de comprobante:", err));

        if (fechaVisitaAsignada) {
          expedientesService.enviarCorreoNotificacion({
            email: emailContacto,
            codigo: codigoExpediente,
            razonSocial: empresaValidada.razonSocial,
            fechaVisita: fechaVisitaAsignada,
            tipoNotificacion: 'nueva_inspeccion' 
          }).catch(err => console.error("Error lanzando correo de inspeccion:", err));
        }
      }

      cargarHistorialTurno(sesionCaja);

    } catch (err) {
      setError('Error al procesar el trámite en base de datos: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-100 p-6 min-h-screen">
      <div className="max-w-4xl mx-auto space-y-6">
        
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-teal-600 p-3 rounded-xl">
              <DollarSign className="text-white w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800">Caja y Ventanilla</h1>
          </div>
          
          <div className="flex bg-white rounded-lg shadow-sm border border-slate-200 p-1">
            <button 
              onClick={() => setTabActual('ventanilla')}
              className={`px-4 py-2 rounded-md font-bold text-sm transition-colors ${tabActual === 'ventanilla' ? 'bg-teal-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              Atención Presencial
            </button>
            <button 
              onClick={() => setTabActual('historial')}
              className={`px-4 py-2 rounded-md font-bold text-sm transition-colors flex items-center gap-2 ${tabActual === 'historial' ? 'bg-teal-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              <History className="w-4 h-4" /> Mis Cierres de Caja
            </button>
          </div>
        </div>

        {tabActual === 'ventanilla' ? (
          <div className="animate-fade-in relative">
            {cajaCerradaResult && (
              <div className="bg-white p-8 rounded-xl shadow-xl text-center border-t-4 border-slate-800 mb-6">
                <LogOut className="mx-auto w-16 h-16 text-slate-800 mb-4" />
                <h2 className="text-2xl font-bold">Turno Cerrado Correctamente</h2>
                <div className="mt-4 grid grid-cols-2 gap-4 max-w-sm mx-auto text-sm">
                  <div className="bg-slate-100 p-3 rounded text-slate-700 border border-slate-200">Total Yape: <br/><b>S/ {cajaCerradaResult.totalYape?.toFixed(2) || '0.00'}</b></div>
                  <div className="bg-green-100 p-3 rounded text-green-800 border border-green-300">
                     Efectivo Esperado: <br/><b className="text-lg">S/ {cajaCerradaResult.monto_calculado?.toFixed(2) || '0.00'}</b>
                  </div>
                </div>
                <p className="mt-4 font-bold text-slate-800">Usted entregó (Físico): S/ {Number(cajaCerradaResult.monto_fisico).toFixed(2)}</p>
                <div className="flex flex-col gap-2 mt-4 max-w-xs mx-auto">
                  <Button onClick={() => pdfGenerator.generarTicketZ(cajaCerradaResult)} variant="success">
                    Imprimir Ticket Z (Cierre)
                  </Button>
                  <Button onClick={() => setCajaCerradaResult(null)} variant="outline">
                    Nueva Sesión
                  </Button>
                </div>
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
            <Button variant="danger" onClick={prepararCierre} isLoading={loading} className="px-4 py-2 text-sm">
              Cuadrar y Cerrar
            </Button>
          </div>
          
          {modalCierre && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full">
                <h3 className="text-xl font-bold mb-4">Cierre de Caja</h3>
                {error && <Alert type="error" message={error} />}
                <div className="bg-purple-100 border-l-4 border-purple-500 p-3 rounded text-sm mb-4 text-purple-900 font-medium">
                  <p>🔒 <b>Arqueo Ciego Activo:</b> Por medidas de seguridad, debe ingresar el monto exacto de dinero físico que tiene en caja. El sistema cruzará esta información para detectar sobrantes o faltantes.</p>
                </div>
                <form onSubmit={cerrarCaja}>
                  <label className="block text-sm font-bold text-slate-700 mb-2">¿Cuánto dinero físico REAL tiene en la caja?</label>
                  <input type="number" step="0.01" min="0" required value={montoFisicoCierre} onChange={e => setMontoFisicoCierre(e.target.value)} className="w-full p-3 border rounded-lg text-xl mb-4 font-bold" placeholder="S/" />
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
                <div className="bg-slate-50 p-6 rounded-lg text-center mb-6">
                <span className="text-slate-500 font-bold block mb-2">Monto en Efectivo a Cobrar</span>
                <span className="text-4xl font-black text-slate-800">S/ {(metodoPago === 'Mixto' ? Number(montoEfectivoMixto) || 0 : tarifa).toFixed(2)}</span>
              </div>
                
                <div className="text-left mb-4">
                  <label className="text-sm font-bold text-slate-700 block mb-3 text-center">Seleccione o Ingrese el Efectivo Recibido</label>
                  
                  <div className="mb-4 flex items-center justify-center">
                     <span className="text-xl font-bold font-mono mr-2 text-slate-600">S/</span>
                     <input 
                       type="number"
                       min={tarifa}
                       step="0.10"
                       value={efectivoRecibido}
                       onChange={(e) => setEfectivoRecibido(e.target.value)}
                       className="text-xl font-bold font-mono border-b-2 border-slate-300 focus:border-teal-500 outline-none w-32 text-center bg-transparent text-slate-800"
                       placeholder="0.00"
                     />
                  </div>

                  <div className="grid grid-cols-3 gap-2 mb-4">
                    {[5, 10, 20, 50, 100].map(billete => (
                      <button
                        key={billete}
                        type="button"
                      disabled={billete < (metodoPago === 'Mixto' ? Number(montoEfectivoMixto) || 0 : tarifa)}
                        onClick={() => setEfectivoRecibido(billete.toString())}
                        className={`py-2 rounded font-bold border transition ${Number(efectivoRecibido) === billete ? 'bg-teal-600 text-white border-teal-700' : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-200'} disabled:opacity-30 disabled:cursor-not-allowed`}
                      >
                        S/ {billete}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setEfectivoRecibido((metodoPago === 'Mixto' ? Number(montoEfectivoMixto) || 0 : tarifa).toString())}
                      className={`py-2 rounded font-bold border transition ${Number(efectivoRecibido) === (metodoPago === 'Mixto' ? Number(montoEfectivoMixto) || 0 : tarifa) ? 'bg-teal-600 text-white border-teal-700' : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-200'}`}
                    >
                      Exacto
                    </button>
                  </div>
                </div>

                {efectivoRecibido && Number(efectivoRecibido) >= (metodoPago === 'Mixto' ? Number(montoEfectivoMixto) || 0 : tarifa) && (
                  <div className="bg-green-100 border border-green-300 p-3 rounded-lg mb-6">
                    <span className="text-sm text-green-800 font-bold">Vuelto a Entregar</span>
                    <p className="text-4xl font-black text-green-700">S/ {(Number(efectivoRecibido) - (metodoPago === 'Mixto' ? Number(montoEfectivoMixto) || 0 : tarifa)).toFixed(2)}</p>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setModalVuelto(false)}>Atrás</Button>
                  <Button 
                    type="button" 
                    variant="success" 
                    className="flex-1" 
                    disabled={!efectivoRecibido || Number(efectivoRecibido) < (metodoPago === 'Mixto' ? Number(montoEfectivoMixto) || 0 : tarifa)}
                    onClick={() => {
                      const montoRequeridoEfectivo = metodoPago === 'Mixto' ? Number(montoEfectivoMixto) || 0 : tarifa;
                      const vuelto = Number(efectivoRecibido) - montoRequeridoEfectivo;
                      if (vuelto > sesionCaja.monto_inicial) {
                        alert(`No hay suficiente efectivo en caja para dar este vuelto (Vuelto: S/ ${vuelto.toFixed(2)}, Caja Inicial: S/ ${sesionCaja.monto_inicial.toFixed(2)}). Por favor solicite cambio al supervisor o cobre exacto.`);
                        return;
                      }
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

              <div className="flex gap-4 justify-center mt-6">
                <Button onClick={resetForm} variant="outline" className="w-auto px-8">
                  Siguiente Trámite
                </Button>
                <Button 
                  onClick={() => pdfGenerator.generarTicketPago(resultadoTramite, empresaValidada, tarifa, metodoPago)} 
                  variant="primary" 
                  className="w-auto px-6 bg-slate-800 hover:bg-slate-900 border-none"
                >
                  <Printer className="w-4 h-4 mr-2 inline" /> Imprimir Comprobante
                </Button>
              </div>
          </div>
        ) : (
          <div className="bg-white p-6 rounded-xl shadow-md border border-slate-200">
            <h2 className="text-xl font-bold text-slate-800 mb-6 border-b pb-2">Registro de Solicitud</h2>
            
            {error && <Alert type="error" message={error} />}

            <form onSubmit={handleConsultarRUC} className="mb-6 flex gap-3">
              <input 
                type="text" maxLength={11} required value={ruc} 
                onChange={(e) => {
                  setError('');
                  setRuc(e.target.value.replace(/\D/g, ''));
                }}
                disabled={empresaValidada !== null || buscandoSunat}
                className="flex-1 p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-600 outline-none disabled:bg-slate-100"
                placeholder="RUC de la empresa"
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
                  <p className="text-xs text-green-700 font-bold uppercase mb-2">Datos Validados (SUNAT)</p>
                  <p className="font-bold text-slate-800 mb-2">{empresaValidada.razonSocial}</p>
                  
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-bold text-green-800">Domicilio / Sucursal</label>
                    <label className="text-xs flex items-center gap-1 cursor-pointer text-green-700 hover:text-green-900">
                      <input type="checkbox" checked={isDireccionEditable} onChange={(e) => setIsDireccionEditable(e.target.checked)} className="rounded text-green-600 focus:ring-green-500" />
                      Editar manualmente
                    </label>
                  </div>
                  
                  {!isDireccionEditable && sucursales.length > 0 ? (
                    <select 
                      value={direccionEditada}
                      onChange={(e) => setDireccionEditada(e.target.value)}
                      className="w-full p-2 bg-white border border-green-300 rounded text-sm text-slate-700 font-semibold focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none mt-1"
                    >
                      <option value={empresaValidada?.domicilioFiscal}>{empresaValidada?.domicilioFiscal} (Principal)</option>
                      {sucursales.map((sucursal, idx) => (
                        <option key={idx} value={sucursal.direccion}>{sucursal.direccion} ({sucursal.tipo_establecimiento})</option>
                      ))}
                    </select>
                  ) : (
                    <input 
                      type="text" 
                      value={direccionEditada} 
                      onChange={(e) => setDireccionEditada(e.target.value)}
                      disabled={!isDireccionEditable && sucursales.length === 0} 
                      className={`w-full p-2 bg-white border ${!isDireccionEditable && sucursales.length === 0 ? 'border-green-200 cursor-not-allowed' : 'border-green-300 focus:ring-2 focus:ring-green-500'} rounded text-sm text-slate-700 font-semibold outline-none transition-all mt-1`}
                    />
                  )}
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

                <div className="bg-white p-4 border border-slate-200 rounded-lg shadow-sm">
                  <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                    <Mail className="w-4 h-4 text-teal-600"/> Correo(s) Electrónico(s) de Contacto
                  </label>
                  <input 
                    type="text" 
                    required 
                    value={emailContacto} 
                    onChange={(e) => setEmailContacto(e.target.value)}
                    placeholder="correo1@empresa.com, correo2@empresa.com"
                    className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-600 outline-none"
                  />
                  <p className="text-xs text-slate-500 mt-1">Puede ingresar múltiples correos separados por coma (,).</p>
                </div>

                {!esRenovacionExpress && (
                  <div className="border-2 border-dashed border-slate-300 p-6 rounded-lg text-center bg-slate-50">
                    <FileText className="mx-auto text-slate-400 w-10 h-10 mb-2" />
                    <label className="cursor-pointer">
                      <span className="bg-teal-100 text-teal-800 px-4 py-2 rounded font-bold text-sm hover:bg-teal-200 transition">Subir PDF del Plano</span>
                      <input key={fileObject ? fileObject.name : 'empty'} type="file" accept=".pdf" onChange={handleFileChange} className="hidden" />
                    </label>
                    {planoSeleccionado && <p className="mt-3 text-sm text-teal-700 font-bold">✓ {planoSeleccionado}</p>}
                  </div>
                )}

                <div className="bg-slate-800 p-4 rounded-t-lg text-white flex justify-between items-center mt-4">
                   <div>
                     <p className="font-bold">Pago en Caja Municipal</p>
                     <p className="text-xs text-slate-300">Tasa administrativa por Licencia</p>
                   </div>
                   <div className="flex items-center">
                     <span className="text-2xl font-bold font-mono mr-1">S/</span>
                     <input 
                       type="number" 
                       min="0.00"
                       step="1.00"
                       value={tarifa} 
                       onChange={(e) => setTarifa(Number(e.target.value))}
                       className="text-2xl font-bold font-mono bg-transparent w-24 text-right outline-none border-b border-dashed border-slate-500 focus:border-teal-400 focus:bg-slate-700 rounded px-1"
                     />
                   </div>
                </div>

                <div className="bg-white p-4 border border-x-slate-200 border-b-slate-200">
                  <p className="text-sm font-bold text-slate-700 mb-2">Tipo de Comprobante</p>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="radio" 
                        name="comprobante" 
                        value="Boleta" 
                        checked={tipoComprobante === 'Boleta'} 
                        onChange={(e) => setTipoComprobante(e.target.value)}
                        className="text-teal-600 focus:ring-teal-600 w-4 h-4"
                      />
                      <span className="text-sm text-slate-700 font-medium">Boleta Electrónica</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="radio" 
                        name="comprobante" 
                        value="Factura" 
                        checked={tipoComprobante === 'Factura'} 
                        onChange={(e) => setTipoComprobante(e.target.value)}
                        className="text-teal-600 focus:ring-teal-600 w-4 h-4"
                      />
                      <span className="text-sm text-slate-700 font-medium">Factura Electrónica</span>
                    </label>
                  </div>
                </div>

                <div className="bg-slate-100 p-4 rounded-b-lg border border-slate-200 border-t-0 flex flex-col gap-4">
                  <div className="flex gap-4">
                    <label className={`flex-1 flex flex-col items-center p-3 rounded-lg cursor-pointer border-2 transition ${metodoPago === 'Efectivo' ? 'border-green-500 bg-green-50 text-green-700' : 'border-slate-300 bg-white hover:bg-slate-50'}`}>
                      <input type="radio" name="pago" value="Efectivo" className="hidden" checked={metodoPago === 'Efectivo'} onChange={(e) => setMetodoPago(e.target.value)} />
                      <Banknote className="w-6 h-6 mb-1" />
                      <span className="font-bold text-sm">Efectivo</span>
                    </label>
                    <label className={`flex-1 flex flex-col items-center p-3 rounded-lg cursor-pointer border-2 transition ${metodoPago === 'Yape' ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-slate-300 bg-white hover:bg-slate-50'}`}>
                      <input type="radio" name="pago" value="Yape" className="hidden" checked={metodoPago === 'Yape'} onChange={(e) => setMetodoPago(e.target.value)} />
                      <Smartphone className="w-6 h-6 mb-1" />
                      <span className="font-bold text-sm">Yape / Plin</span>
                    </label>
                    <label className={`flex-1 flex flex-col items-center p-3 rounded-lg cursor-pointer border-2 transition ${metodoPago === 'Mixto' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-300 bg-white hover:bg-slate-50'}`}>
                      <input type="radio" name="pago" value="Mixto" className="hidden" checked={metodoPago === 'Mixto'} onChange={(e) => setMetodoPago(e.target.value)} />
                      <div className="flex items-center gap-1 mb-1">
                        <Banknote className="w-5 h-5" />
                        <span className="text-xl">+</span>
                        <Smartphone className="w-5 h-5" />
                      </div>
                      <span className="font-bold text-sm">Mixto</span>
                    </label>
                  </div>
                  
                  {metodoPago === 'Mixto' && (
                    <div className="bg-white p-4 border border-slate-200 rounded flex gap-4">
                      <div className="flex-1">
                        <label className="text-xs font-bold text-slate-600 block mb-1">Monto en Efectivo</label>
                        <div className="flex items-center border border-slate-300 rounded overflow-hidden">
                          <span className="bg-slate-100 px-3 py-2 text-slate-600 font-bold border-r border-slate-300">S/</span>
                          <input 
                            type="number" min="0" step="0.01" value={montoEfectivoMixto} onChange={(e) => setMontoEfectivoMixto(e.target.value)}
                            className="w-full p-2 outline-none font-mono" placeholder="0.00"
                          />
                        </div>
                      </div>
                      <div className="flex-1">
                        <label className="text-xs font-bold text-slate-600 block mb-1">Monto en Yape/Plin</label>
                        <div className="flex items-center border border-slate-300 rounded overflow-hidden">
                          <span className="bg-slate-100 px-3 py-2 text-slate-600 font-bold border-r border-slate-300">S/</span>
                          <input 
                            type="number" min="0" step="0.01" value={montoYapeMixto} onChange={(e) => setMontoYapeMixto(e.target.value)}
                            className="w-full p-2 outline-none font-mono" placeholder="0.00"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-3">
                  <button onClick={resetForm} type="button" className="px-4 py-3 border border-slate-300 text-slate-600 rounded-lg font-bold hover:bg-slate-100">
                    Cancelar
                  </button>
                  <Button 
                  onClick={() => {
                    const correos = emailContacto.split(',').map(c => c.trim()).filter(Boolean);
                    const validos = correos.every(c => c.includes('@'));
                    
                    if (correos.length === 0 || !validos) {
                      setError('Por favor, ingrese correos electrónicos válidos separados por coma.');
                      window.scrollTo(0, 0);
                      return;
                    }
                    if (metodoPago === 'Mixto') {
                      const eff = Number(montoEfectivoMixto) || 0;
                      const yap = Number(montoYapeMixto) || 0;
                      if (eff + yap !== tarifa) {
                        setError(`El pago mixto (S/ ${(eff + yap).toFixed(2)}) no coincide con la tarifa (S/ ${tarifa.toFixed(2)}).`);
                        window.scrollTo(0, 0);
                        return;
                      }
                      eff > 0 ? setModalVuelto(true) : registrarTramitePresencial();
                    } else if (metodoPago === 'Yape') {
                      registrarTramitePresencial();
                    } else {
                      setModalVuelto(true);
                    }
                  }} 
                  isLoading={loading}
                  disabled={(!esRenovacionExpress && !fileObject) || !empresaValidada?.ruc}
                  variant="primary"
                >
                  <CheckCircle className="w-5 h-5" /> Completar Pago y Trámite
                </Button>
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* Historial de Turno */}
        <div className="mt-8 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><History className="w-5 h-5 text-slate-500"/> Trámites Cobrados (Turno Actual)</h3>
          {historial.length === 0 ? (
            <p className="text-slate-500 text-sm italic text-center py-4">No hay trámites registrados en este turno.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-600 text-xs uppercase font-bold">
                    <th className="p-3 rounded-tl-lg">Hora</th>
                    <th className="p-3">Expediente</th>
                    <th className="p-3">Método</th>
                    <th className="p-3 rounded-tr-lg text-right">Monto</th>
                  </tr>
                </thead>
                <tbody className="text-sm text-slate-700">
                  {historial.map((exp) => (
                    <tr key={exp.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="p-3">{new Date(exp.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                      <td className="p-3 font-mono font-bold text-teal-700">{exp.codigo}</td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${exp.metodo_pago === 'Yape' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'}`}>
                          {exp.metodo_pago || 'Efectivo'}
                        </span>
                      </td>
                      <td className="p-3 text-right font-bold">S/ {Number(exp.monto_pagado).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        </>
      ) : null}
      </div>
    ) : tabActual === 'historial' ? (
          <div className="bg-white p-6 rounded-xl shadow-md border border-slate-200 animate-fade-in">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <History className="w-5 h-5 text-slate-500" /> Historial de Mis Cierres
            </h2>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-sm font-bold uppercase">
                    <th className="p-4">Apertura</th>
                    <th className="p-4">Cierre</th>
                    <th className="p-4 text-right">Inicial</th>
                    <th className="p-4 text-right">Sistema</th>
                    <th className="p-4 text-right">Físico</th>
                    <th className="p-4 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {misCierres.map((cierre) => {
                    // Cálculo del descuadre si está cerrada
                    let estadoBadge = <span className="text-yellow-600 font-bold bg-yellow-100 px-2 py-1 rounded text-xs">Abierta</span>;
                    if (cierre.estado === 'Cerrada') {
                      const diferencia = cierre.monto_fisico - cierre.monto_calculado;
                      if (Math.abs(diferencia) < 0.01) {
                        estadoBadge = <span className="text-green-600 font-bold bg-green-100 px-2 py-1 rounded text-xs">Cuadrada</span>;
                      } else if (diferencia > 0) {
                        estadoBadge = <span className="text-blue-600 font-bold bg-blue-100 px-2 py-1 rounded text-xs">Sobrante (S/ {diferencia.toFixed(2)})</span>;
                      } else {
                        estadoBadge = <span className="text-red-600 font-bold bg-red-100 px-2 py-1 rounded text-xs">Faltante (S/ {Math.abs(diferencia).toFixed(2)})</span>;
                      }
                    }

                    return (
                      <tr key={cierre.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors text-sm">
                        <td className="p-4 font-medium text-slate-800">{new Date(cierre.fecha_apertura).toLocaleString()}</td>
                        <td className="p-4 text-slate-600">{cierre.fecha_cierre ? new Date(cierre.fecha_cierre).toLocaleString() : '-'}</td>
                        <td className="p-4 text-right font-bold text-slate-600">S/ {cierre.monto_inicial?.toFixed(2)}</td>
                        <td className="p-4 text-right">S/ {cierre.monto_calculado?.toFixed(2) || '0.00'}</td>
                        <td className="p-4 text-right font-bold text-slate-800">S/ {cierre.monto_fisico?.toFixed(2) || '0.00'}</td>
                        <td className="p-4 text-center">{estadoBadge}</td>
                      </tr>
                    );
                  })}
                  {misCierres.length === 0 && (
                    <tr>
                      <td colSpan="6" className="p-8 text-center text-slate-500">No hay historial de cajas cerradas.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
