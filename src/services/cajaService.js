import { supabase } from '../supabaseClient';

export const cajaService = {
  obtenerCajaAbierta: async () => {
    try {
      const cajeroId = localStorage.getItem('inst_id');
      if (!cajeroId) throw new Error('Usuario no autenticado.');

      const { data, error } = await supabase
        .from('caja_sesiones')
        .select('*')
        .eq('cajero_id', cajeroId)
        .eq('estado', 'Abierta')
        .maybeSingle();

      if (error) throw error;
      return data; // null si no hay caja abierta
    } catch (error) {
      console.error('Error al obtener caja:', error);
      throw error;
    }
  },

  abrirCaja: async (montoInicial) => {
    try {
      const cajeroId = localStorage.getItem('inst_id');
      if (!cajeroId) throw new Error('Usuario no autenticado.');

      const { data, error } = await supabase
        .from('caja_sesiones')
        .insert([{
          cajero_id: cajeroId,
          monto_inicial: parseFloat(montoInicial),
          estado: 'Abierta'
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error al abrir caja:', error);
      throw error;
    }
  },

  cerrarCaja: async (sesionId, montoCalculado, montoFisico) => {
    try {
      const { data, error } = await supabase
        .from('caja_sesiones')
        .update({
          estado: 'Cerrada',
          fecha_cierre: new Date().toISOString(),
          monto_calculado: parseFloat(montoCalculado),
          monto_fisico: parseFloat(montoFisico)
        })
        .eq('id', sesionId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error al cerrar caja:', error);
      throw error;
    }
  },

  calcularMontoTotalTurno: async (sesionId) => {
    try {
      // Para saber los trámites cobrados en esta sesión, podríamos consultar expedientes creados por este cajero
      // entre la fecha de apertura y ahora. Pero como el sistema no guarda explicitamente quién cobró el expediente
      // en la tabla expedientes, asumiremos que todos los expedientes creados entre la apertura de caja y el cierre
      // (por este cajero) cuentan.
      // O para simplificar como MVP, podemos confiar en el estado del front end o consultar `expedientes`.
      return 0; 
    } catch (error) {
      console.error('Error al calcular monto:', error);
      return 0;
    }
  }
};
