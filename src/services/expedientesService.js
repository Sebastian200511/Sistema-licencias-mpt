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
      .select(`id, expedientes(codigo, estado)`)
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

    if (error) throw new Error('Error al generar el expediente.');
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

  obtenerInspeccionesDeHoy: async () => {
    const hoyStr = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('expedientes')
      .select(`
        *, 
        empresas(ruc, razon_social, domicilio_fiscal),
        inspecciones!inner(fecha_programada, estado)
      `)
      .eq('inspecciones.fecha_programada', hoyStr)
      .order('fecha_creacion', { ascending: false });

    if (error) throw new Error('Error al cargar trámites: ' + error.message);
    return data;
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
