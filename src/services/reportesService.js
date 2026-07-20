import { supabase } from '../supabaseClient';

export const reportesService = {
  obtenerReporteFinanciero: async () => {
    try {
      // 1. Obtener todos los cajeros
      const { data: usuarios, error: errUsuarios } = await supabase
        .from('usuarios_internos')
        .select('id, nombre_completo, rol')
        .eq('rol', 'Cajero');

      if (errUsuarios) throw errUsuarios;

      // 2. Obtener todos los expedientes cobrados (que tienen monto y cajero asignado)
      const { data: expedientes, error: errExpedientes } = await supabase
        .from('expedientes')
        .select('cajero_id, monto_pagado, metodo_pago, created_at')
        .eq('pago_realizado', true);

      if (errExpedientes) throw errExpedientes;

      let totalGeneral = 0;
      let totalEfectivo = 0;
      let totalYape = 0;
      let tramitesAtendidos = expedientes.length;

      // Mapa para agrupar por cajero
      const reportePorCajero = {};

      // Inicializar el mapa con los cajeros reales
      usuarios.forEach(u => {
        reportePorCajero[u.id] = {
          nombre: u.nombre_completo,
          total: 0,
          efectivo: 0,
          yape: 0,
          cantidad: 0
        };
      });

      let totalTarjeta = 0;

      // Calcular
      expedientes.forEach(exp => {
        const monto = parseFloat(exp.monto_pagado) || 0;
        const metodo = exp.metodo_pago || 'Efectivo'; // Fallback por si acaso

        totalGeneral += monto;
        if (metodo === 'Yape') totalYape += monto;
        else if (metodo === 'Tarjeta') totalTarjeta += monto;
        else totalEfectivo += monto;

        const cId = exp.cajero_id;
        
        if (!cId) {
          // Pago Virtual (Mercado Pago)
          if (!reportePorCajero['virtual']) {
            reportePorCajero['virtual'] = {
              nombre: 'Portal Virtual (Mercado Pago)',
              total: 0, efectivo: 0, yape: 0, tarjeta: 0, cantidad: 0
            };
          }
          reportePorCajero['virtual'].cantidad += 1;
          reportePorCajero['virtual'].total += monto;
          reportePorCajero['virtual'].tarjeta += monto;
        } else if (reportePorCajero[cId]) {
          // Pago Físico por Cajero
          reportePorCajero[cId].cantidad += 1;
          reportePorCajero[cId].total += monto;
          if (metodo === 'Yape') reportePorCajero[cId].yape += monto;
          else if (metodo === 'Tarjeta') reportePorCajero[cId].tarjeta += monto; // Caso raro físico con POS
          else reportePorCajero[cId].efectivo += monto;
        } else {
          // Si por alguna razón hay un cajero_id que ya no está en usuarios_internos (borrado lógico)
          reportePorCajero[cId] = {
            nombre: 'Cajero Desconocido / Eliminado',
            total: monto,
            efectivo: metodo !== 'Yape' && metodo !== 'Tarjeta' ? monto : 0,
            yape: metodo === 'Yape' ? monto : 0,
            tarjeta: metodo === 'Tarjeta' ? monto : 0,
            cantidad: 1
          };
        }
      });

      return {
        totales: {
          general: totalGeneral,
          efectivo: totalEfectivo,
          yape: totalYape,
          tarjeta: totalTarjeta,
          tramites: tramitesAtendidos
        },
        desgloseCajeros: Object.values(reportePorCajero).sort((a, b) => b.total - a.total)
      };

    } catch (error) {
      console.error('Error generando reporte:', error);
      throw error;
    }
  }
};
