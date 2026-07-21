import jsPDF from 'jspdf';

export const pdfGenerator = {
  generarLicencia: (tramite) => {
    const doc = new jsPDF();
    const empresa = tramite.empresas || {};
    const fechaEmision = new Date(tramite.created_at || new Date());
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
    doc.text(`Estado del Trámite: ${estaVencida ? 'VENCIDO' : 'APROBADO Y VIGENTE'}`, 20, 150);
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
  },

  generarComprobanteSunat: (tramite, empresa, monto, tipoComprobante) => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const isFactura = tipoComprobante === 'Factura';
    const tituloDoc = isFactura ? 'FACTURA ELECTRÓNICA' : 'BOLETA DE VENTA ELECTRÓNICA';
    const numComprobante = isFactura ? `E001-${Math.floor(Math.random() * 9000) + 1000}` : `EB01-${Math.floor(Math.random() * 9000) + 1000}`;
    const rucEmisor = "20146046754"; // RUC MPT (Ejemplo)

    // RECUADRO SUPERIOR DERECHO (RUC Y TIPO DOC)
    doc.setLineWidth(0.5);
    doc.rect(130, 15, 65, 30);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(`RUC: ${rucEmisor}`, 162.5, 22, { align: "center" });
    doc.text(tituloDoc, 162.5, 30, { align: "center" });
    doc.text(numComprobante, 162.5, 38, { align: "center" });

    // DATOS EMISOR (IZQUIERDA)
    doc.setFontSize(12);
    doc.text("MUNICIPALIDAD PROVINCIAL DE TRUJILLO", 15, 20);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("ALMAGRO NRO. 257 (PLAZA DE ARMAS)", 15, 26);
    doc.text("TRUJILLO - TRUJILLO - LA LIBERTAD", 15, 31);

    // DATOS CLIENTE
    const fechaActual = new Date().toLocaleDateString();
    doc.line(15, 50, 195, 50);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("Fecha de Emisión", 15, 60);
    doc.text(": " + fechaActual, 50, 60);
    doc.text("Señor(es)", 15, 67);
    doc.text(": " + (empresa.razonSocial || empresa.razon_social).toUpperCase(), 50, 67);
    doc.text("RUC", 15, 74);
    doc.text(": " + empresa.ruc, 50, 74);
    doc.text("Dirección del Cliente", 15, 81);
    doc.text(": " + (empresa.domicilio_fiscal || 'NO ESPECIFICADO').toUpperCase(), 50, 81);
    doc.text("Tipo de Moneda", 15, 88);
    doc.text(": SOLES", 50, 88);

    doc.line(15, 95, 195, 95);

    // CABECERA TABLA
    doc.setFont("helvetica", "bold");
    doc.text("Cantidad", 15, 102);
    doc.text("Unidad", 35, 102);
    doc.text("Descripción", 55, 102);
    doc.text("V. Unitario", 140, 102, { align: "right" });
    doc.text("Importe Total", 195, 102, { align: "right" });

    doc.line(15, 105, 195, 105);

    // CONTENIDO TABLA
    doc.setFont("helvetica", "normal");
    doc.text("1.00", 25, 115, { align: "right" });
    doc.text("UNIDAD", 35, 115);
    const desc = doc.splitTextToSize(`Tasa por Derecho de Trámite - Licencia (Exp. ${tramite.codigo || 'N/A'})`, 80);
    doc.text(desc, 55, 115);

    // CALCULOS
    // Asumiendo que el monto ya incluye IGV. Monto = Subtotal + IGV -> Subtotal = Monto / 1.18
    const montoTotal = parseFloat(monto);
    const subTotal = montoTotal / 1.18;
    const igv = montoTotal - subTotal;

    doc.text(subTotal.toFixed(2), 140, 115, { align: "right" });
    doc.text(subTotal.toFixed(2), 195, 115, { align: "right" });

    doc.line(15, 130, 195, 130);

    // TOTALES MOLD (PARTE INFERIOR DERECHA)
    doc.rect(130, 135, 65, 30);
    doc.setFont("helvetica", "bold");
    doc.text("Op. Gravada :", 135, 142);
    doc.text("S/", 170, 142);
    doc.text(subTotal.toFixed(2), 190, 142, { align: "right" });
    
    doc.text("IGV (18%) :", 135, 152);
    doc.text("S/", 170, 152);
    doc.text(igv.toFixed(2), 190, 152, { align: "right" });

    doc.text("Importe Total :", 135, 162);
    doc.text("S/", 170, 162);
    doc.text(montoTotal.toFixed(2), 190, 162, { align: "right" });

    // LEYENDA MONTO
    doc.setFontSize(9);
    doc.text(`SON: ${montoTotal.toFixed(2)} Y 00/100 SOLES`, 15, 145);

    // TEXTO FINAL
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.rect(15, 175, 180, 15);
    doc.text(`Esta es una representación impresa de la ${tituloDoc}, generada en el`, 105, 181, { align: "center" });
    doc.text("Sistema de la MPT (SUNAT). Puede verificarla utilizando su clave SOL.", 105, 187, { align: "center" });

    const fileName = isFactura ? `Factura_${empresa.ruc}_${numComprobante}.pdf` : `Boleta_${empresa.ruc}_${numComprobante}.pdf`;
    doc.save(fileName);
  }
};
