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
        domicilio_fiscal: empresaData.domicilioFiscal 
      }, { onConflict: 'ruc' })
      .select()
      .single();

    if (error) throw new Error('Error al guardar datos de la empresa.');
    return data;
  },

  crearExpediente: async (expedienteData) => {
    const { data, error } = await supabase
      .from('expedientes')
      .insert([expedienteData])
      .select()
      .single();

    if (error) throw new Error('Error al generar el expediente.');
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

    if (error) throw new Error('Error al cargar trámites.');
    return data;
  },

  actualizarEstadoExpediente: async (expedienteId, nuevoEstado) => {
    const { error } = await supabase
      .from('expedientes')
      .update({ estado: nuevoEstado })
      .eq('id', expedienteId);

    if (error) throw new Error('Error al cambiar el estado del expediente.');
  }
};
