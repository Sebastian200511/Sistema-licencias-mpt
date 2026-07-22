import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import nodemailer from "npm:nodemailer@6.9.9";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { tipoNotificacion, email, codigo, razonSocial, fechaVisita, observaciones, esExpress, tipoComprobante, adjuntoBase64, adjuntoUrl } = body;

    let subject = "";
    let htmlContent = "";
    let destinatarios = [email]; // Por defecto al negocio

    const emailInspector = "soporte.starview@gmail.com";

    // Manejar retrocompatibilidad si no mandan tipoNotificacion
    const tipoReal = tipoNotificacion || (esExpress ? 'renovacion_express' : 'nueva_inspeccion');

    if (tipoReal === 'comprobante_pago') {
      subject = `${tipoComprobante || 'Comprobante'} Electrónico - Expediente ${codigo}`;
      htmlContent = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
          <div style="background-color: #1e3a8a; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0; font-size: 24px;">Municipalidad Provincial de Trujillo</h1>
            <p style="margin: 5px 0 0 0; font-size: 14px; opacity: 0.9;">Emisión de Comprobante de Pago</p>
          </div>
          <div style="padding: 30px; background-color: #ffffff;">
            <h2 style="color: #0f172a; margin-top: 0;">¡Hola, ${razonSocial}!</h2>
            <p style="color: #475569; font-size: 16px; line-height: 1.5;">Hemos procesado el pago de su trámite de licencia (Expediente: <strong>${codigo}</strong>) exitosamente.</p>
            
            <div style="background-color: #f8fafc; border-left: 4px solid #10b981; padding: 15px; margin: 25px 0;">
              <p style="margin: 0; color: #0f172a; font-weight: bold; font-size: 14px; text-transform: uppercase;">Detalle del Comprobante</p>
              <p style="margin: 5px 0 0 0; color: #1e3a8a; font-family: monospace; font-size: 16px;"><strong>Documento:</strong> ${tipoComprobante || 'Comprobante'} Electrónico</p>
              <p style="margin: 5px 0 0 0; color: #1e3a8a; font-family: monospace; font-size: 16px;"><strong>Importe Total:</strong> S/ 3.00</p>
              <p style="margin: 5px 0 0 0; color: #1e3a8a; font-family: monospace; font-size: 16px;"><strong>Concepto:</strong> Tasa Administrativa</p>
            </div>
            
            ${adjuntoUrl ? `<div style="text-align: center; margin: 25px 0;">
              <a href="${adjuntoUrl}" style="background-color: #1e3a8a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Descargar Comprobante PDF</a>
            </div>` : ''}
            
            <p style="color: #475569; font-size: 14px; line-height: 1.5;"><em>* El comprobante oficial PDF le fue entregado en ventanilla por nuestro cajero${adjuntoUrl ? ' (y puede descargarlo en el botón de arriba)' : ''}. Si desea una copia digital, ingrese al portal de la MPT con su clave SOL.</em></p>
          </div>
          <div style="background-color: #f1f5f9; padding: 15px; text-align: center; color: #64748b; font-size: 12px;">
            <p style="margin: 0;">Este es un mensaje automático generado por el Sistema de Licencias MPT.</p>
          </div>
        </div>
      `;
    } else if (tipoReal === 'renovacion_express') {
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
    } else if (tipoReal === 'nueva_inspeccion') {
      // ✅ Enviar al negocio y al inspector
      if (emailInspector) destinatarios.push(emailInspector); 
      
      subject = `Nueva Inspección Programada - Expediente ${codigo}`;
      htmlContent = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
          <div style="background-color: #1e3a8a; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0; font-size: 24px;">Municipalidad Provincial de Trujillo</h1>
          </div>
          <div style="padding: 30px; background-color: #ffffff;">
            <h2 style="color: #0f172a; margin-top: 0;">Inspección Técnica Programada</h2>
            <p style="color: #475569; font-size: 16px;">Se ha programado una nueva inspección para el local de <strong>${razonSocial}</strong>.</p>
            
            <div style="background-color: #f8fafc; border-left: 4px solid #3b82f6; padding: 15px; margin: 25px 0;">
              <p style="margin: 0; font-weight: bold; font-size: 14px;">Código de Expediente</p>
              <p style="margin: 5px 0 0 0; color: #1e3a8a; font-size: 20px; font-weight: bold;">${codigo}</p>
            </div>

            <div style="background-color: #fff7ed; border-left: 4px solid #f97316; padding: 15px; margin: 25px 0;">
              <p style="margin: 0; color: #9a3412; font-weight: bold; font-size: 14px;">Fecha de Visita</p>
              <p style="margin: 5px 0 0 0; color: #c2410c; font-size: 18px; font-weight: bold;">${fechaVisita}</p>
            </div>
            
            <p style="color: #475569; font-size: 14px;">* Al negocio: Asegúrese de estar presente en la fecha indicada.<br/>* Al inspector: Revise su agenda en el sistema.</p>
          </div>
        </div>
      `;
    } else if (tipoReal === 'observacion') {
      destinatarios.push(emailInspector);
      subject = `URGENTE: Observaciones en su Local - Expediente ${codigo}`;
      htmlContent = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
          <div style="background-color: #b91c1c; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0; font-size: 24px;">Municipalidad Provincial de Trujillo</h1>
          </div>
          <div style="padding: 30px; background-color: #ffffff;">
            <h2 style="color: #b91c1c; margin-top: 0;">Local Observado por Inspector</h2>
            <p style="color: #475569; font-size: 16px;">Estimado(a) representante de <strong>${razonSocial}</strong>,</p>
            <p style="color: #475569; font-size: 16px;">Durante la inspección de hoy, nuestro personal técnico ha registrado las siguientes observaciones de seguridad que deben ser subsanadas:</p>
            
            <div style="background-color: #fef2f2; border: 1px solid #fca5a5; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <p style="margin: 0; color: #991b1b; font-family: monospace;">${observaciones}</p>
            </div>

            <p style="color: #475569; font-size: 16px;">Se ha programado una segunda y última visita de inspección para verificar la subsanación:</p>
            
            <div style="background-color: #f8fafc; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0;">
              <p style="margin: 0; font-weight: bold;">NUEVA FECHA DE INSPECCIÓN: <span style="color: #2563eb; font-size: 18px;">${fechaVisita}</span></p>
            </div>
          </div>
        </div>
      `;
    } else if (tipoReal === 'vencimiento') {
      subject = `AVISO: Licencia Vencida - Expediente ${codigo}`;
      htmlContent = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
          <div style="background-color: #c2410c; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0; font-size: 24px;">Municipalidad Provincial de Trujillo</h1>
          </div>
          <div style="padding: 30px; background-color: #ffffff;">
            <h2 style="color: #c2410c; margin-top: 0;">Licencia de Funcionamiento Caducada</h2>
            <p style="color: #475569; font-size: 16px;">Estimado(a) contribuyente de <strong>${razonSocial}</strong>,</p>
            <p style="color: #475569; font-size: 16px;">Le notificamos formalmente que la vigencia de su Licencia de Funcionamiento (Expediente ${codigo}) <strong>ha expirado</strong>.</p>
            
            <p style="color: #475569; font-size: 16px;">Por favor, inicie su proceso de renovación inmediatamente a través de nuestra plataforma virtual para evitar multas o clausuras.</p>
          </div>
        </div>
      `;
    } else if (tipoReal === 'aprobado') {
      subject = `¡Licencia Aprobada! - Expediente ${codigo}`;
      htmlContent = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
          <div style="background-color: #15803d; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0; font-size: 24px;">Municipalidad Provincial de Trujillo</h1>
          </div>
          <div style="padding: 30px; background-color: #ffffff;">
            <h2 style="color: #15803d; margin-top: 0;">Resolución de Aprobación Emitida</h2>
            <p style="color: #475569; font-size: 16px;">Estimado(a) representante de <strong>${razonSocial}</strong>,</p>
            <p style="color: #475569; font-size: 16px;">Nos complace informarle que su trámite (Expediente: <strong>${codigo}</strong>) ha concluido satisfactoriamente tras la evaluación técnica.</p>
            <p style="color: #475569; font-size: 16px;">Ya puede descargar su <strong>Certificado de Licencia de Funcionamiento</strong> desde nuestro portal web ingresando su código.</p>
          </div>
        </div>
      `;
    } else if (tipoReal === 'rechazado') {
      subject = `Resolución de Rechazo Definitivo - Expediente ${codigo}`;
      htmlContent = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
          <div style="background-color: #1e293b; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0; font-size: 24px;">Municipalidad Provincial de Trujillo</h1>
          </div>
          <div style="padding: 30px; background-color: #ffffff;">
            <h2 style="color: #1e293b; margin-top: 0;">Trámite Rechazado o Denegado</h2>
            <p style="color: #475569; font-size: 16px;">Estimado(a) representante de <strong>${razonSocial}</strong>,</p>
            <p style="color: #475569; font-size: 16px;">Lamentamos informarle que su trámite (Expediente: <strong>${codigo}</strong>) ha sido <strong>Rechazado o Denegado Definitivamente</strong> por no subsanar las observaciones técnicas en el plazo o por incumplir normas vigentes de seguridad.</p>
            <p style="color: #475569; font-size: 16px;">Cualquier consulta puede acercarse a mesa de partes de la municipalidad.</p>
          </div>
        </div>
      `;
    }

    // === CONFIGURACIÓN DE NODEMAILER (GMAIL) ===
    const GMAIL_USER = Deno.env.get("GMAIL_USER");
    const GMAIL_PASS = Deno.env.get("GMAIL_APP_PASSWORD");

    if (!GMAIL_USER || !GMAIL_PASS) {
      throw new Error("Las variables GMAIL_USER o GMAIL_APP_PASSWORD no están configuradas.");
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: GMAIL_USER,
        pass: GMAIL_PASS,
      },
    });

    const mailOptions: any = {
      from: `"Municipalidad de Trujillo" <${GMAIL_USER}>`,
      to: destinatarios.join(", "),
      subject: subject,
      html: htmlContent,
    };

    if (adjuntoBase64) {
      mailOptions.attachments = [
        {
          filename: `${tipoComprobante || 'Comprobante'}_MPT_${codigo}.pdf`,
          content: adjuntoBase64,
          encoding: 'base64'
        }
      ];
    }

    const info = await transporter.sendMail(mailOptions);

    return new Response(JSON.stringify({ success: true, messageId: info.messageId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("Error en function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
