import jsPDF from 'jspdf';

export const pdfGenerator = {
  generarLicencia: (tramite) => {
    const doc = new jsPDF();
    const empresa = tramite.empresas || {};
    const fechaEmision = new Date(tramite.fecha_creacion || new Date());
    const fechaVencimiento = new Date(fechaEmision);
    fechaVencimiento.setFullYear(fechaEmision.getFullYear() + 1);
    
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
  }
};
