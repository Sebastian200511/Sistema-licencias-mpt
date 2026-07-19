import jsPDF from 'jspdf';

export const pdfGenerator = {
  generarLicencia: (tramite) => {
    const doc = new jsPDF();
    const empresa = tramite.empresas || {};
    const fechaEmision = new Date(tramite.fecha_creacion || new Date());
    const fechaVencimiento = tramite.fecha_vencimiento 
      ? new Date(`${tramite.fecha_vencimiento}T23:59:59`) 
      : (() => { const d = new Date(fechaEmision); d.setFullYear(d.getFullYear() + 1); return d; })();
    
    const estaVencida = new Date() > fechaVencimiento;

    if (estaVencida) {
      doc.setTextColor(200, 200, 200);
      doc.setFontSize(80);
      doc.text("VENCIDA", 50, 150, { angle: 45 });
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(30, 58, 138); 
    doc.text("MUNICIPALIDAD PROVINCIAL DE TRUJILLO", 105, 30, { align: "center" });
    
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text("LICENCIA DE FUNCIONAMIENTO DEFINITIVA", 105, 40, { align: "center" });
    
    doc.line(20, 45, 190, 45); 

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    
    doc.text(`N° Expediente: ${tramite.codigo}`, 20, 60);
    doc.text(`Fecha de Emisión: ${fechaEmision.toLocaleDateString()}`, 130, 60);
    
    doc.setFont("helvetica", "bold");
    doc.text("DATOS DEL TITULAR Y ESTABLECIMIENTO", 20, 80);
    
    doc.setFont("helvetica", "normal");
    doc.text(`Razón Social: ${empresa.razon_social || ''}`, 20, 95);
    doc.text(`RUC: ${empresa.ruc || ''}`, 20, 105);
    doc.text(`Domicilio Fiscal: ${empresa.domicilio_fiscal || ''}`, 20, 115);
    
    doc.setFont("helvetica", "bold");
    doc.text("DATOS DE LA LICENCIA", 20, 135);
    
    doc.setFont("helvetica", "normal");
    doc.text(`Estado del Trámite: APROBADO Y VIGENTE`, 20, 150);
    doc.text(`Válido hasta: ${fechaVencimiento.toLocaleDateString()}`, 20, 160);

    doc.setLineWidth(0.5);
    doc.rect(20, 175, 170, 30);
    doc.setFontSize(10);
    doc.text("NOTA IMPORTANTE:", 25, 182);
    doc.setFontSize(9);
    doc.text("Este documento es generado electrónicamente y tiene validez legal bajo la firma", 25, 190);
    doc.text("del cuerpo técnico de inspectores y recaudadores de la MPT. Debe exhibirse.", 25, 198);

    doc.save(`Licencia_MPT_${tramite.codigo}.pdf`);
  },

  generarTicketPago: (resultado, empresa, monto, metodoPago) => {
    // Ticket format (e.g. 80mm roll, so ~80x150 mm)
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [80, 150]
    });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("MUNICIPALIDAD DE TRUJILLO", 40, 15, { align: "center" });
    
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text("TICKET DE PAGO - CAJA", 40, 20, { align: "center" });
    doc.text("------------------------------------------------", 40, 25, { align: "center" });

    doc.text(`FECHA: ${new Date().toLocaleString()}`, 5, 35);
    doc.text(`N° EXPEDIENTE: ${resultado.codigo}`, 5, 42);
    
    doc.text("DATOS DEL CONTRIBUYENTE:", 5, 52);
    doc.setFont("helvetica", "bold");
    doc.text(`RUC: ${empresa.ruc}`, 5, 58);
    
    // Split long reason social
    const splitRazon = doc.splitTextToSize(`RAZON SOCIAL: ${empresa.razonSocial}`, 70);
    doc.text(splitRazon, 5, 64);
    
    const nextY = 64 + (splitRazon.length * 4) + 5;
    doc.setFont("helvetica", "normal");
    doc.text("------------------------------------------------", 40, nextY, { align: "center" });
    
    doc.setFont("helvetica", "bold");
    doc.text("CONCEPTO:", 5, nextY + 8);
    doc.setFont("helvetica", "normal");
    doc.text("Tasa por Derecho de Trámite", 5, nextY + 14);
    
    doc.text("MÉTODO DE PAGO:", 5, nextY + 22);
    doc.setFont("helvetica", "bold");
    doc.text(metodoPago.toUpperCase(), 35, nextY + 22);

    doc.setFontSize(10);
    doc.text("TOTAL PAGADO:", 5, nextY + 32);
    doc.text(`S/ ${monto.toFixed(2)}`, 45, nextY + 32);

    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text("Conserve este comprobante.", 40, nextY + 45, { align: "center" });
    doc.text("Puede consultar el estado de su", 40, nextY + 49, { align: "center" });
    doc.text("trámite en nuestro portal web.", 40, nextY + 53, { align: "center" });

    doc.save(`Ticket_${resultado.codigo}.pdf`);
  }
};
