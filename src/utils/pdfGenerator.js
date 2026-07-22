import jsPDF from 'jspdf';

const UNIDADES = ['', 'UN ', 'DOS ', 'TRES ', 'CUATRO ', 'CINCO ', 'SEIS ', 'SIETE ', 'OCHO ', 'NUEVE ', 'DIEZ ', 'ONCE ', 'DOCE ', 'TRECE ', 'CATORCE ', 'QUINCE ', 'DIECISEIS ', 'DIECISIETE ', 'DIECIOCHO ', 'DIECINUEVE ', 'VEINTE '];
const DECENAS = ['VENTI', 'TREINTA ', 'CUARENTA ', 'CINCUENTA ', 'SESENTA ', 'SETENTA ', 'OCHENTA ', 'NOVENTA '];
const CENTENAS = ['CIENTO ', 'DOSCIENTOS ', 'TRESCIENTOS ', 'CUATROCIENTOS ', 'QUINIENTOS ', 'SEISCIENTOS ', 'SETECIENTOS ', 'OCHOCIENTOS ', 'NOVECIENTOS '];

function numeroALetras(numero) {
  if (numero === 0) return 'CERO ';
  if (numero === 100) return 'CIEN ';
  let letras = '';
  if (numero >= 100) {
    letras += CENTENAS[Math.floor(numero / 100) - 1];
    numero = numero % 100;
  }
  if (numero > 20 && numero < 30) {
    letras += DECENAS[0] + UNIDADES[numero % 10];
  } else if (numero >= 30) {
    letras += DECENAS[Math.floor(numero / 10) - 2];
    if (numero % 10 > 0) letras += 'Y ' + UNIDADES[numero % 10];
  } else if (numero > 0) {
    letras += UNIDADES[numero];
  }
  return letras.trim();
}

