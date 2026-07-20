import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { MercadoPagoConfig, Preference } from "npm:mercadopago@3.2.0";

const MP_ACCESS_TOKEN = Deno.env.get("MP_ACCESS_TOKEN");

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Manejo de CORS (Preflight request)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { razonSocial, tipoTramite, originUrl } = await req.json();

    if (!MP_ACCESS_TOKEN) {
      throw new Error("MP_ACCESS_TOKEN is not set in environment variables");
    }

    // Inicializar SDK de Mercado Pago
    const client = new MercadoPagoConfig({ accessToken: MP_ACCESS_TOKEN });
    const preference = new Preference(client);

    const montoACobrar = 3.00; // Tarifa oficial

    // URL base para el redireccionamiento (el origen desde donde se hizo la petición)
    // Si no se envía originUrl, usamos un fallback a localhost (aunque en prod siempre debería venir)
    const baseUrl = originUrl || 'http://localhost:5173';

    const body = {
      items: [
        {
          id: tipoTramite || 'LIC_FUNC',
          title: 'Tasa por Derecho de Trámite - Licencia MPT',
          description: `Empresa: ${razonSocial}`,
          quantity: 1,
          currency_id: 'PEN',
          unit_price: montoACobrar
        }
      ],
      back_urls: {
        success: `${baseUrl}/solicitud?status=approved`,
        failure: `${baseUrl}/solicitud?status=failure`,
        pending: `${baseUrl}/solicitud?status=pending`
      },
      auto_return: 'approved'
    };

    const result = await preference.create({ body });

    return new Response(JSON.stringify({ id: result.id, init_point: result.init_point }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error('Error al crear preferencia MP:', error);
    return new Response(JSON.stringify({ error: error.message || 'No se pudo crear la preferencia de pago.' }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
