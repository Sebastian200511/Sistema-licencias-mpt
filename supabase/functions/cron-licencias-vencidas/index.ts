import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    // 1. Obtener la fecha de hoy en formato YYYY-MM-DD
    const hoyStr = new Date().toISOString().split('T')[0];

    // 2. Buscar expedientes aprobados cuya fecha_vencimiento sea MENOR a hoy
    const { data: vencidos, error: errFetch } = await supabase
      .from('expedientes')
      .select(`
        id, 
        codigo, 
        empresas(email_contacto, razon_social)
      `)
      .eq('estado', 'Aprobado')
      .lt('fecha_vencimiento', hoyStr);

    if (errFetch) throw errFetch;

    if (!vencidos || vencidos.length === 0) {
      return new Response(JSON.stringify({ message: "No hay licencias vencidas procesadas hoy." }), { 
        headers: { "Content-Type": "application/json" },
        status: 200 
      });
    }

    const resultados = [];
    
    // 3. Procesar cada uno
    for (const exp of vencidos) {
      // 3.1 Actualizar el estado a 'Vencido'
      const { error: errUpdate } = await supabase
        .from('expedientes')
        .update({ estado: 'Vencido' })
        .eq('id', exp.id);

      if (errUpdate) {
        resultados.push({ codigo: exp.codigo, status: 'error_bd', error: errUpdate.message });
        continue;
      }

      // 3.2 Enviar correo invocando a la función de correos
      const email = exp.empresas?.email_contacto;
      if (email) {
        const payload = {
          email: email,
          codigo: exp.codigo,
          razonSocial: exp.empresas?.razon_social || "Empresa",
          tipoNotificacion: "vencimiento"
        };
        
        // Llamar a send-email-notification usando la secret key
        const { error: errEmail } = await supabase.functions.invoke('send-email-notification', {
          body: payload
        });

        if (errEmail) {
          resultados.push({ codigo: exp.codigo, status: 'actualizado_sin_correo', error: errEmail.message });
        } else {
          resultados.push({ codigo: exp.codigo, status: 'vencido_y_notificado' });
        }
      } else {
        resultados.push({ codigo: exp.codigo, status: 'vencido_sin_correo_configurado' });
      }
    }

    return new Response(JSON.stringify({ procesados: resultados.length, detalles: resultados }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
});