function montoALetras(monto) {
  const entero = Math.floor(monto);
  const decimales = Math.round((monto - entero) * 100);
  return `${numeroALetras(entero)} Y ${decimales.toString().padStart(2, '0')}/100`;
}

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
    const rucEmisor = "20175639391";
    
    doc.setFont("helvetica");
    
    // RECUADRO SUPERIOR DERECHO (RUC Y TIPO DOC)
    doc.setLineWidth(0.3);
    doc.rect(130, 10, 70, 25);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(tituloDoc, 165, 17, { align: "center" });
    doc.text(`RUC: ${rucEmisor}`, 165, 24, { align: "center" });
    doc.text(numComprobante, 165, 31, { align: "center" });

    // DATOS EMISOR (IZQUIERDA)
    doc.setFontSize(10);
    doc.text("MUNICIPALIDAD PROVINCIAL DE TRUJILLO", 10, 15);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text("JR. ALMAGRO NRO. 525 LA LIBERTAD", 10, 20);
    doc.text("TRUJILLO - TRUJILLO", 10, 25);

    doc.line(10, 38, 200, 38);

    // DATOS CLIENTE
    const fechaActual = new Date().toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    doc.setFontSize(8);
    
    doc.text("Fecha de Vencimiento", 10, 44);
    doc.text(":", 40, 44);
    
    doc.text("Fecha de Emisión", 10, 49);
    doc.text(`: ${fechaActual}`, 40, 49);
    
    doc.text("Señor(es)", 10, 54);
    
    const razonSocial = (empresa.razonSocial || empresa.razon_social || '').toUpperCase();
    const splitRazon = doc.splitTextToSize(`: ${razonSocial}`, 150);
    doc.text(splitRazon, 40, 54);
    
    let yOffset = 54 + (splitRazon.length * 4);
    
    if (isFactura) {
      doc.text("RUC", 10, yOffset);
      doc.text(`: ${empresa.ruc || ''}`, 40, yOffset);
      yOffset += 5;
      
      doc.text("Dirección del Cliente", 10, yOffset);
      const dirSplit = doc.splitTextToSize(`: ${(empresa.domicilio_fiscal || 'NO ESPECIFICADA').toUpperCase()}`, 150);
      doc.text(dirSplit, 40, yOffset);
      yOffset += (dirSplit.length * 4);
    }
    
    doc.text("Tipo de Moneda", 10, yOffset);
    doc.text(": SOLES", 40, yOffset);
    yOffset += 5;
    
    doc.text("Observación", 10, yOffset);
    doc.text(":", 40, yOffset);
    yOffset += 7;

    // CALCULOS
    const montoTotal = parseFloat(monto) || 3.00;
    const subTotal = montoTotal / 1.18;
    const igv = montoTotal - subTotal;
    
    // TABLA
    doc.setFont("helvetica", "bold");
    if (!isFactura) {
      // BOLETA HEADERS
      doc.text("Cantidad", 10, yOffset + 5);
      doc.text("Unidad", 28, yOffset + 3);
      doc.text("Medida", 28, yOffset + 7);
      doc.text("Descripción", 48, yOffset + 5);
      doc.text("Valor", 125, yOffset + 3);
      doc.text("Unitario(*)", 125, yOffset + 7);
      doc.text("Descuento(*)", 148, yOffset + 5);
      doc.text("Importe de", 172, yOffset + 3);
      doc.text("Venta(**)", 172, yOffset + 7);
      doc.text("ICBPER", 190, yOffset + 5);
      
      yOffset += 12;
      doc.setFont("helvetica", "normal");
      doc.text("1.00", 22, yOffset, { align: "right" });
      doc.text("UNIDAD", 28, yOffset);
      const desc = doc.splitTextToSize(`TASA POR DERECHO DE TRÁMITE - LICENCIA (EXP. ${tramite.codigo || 'N/A'})`, 70);
      doc.text(desc, 48, yOffset);
      doc.text(subTotal.toFixed(2), 140, yOffset, { align: "right" });
      doc.text("0.00", 165, yOffset, { align: "right" });
      doc.text(montoTotal.toFixed(2), 185, yOffset, { align: "right" });
      doc.text("0.00", 200, yOffset, { align: "right" });
      
      yOffset += (desc.length * 4) + 10;
      
      doc.text("Otros Cargos :", 145, yOffset, { align: "right" });
      doc.text("S/ 0.00", 200, yOffset, { align: "right" });
      yOffset += 5;
      doc.text("Otros", 145, yOffset, { align: "right" });
      yOffset += 4;
      doc.text("Tributos :", 145, yOffset, { align: "right" });
      doc.text("S/ 0.00", 200, yOffset - 2, { align: "right" });
      yOffset += 4;
      
      doc.text("ICBPER :", 145, yOffset, { align: "right" });
      doc.rect(147, yOffset - 3, 54, 4);
      doc.text("S/ 0.00", 200, yOffset, { align: "right" });
      yOffset += 5;
      
      doc.text("Importe Total :", 145, yOffset, { align: "right" });
      doc.text(`S/ ${montoTotal.toFixed(2)}`, 200, yOffset, { align: "right" });
      yOffset += 4;

      doc.line(10, yOffset, 200, yOffset);
      yOffset += 6;

      doc.setFont("helvetica", "bold");
      const montoLetras = montoALetras(montoTotal);
      doc.text(`SON: ${montoLetras} SOLES`, 200, yOffset, { align: "right" });
      
      doc.setFont("helvetica", "normal");
      doc.text("(*) Sin impuestos.", 10, yOffset + 5);
      doc.text("(**) Incluye impuestos, de ser Op. Gravada.", 10, yOffset + 10);
      
      doc.text("Op. Gravada :", 145, yOffset + 6, { align: "right" });
      doc.rect(147, yOffset + 3, 54, 4);
      doc.text(`S/ ${subTotal.toFixed(2)}`, 200, yOffset + 6, { align: "right" });
      
      doc.text("Op. Exonerada :", 145, yOffset + 11, { align: "right" });
      doc.rect(147, yOffset + 8, 54, 4);
      doc.text("S/ 0.00", 200, yOffset + 11, { align: "right" });
      
      doc.text("Op. Inafecta :", 145, yOffset + 16, { align: "right" });
      doc.rect(147, yOffset + 13, 54, 4);
      doc.text("S/ 0.00", 200, yOffset + 16, { align: "right" });
      
      doc.text("ISC :", 145, yOffset + 21, { align: "right" });
      doc.rect(147, yOffset + 18, 54, 4);
      doc.text("S/ 0.00", 200, yOffset + 21, { align: "right" });
      
      doc.text("IGV :", 145, yOffset + 26, { align: "right" });
      doc.rect(147, yOffset + 23, 54, 4);
      doc.text(`S/ ${igv.toFixed(2)}`, 200, yOffset + 26, { align: "right" });
      
      doc.text("ICBPER :", 145, yOffset + 31, { align: "right" });
      doc.rect(147, yOffset + 28, 54, 4);
      doc.text("S/ 0.00", 200, yOffset + 31, { align: "right" });
      
      doc.text("Otros Cargos :", 145, yOffset + 36, { align: "right" });
      doc.rect(147, yOffset + 33, 54, 4);
      doc.text("S/ 0.00", 200, yOffset + 36, { align: "right" });
      
      doc.text("Otros Tributos :", 145, yOffset + 41, { align: "right" });
      doc.rect(147, yOffset + 38, 54, 4);
      doc.text("S/ 0.00", 200, yOffset + 41, { align: "right" });
      
      doc.text("Importe Total :", 145, yOffset + 46, { align: "right" });
      doc.rect(147, yOffset + 43, 54, 4);
      doc.text(`S/ ${montoTotal.toFixed(2)}`, 200, yOffset + 46, { align: "right" });
      
      yOffset += 52;
      
    } else {
      // FACTURA HEADERS
      doc.text("Cantidad", 10, yOffset + 5);
      doc.text("Unidad Medida", 25, yOffset + 5);
      doc.text("Código", 55, yOffset + 5);
      doc.text("Descripción", 75, yOffset + 5);
      doc.text("Valor Unitario", 200, yOffset + 5, { align: "right" });
      
      doc.setLineWidth(0.3);
      doc.rect(10, yOffset + 1, 190, 6);
      
      yOffset += 12;
      doc.setFont("helvetica", "normal");
      doc.text("1.00", 22, yOffset, { align: "right" });
      doc.text("UNIDAD", 25, yOffset);
      doc.text("LIC01", 55, yOffset);
      const desc = doc.splitTextToSize(`TASA POR DERECHO DE TRÁMITE - LICENCIA (EXP. ${tramite.codigo || 'N/A'})`, 100);
      doc.text(desc, 75, yOffset);
      doc.text(subTotal.toFixed(2), 200, yOffset, { align: "right" });
      
      yOffset += (desc.length * 4) + 15;
      
      // Bottom Factura
      doc.text("Valor de Venta de Operaciones Gratuitas :", 10, yOffset);
      doc.rect(70, yOffset - 3, 50, 4);
      doc.text("S/ 0.00", 72, yOffset);
      
      // Right Factura Totals
      doc.text("Sub Total", 145, yOffset - 5, { align: "right" });
      doc.text("Ventas", 145, yOffset - 1, { align: "right" });
      doc.text(":", 148, yOffset - 3);
      doc.rect(150, yOffset - 6, 50, 5);
      doc.text(`S/ ${subTotal.toFixed(2)}`, 198, yOffset - 3, { align: "right" });
      
      yOffset += 4;
      doc.text("Anticipos :", 148, yOffset, { align: "right" });
      doc.rect(150, yOffset - 3, 50, 4);
      doc.text("S/ 0.00", 198, yOffset, { align: "right" });
      
      yOffset += 4;
      doc.text("Descuentos :", 148, yOffset, { align: "right" });
      doc.rect(150, yOffset - 3, 50, 4);
      doc.text("S/ 0.00", 198, yOffset, { align: "right" });
      
      yOffset += 4;
      doc.text("Valor Venta :", 148, yOffset, { align: "right" });
      doc.rect(150, yOffset - 3, 50, 5);
      doc.text(`S/ ${subTotal.toFixed(2)}`, 198, yOffset, { align: "right" });
      
      yOffset += 5;
      doc.text("ISC :", 148, yOffset, { align: "right" });
      doc.rect(150, yOffset - 3, 50, 4);
      doc.text("S/ 0.00", 198, yOffset, { align: "right" });
      
      yOffset += 4;
      doc.text("IGV :", 148, yOffset, { align: "right" });
      doc.rect(150, yOffset - 3, 50, 4);
      doc.text(`S/ ${igv.toFixed(2)}`, 198, yOffset, { align: "right" });
      
      yOffset += 4;
      doc.text("Otros Cargos :", 148, yOffset, { align: "right" });
      doc.rect(150, yOffset - 3, 50, 4);
      doc.text("S/ 0.00", 198, yOffset, { align: "right" });
      
      yOffset += 4;
      doc.text("Otros", 145, yOffset, { align: "right" });
      yOffset += 3;
      doc.text("Tributos", 145, yOffset, { align: "right" });
      doc.text(":", 148, yOffset - 1);
      doc.rect(150, yOffset - 6, 50, 6);
      doc.text("S/ 0.00", 198, yOffset - 1, { align: "right" });
      
      yOffset += 6;
      doc.text("Importe", 145, yOffset, { align: "right" });
      yOffset += 3;
      doc.text("Total", 145, yOffset, { align: "right" });
      doc.text(":", 148, yOffset - 1);
      doc.rect(150, yOffset - 6, 50, 6);
      doc.text(`S/ ${montoTotal.toFixed(2)}`, 198, yOffset - 1, { align: "right" });
      
      // SON
      doc.setFont("helvetica", "bold");
      const montoLetras = montoALetras(montoTotal);
      doc.text(`SON: ${montoLetras} SOLES`, 10, yOffset - 25);
      
      yOffset += 5;
    }
    
    // TEXTO INFERIOR
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.rect(10, yOffset, 190, 8);
    doc.text(`Esta es una representación impresa de la ${tituloDoc.toLowerCase()}, generada en el Sistema de la SUNAT. El`, 105, yOffset + 3.5, { align: "center" });
    doc.text("Emisor Electrónico puede verificarla utilizando su clave SOL.", 105, yOffset + 6.5, { align: "center" });

    const fileName = isFactura ? `Factura_${empresa.ruc}_${numComprobante}.pdf` : `Boleta_${empresa.ruc}_${numComprobante}.pdf`;
    
    // Guardar localmente
    doc.save(fileName);
    
    // Retornar base64 para envío por correo
    const base64String = doc.output('datauristring').split(',')[1];
    return base64String;
  },

  generarTicketZ: (caja) => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [80, 200]
    });

    let y = 10;
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("TICKET Z - CIERRE", 40, y, { align: "center" });
    
    y += 8;
    doc.setFontSize(10);
    doc.text("MUNICIPALIDAD PROV. DE TRUJILLO", 40, y, { align: "center" });
    
    y += 10;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    
    const fApertura = new Date(caja.fecha_apertura).toLocaleString();
    const fCierre = new Date(caja.fecha_cierre).toLocaleString();

    doc.text(`ID Turno: ${caja.id.split('-')[0].toUpperCase()}`, 5, y);
    y += 5;
    doc.text(`Apertura: ${fApertura}`, 5, y);
    y += 5;
    doc.text(`Cierre: ${fCierre}`, 5, y);
    
    y += 5;
    doc.line(5, y, 75, y);
    
    y += 6;
    doc.setFont("helvetica", "bold");
    doc.text("DETALLE DE INGRESOS", 5, y);
    doc.setFont("helvetica", "normal");
    y += 5;
    doc.text(`Fondo Inicial: S/ ${(caja.monto_inicial || 0).toFixed(2)}`, 5, y);
    y += 5;
    doc.text(`Cobros Efectivo: S/ ${(caja.totalEfectivo || 0).toFixed(2)}`, 5, y);
    y += 5;
    doc.text(`Cobros Yape/Tarjeta: S/ ${(caja.totalYape || 0).toFixed(2)}`, 5, y);
    
    y += 5;
    doc.line(5, y, 75, y);
    
    y += 6;
    doc.setFont("helvetica", "bold");
    const esperado = (caja.monto_inicial || 0) + (caja.totalEfectivo || 0);
    const fisico = caja.monto_fisico || 0;
    const diferencia = fisico - esperado;
    
    doc.text(`TOTAL ESPERADO: S/ ${esperado.toFixed(2)}`, 5, y);
    y += 5;
    doc.text(`TOTAL FISICO (Declarado): S/ ${fisico.toFixed(2)}`, 5, y);
    
    y += 7;
    doc.setFontSize(11);
    if (diferencia === 0) {
      doc.text("CUADRE PERFECTO", 40, y, { align: "center" });
    } else if (diferencia > 0) {
      doc.text(`SOBRANTE: S/ ${diferencia.toFixed(2)}`, 40, y, { align: "center" });
    } else {
      doc.text(`FALTANTE: S/ ${Math.abs(diferencia).toFixed(2)}`, 40, y, { align: "center" });
    }
    
    y += 10;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.line(5, y, 75, y);
    y += 20;
    
    doc.line(15, y, 65, y);
    y += 5;
    doc.text("Firma del Cajero", 40, y, { align: "center" });
    
    y += 20;
    doc.line(15, y, 65, y);
    y += 5;
    doc.text("Firma de Tesorería", 40, y, { align: "center" });

    doc.save(`Ticket_Z_${caja.id.split('-')[0]}.pdf`);
  }
};
