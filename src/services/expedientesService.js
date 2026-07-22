import { supabase } from '../supabaseClient';

export const expedientesService = {
  // Consultas Públicas (Ciudadano)
  buscarExpediente: async (codigo) => {
    const { data, error } = await supabase
      .from('expedientes')
      .select(`
        *,
        empresas (ruc, razon_social, domicilio_fiscal),
        inspecciones (*)
      `)
      .eq('codigo', codigo)
      .single();

    if (error) throw new Error('Expediente no encontrado.');
    return data;
  },

  subirPlanoSubsanacion: async (codigo, file) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `subsanacion-${codigo}-${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('planos')
      .upload(fileName, file);

    if (uploadError) throw new Error('Error al subir el plano.');

    const { data: urlData } = supabase.storage.from('planos').getPublicUrl(fileName);
    return urlData.publicUrl;
  },

  subirDocumento: async (fileName, fileBlob, bucket = 'planos') => {
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(fileName, fileBlob, { contentType: 'application/pdf', upsert: true });

    if (uploadError) {
      console.error("Error al subir documento:", uploadError);
      return null;
    }

    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(fileName);
    return urlData.publicUrl;
  },

  actualizarPlanoExpediente: async (expedienteId, planoUrl) => {
    const { error } = await supabase
      .from('expedientes')
      .update({ plano_url: planoUrl })
      .eq('id', expedienteId);

    if (error) throw new Error('Error al actualizar el expediente.');
  },

  // Consultas Internas (Cajero / Inspector)
  obtenerEmpresaPorRuc: async (ruc, domicilioFiscal = null) => {
    let query = supabase
      .from('empresas')
      .select(`id, email_contacto, expedientes(codigo, estado, fecha_vencimiento)`)
      .eq('ruc', ruc);
      
    if (domicilioFiscal) {
      query = query.eq('domicilio_fiscal', domicilioFiscal);
    }
    
    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') throw error; // Ignorar not found single
    return data;
  },

  guardarEmpresa: async (empresaData) => {
    const { data, error } = await supabase
      .from('empresas')
      .upsert({
        ruc: empresaData.ruc,
        razon_social: empresaData.razonSocial,
        domicilio_fiscal: empresaData.domicilioFiscal,
        email_contacto: empresaData.emailContacto
      }, { onConflict: 'ruc, domicilio_fiscal' })
      .select()
      .single();

    if (error) throw new Error('Error al guardar datos de la empresa: ' + error.message);
    return data;
  },

  verificarTramiteActivo: async (ruc, domicilioFiscal) => {
    let query = supabase
      .from('empresas')
      .select('id')
      .eq('ruc', ruc);
      
    if (domicilioFiscal) {
      query = query.eq('domicilio_fiscal', domicilioFiscal);
    }
    
    const { data: empresa, error: errorEmpresa } = await query.limit(1).maybeSingle();

    if (errorEmpresa) throw new Error('Error al verificar empresa.');
    if (!empresa) return { tieneTramite: false };

    const { data: expedientes, error: errorExp } = await supabase
      .from('expedientes')
      .select('estado, fecha_vencimiento')
      .eq('empresa_id', empresa.id)
      .neq('estado', 'Rechazado')
      .order('created_at', { ascending: false });

    if (errorExp) throw new Error('Error al verificar trámites.');
    if (!expedientes || expedientes.length === 0) return { tieneTramite: false };

    for (const exp of expedientes) {
      if (['Pendiente', 'En Inspeccion', 'Subsanacion', 'Observado'].includes(exp.estado)) {
        return { 
          tieneTramite: true, 
          mensaje: `La empresa con RUC ${ruc} ya tiene un trámite en curso (Estado: ${exp.estado}).` 
        };
      }
      if (exp.estado === 'Aprobado' && exp.fecha_vencimiento) {
        // Tratar la fecha considerando zona horaria UTC local
        const vencimiento = new Date(exp.fecha_vencimiento + 'T00:00:00'); 
        const hoy = new Date();
        // Resetear la hora de hoy para comparar solo fechas
        hoy.setHours(0, 0, 0, 0);
        
        if (vencimiento >= hoy) {
          return { 
            tieneTramite: true, 
            mensaje: `La empresa con RUC ${ruc} ya tiene una licencia aprobada y vigente hasta el ${vencimiento.toLocaleDateString()}.` 
          };
        }
      }
    }
    
    return { tieneTramite: false };
  },

  crearExpediente: async (expedienteData) => {
    if (expedienteData.estado === 'Aprobado' && !expedienteData.fecha_vencimiento) {
      const fechaVencimiento = new Date();
      fechaVencimiento.setFullYear(fechaVencimiento.getFullYear() + 1);
      expedienteData.fecha_vencimiento = fechaVencimiento.toISOString().split('T')[0];
    }

    const { data, error } = await supabase
      .from('expedientes')
      .insert([expedienteData])
      .select()
      .single();

    if (error) {
      console.error('Detalles del error al crear expediente:', error);
      throw new Error(`Error al generar el expediente: ${error.message}`);
    }
    return data;
  },

  renovarExpediente: async (expedienteAntiguoId, fileObject = null, esExpress = false) => {
    // 1. Obtener datos del expediente antiguo
    const { data: antiguo, error: errFetch } = await supabase
      .from('expedientes')
      .select('*')
      .eq('id', expedienteAntiguoId)
      .single();
      
    if (errFetch || !antiguo) throw new Error('No se encontró el expediente original para renovar.');

    // 2. Generar nuevo código
    const numeroAleatorio = Math.floor(1000 + Math.random() * 9000);
    const codigoExpediente = `MPT-2026-${numeroAleatorio}`;

    // 3. Subir nuevo plano si lo hay, si no reciclar el viejo
    let planoUrl = antiguo.plano_url;
    if (fileObject) {
      const fileName = `${codigoExpediente}_${Date.now()}_plano.pdf`;
      const { error: uploadError } = await supabase.storage
        .from('planos')
        .upload(fileName, fileObject, { upsert: true });

      if (uploadError) throw new Error(`Error al subir el nuevo plano: ${uploadError.message}`);
      const { data: urlData } = supabase.storage.from('planos').getPublicUrl(fileName);
      planoUrl = urlData.publicUrl;
    }

    // 4. Crear nuevo expediente
    const nuevoExpediente = {
      codigo: codigoExpediente,
      empresa_id: antiguo.empresa_id,
      plano_url: planoUrl,
      estado: esExpress ? 'Aprobado' : 'Pendiente',
      monto_pagado: 3.00,
      metodo_pago: 'Tarjeta',
      fecha_vencimiento: null
    };

    // Si es express, calcular la fecha de vencimiento (1 año después)
    if (esExpress) {
      const fechaVenc = new Date();
      fechaVenc.setFullYear(fechaVenc.getFullYear() + 1);
      nuevoExpediente.fecha_vencimiento = fechaVenc.toISOString().split('T')[0];
    }

    const { data, error: errInsert } = await supabase
      .from('expedientes')
      .insert([nuevoExpediente])
      .select()
      .single();

    if (errInsert) throw new Error(`Error al crear renovación: ${errInsert.message}`);
    return data;
  },

  asignarCupoInteligente: async (expedienteId) => {
    const { data, error } = await supabase.rpc('asignar_cupo_inspeccion', {
      p_expediente_id: expedienteId
    });
    if (error) throw new Error('Error al asignar cupo en la agenda: ' + error.message);
    return data;
  },

  crearInspeccion: async (inspeccionData) => {
    const { error } = await supabase
      .from('inspecciones')
      .insert([inspeccionData]);

    if (error) throw new Error('Error al programar la inspección.');
  },

  obtenerInspeccionesPendientes: async () => {
    const { data, error } = await supabase
      .from('expedientes')
      .select(`
        *, 
        empresas(ruc, razon_social, domicilio_fiscal, email_contacto),
        inspecciones!inner(id, fecha_programada, estado)
      `)
      .in('estado', ['En Inspeccion', 'Observado'])
      .order('created_at', { ascending: false });

    if (error) throw new Error('Error al cargar trámites: ' + error.message);
    return data;
  },

  obtenerHistorialInspecciones: async () => {
    const { data, error } = await supabase
      .from('expedientes')
      .select(`
        *, 
        empresas(ruc, razon_social, domicilio_fiscal, email_contacto),
        inspecciones!inner(id, fecha_programada, estado)
      `)
      .not('estado', 'in', '("En Inspeccion","Observado","Pendiente")')
      .order('created_at', { ascending: false });

    if (error) throw new Error('Error al cargar historial: ' + error.message);
    return data;
  },

  actualizarFechaInspeccion: async (inspeccionId, nuevaFecha) => {
    const { error } = await supabase
      .from('inspecciones')
      .update({ fecha_programada: nuevaFecha })
      .eq('id', inspeccionId);
    if (error) throw new Error('Error al reprogramar inspección: ' + error.message);
  },

  actualizarEstadoExpediente: async (expedienteId, nuevoEstado) => {
    let updateData = { estado: nuevoEstado };

    if (nuevoEstado === 'Aprobado') {
      const fechaVencimiento = new Date();
      fechaVencimiento.setFullYear(fechaVencimiento.getFullYear() + 1);
      updateData.fecha_vencimiento = fechaVencimiento.toISOString().split('T')[0];
    }

    const { error } = await supabase
      .from('expedientes')
      .update(updateData)
      .eq('id', expedienteId);

    if (error) throw new Error('Error al cambiar el estado del expediente.');

    // Fetch details to send email
    const { data: expDetails } = await supabase
      .from('expedientes')
      .select('codigo, empresas(email_contacto, razon_social)')
      .eq('id', expedienteId)
      .single();

    if (expDetails && expDetails.empresas?.email_contacto) {
      let tipoNotificacion = '';
      if (nuevoEstado === 'Aprobado') tipoNotificacion = 'aprobado';
      else if (nuevoEstado === 'Observado') tipoNotificacion = 'observacion';
      else if (nuevoEstado === 'Rechazado') tipoNotificacion = 'rechazado';
      
      if (tipoNotificacion) {
        expedientesService.enviarCorreoNotificacion({
          email: expDetails.empresas.email_contacto,
          codigo: expDetails.codigo,
          razonSocial: expDetails.empresas.razon_social,
          tipoNotificacion: tipoNotificacion,
          observaciones: nuevoEstado === 'Observado' ? 'El inspector encontró observaciones que deben ser subsanadas.' : ''
        }).catch(err => console.error("Error enviando correo de estado:", err));
      }
    }
  },

  enviarCorreoNotificacion: async (datosCorreo) => {
    // datosCorreo: { email, codigo, razonSocial, fechaVisita, esExpress }
    const { data, error } = await supabase.functions.invoke('send-email-notification', {
      body: datosCorreo,
    });

    if (error) {
      console.error("Error al enviar correo:", error);
    }
    return data;
  },

  verificarVencimientos: async () => {
    const hoyStr = new Date().toISOString().split('T')[0];
    const { data: expedientesVencidos, error } = await supabase
      .from('expedientes')
      .select('id, codigo, empresas(email_contacto, razon_social)')
      .eq('estado', 'Aprobado')
      .lt('fecha_vencimiento', hoyStr);
      
    if (error) throw new Error('Error buscando vencimientos: ' + error.message);
    if (!expedientesVencidos || expedientesVencidos.length === 0) return 0;
    
    let vencidosCount = 0;
    for (const exp of expedientesVencidos) {
      const { error: updateErr } = await supabase
        .from('expedientes')
        .update({ estado: 'Vencido' })
        .eq('id', exp.id);
        
      if (!updateErr) {
        vencidosCount++;
        if (exp.empresas && exp.empresas.email_contacto) {
          expedientesService.enviarCorreoNotificacion({
            email: exp.empresas.email_contacto,
            codigo: exp.codigo,
            razonSocial: exp.empresas.razon_social,
            tipoNotificacion: 'vencimiento'
          }).catch(console.error);
        }
      }
    }
    return vencidosCount;
  }
};
//claro

