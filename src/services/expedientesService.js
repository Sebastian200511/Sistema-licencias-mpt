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

  actualizarPlanoExpediente: async (expedienteId, planoUrl) => {
    const { error } = await supabase
      .from('expedientes')
      .update({ plano_url: planoUrl })
      .eq('id', expedienteId);

    if (error) throw new Error('Error al actualizar el expediente.');
  },

  // Consultas Internas (Cajero / Inspector)
  obtenerEmpresaPorRuc: async (ruc) => {
    const { data, error } = await supabase
      .from('empresas')
      .select(`id, email_contacto, expedientes(codigo, estado)`)
      .eq('ruc', ruc)
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
      }, { onConflict: 'ruc' })
      .select()
      .single();

    if (error) throw new Error('Error al guardar datos de la empresa: ' + error.message);
    return data;
  },

  verificarTramiteActivo: async (ruc) => {
    const { data: empresa, error: errorEmpresa } = await supabase
      .from('empresas')
      .select('id')
      .eq('ruc', ruc)
      .maybeSingle();

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
      if (['Pendiente', 'En Inspeccion', 'Subsanacion'].includes(exp.estado)) {
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
      .eq('estado', 'En Inspeccion')
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
      .neq('estado', 'En Inspeccion')
      .neq('estado', 'Pendiente')
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
  }
};
//claro
