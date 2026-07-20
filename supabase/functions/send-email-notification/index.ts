import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { email, codigo, razonSocial, fechaVisita, esExpress } = await req.json();

    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not set in environment variables");
    }

    let subject = "";
    let htmlContent = "";

    if (esExpress) {
      subject = `¡Licencia Renovada Exitosamente! - Expediente ${codigo}`;
      htmlContent = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
          <div style="background-color: #1e3a8a; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0; font-size: 24px;">Municipalidad Provincial de Trujillo</h1>
            <p style="margin: 5px 0 0 0; font-size: 14px; opacity: 0.9;">Sistema de Licencias de Funcionamiento</p>
          </div>
          <div style="padding: 30px; background-color: #ffffff;">
            <h2 style="color: #0f172a; margin-top: 0;">¡Trámite de Renovación Aprobado!</h2>
            <p style="color: #475569; font-size: 16px; line-height: 1.5;">Estimado(a) contribuyente de <strong>${razonSocial}</strong>,</p>
            <p style="color: #475569; font-size: 16px; line-height: 1.5;">Le informamos que su solicitud de renovación automática express ha sido aprobada con éxito.</p>
            
            <div style="background-color: #f8fafc; border-left: 4px solid #10b981; padding: 15px; margin: 25px 0;">
              <p style="margin: 0; color: #0f172a; font-weight: bold; font-size: 14px; text-transform: uppercase;">Código de Expediente</p>
              <p style="margin: 5px 0 0 0; color: #1e3a8a; font-family: monospace; font-size: 24px; font-weight: bold;">${codigo}</p>
            </div>

            <p style="color: #475569; font-size: 16px; line-height: 1.5;">Ya puede ingresar al portal virtual para descargar su Certificado de Licencia actualizado.</p>
          </div>
          <div style="background-color: #f1f5f9; padding: 15px; text-align: center; color: #64748b; font-size: 12px;">
            <p style="margin: 0;">Este es un mensaje automático, por favor no responda a este correo.</p>
          </div>
        </div>
      `;
    } else {
      subject = `Inspección Programada - Expediente ${codigo}`;
      htmlContent = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
          <div style="background-color: #1e3a8a; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0; font-size: 24px;">Municipalidad Provincial de Trujillo</h1>
            <p style="margin: 5px 0 0 0; font-size: 14px; opacity: 0.9;">Sistema de Licencias de Funcionamiento</p>
          </div>
          <div style="padding: 30px; background-color: #ffffff;">
            <h2 style="color: #0f172a; margin-top: 0;">Registro de Trámite Exitoso</h2>
            <p style="color: #475569; font-size: 16px; line-height: 1.5;">Estimado(a) contribuyente de <strong>${razonSocial}</strong>,</p>
            <p style="color: #475569; font-size: 16px; line-height: 1.5;">Hemos registrado su solicitud de licencia de funcionamiento. Se ha generado su expediente y se ha programado una visita de inspección técnica a su local.</p>
            
            <div style="background-color: #f8fafc; border-left: 4px solid #3b82f6; padding: 15px; margin: 25px 0;">
              <p style="margin: 0; color: #0f172a; font-weight: bold; font-size: 14px; text-transform: uppercase;">Código de Expediente</p>
              <p style="margin: 5px 0 0 0; color: #1e3a8a; font-family: monospace; font-size: 24px; font-weight: bold;">${codigo}</p>
            </div>

            <div style="background-color: #fff7ed; border-left: 4px solid #f97316; padding: 15px; margin: 25px 0;">
              <p style="margin: 0; color: #9a3412; font-weight: bold; font-size: 14px; text-transform: uppercase;">Fecha de Inspección Programada</p>
              <p style="margin: 5px 0 0 0; color: #c2410c; font-size: 18px; font-weight: bold;">${fechaVisita}</p>
            </div>

            <p style="color: #475569; font-size: 16px; line-height: 1.5;">Por favor, asegúrese de que el representante legal o propietario se encuentre en el local en la fecha indicada.</p>
          </div>
          <div style="background-color: #f1f5f9; padding: 15px; text-align: center; color: #64748b; font-size: 12px;">
            <p style="margin: 0;">Este es un mensaje automático, por favor no responda a este correo.</p>
          </div>
        </div>
      `;
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Municipalidad de Trujillo <onboarding@resend.dev>",
        to: [email],
        subject: subject,
        html: htmlContent,
      }),
    });

    const data = await res.json();

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
