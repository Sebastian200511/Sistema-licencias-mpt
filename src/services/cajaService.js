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

  extornarPago: async (expedienteId) => {
    try {
      const { error } = await supabase
        .from('expedientes')
        .update({
          monto_pagado: 0,
          metodo_pago: null,
          cajero_id: null,
          estado: 'Pendiente'
        })
        .eq('id', expedienteId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error al extornar pago:', error);
      throw error;
    }
  },

  obtenerHistorialTurno: async (cajeroId, fechaApertura) => {
    try {
      const { data, error } = await supabase
        .from('expedientes')
        .select('id, codigo, created_at, monto_pagado, metodo_pago')
        .eq('cajero_id', cajeroId)
        .gte('created_at', fechaApertura)
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error al obtener historial:', error);
      return [];
    }
  },

  calcularMontoTotalTurno: async (cajeroId, fechaApertura) => {
    try {
      const historial = await cajaService.obtenerHistorialTurno(cajeroId, fechaApertura);
      
      let totalEfectivo = 0;
      let totalYape = 0;

      historial.forEach(exp => {
        const monto = parseFloat(exp.monto_pagado) || 0;
        if (exp.metodo_pago === 'Yape') {
          totalYape += monto;
        } else {
          totalEfectivo += monto;
        }
      });

      return {
        totalRecaudado: totalEfectivo + totalYape,
        totalEfectivo,
        totalYape
      };
    } catch (error) {
      console.error('Error al calcular monto:', error);
      return { totalRecaudado: 0, totalEfectivo: 0, totalYape: 0 };
    }
  },

  obtenerMisCierres: async () => {
    try {
      const cajeroId = localStorage.getItem('inst_id');
      if (!cajeroId) throw new Error('Usuario no autenticado.');

      const { data, error } = await supabase
        .from('caja_sesiones')
        .select('*')
        .eq('cajero_id', cajeroId)
        .order('fecha_apertura', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error al obtener mis cierres:', error);
      return [];
    }
  }
};
