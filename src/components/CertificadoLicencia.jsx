import React from 'react';
import { Building, Award, CheckCircle } from 'lucide-react';

const CertificadoLicencia = ({ datosLicencia = {} }) => {
  // Ahora extraemos los datos directamente de las props, usando '-' como respaldo si vienen vacíos
  const {
    razonSocial = '-',
    ruc = '-',
    representanteLegal = '-',
    dniRepresentante = '-',
    nombreComercial = '-',
    direccionLocal = '-',
    codigoCatastral = '-',
    giro = '-',
    zonificacion = '-',
    area = '-',
    horarioAtencion = '-',
    codigoExpediente = '-',
    numeroLicencia = '-'
  } = datosLicencia;

  const fechaActual = new Date().toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  return (
    <div className="flex justify-center items-center p-10 bg-gray-100 min-h-screen">
      {/* Contenedor del certificado, simulando tamaño A4 */}
      <div className="bg-white p-16 w-[21cm] h-[29.7cm] shadow-2xl relative border-4 border-double border-gray-300 font-serif text-gray-800">
        
        {/* Encabezado */}
        <div className="border-b-2 border-gray-300 pb-6 mb-8 relative">
          <div className="flex justify-between items-center px-4">
            {/* Escudo Izquierda */}
            <div className="w-24 h-24 border border-gray-300 flex items-center justify-center bg-gray-100 rounded-full">
              <Building className="w-12 h-12 text-gray-400" />
            </div>

            {/* Texto Central */}
            <div className="text-center flex-1 mx-8 font-sans">
              <h1 className="text-2xl font-bold tracking-tight mb-2">MUNICIPALIDAD PROVINCIAL DE TRUJILLO</h1>
              <p className="text-sm font-medium mb-1">GERENCIA DE DESARROLLO ECONÓMICO LOCAL</p>
              <p className="text-xs text-gray-600 mb-6">Subgerencia de Licencias y Comercialización</p>
              
              <h2 className="text-3xl font-extrabold text-blue-950 tracking-tighter mb-4">LICENCIA DE FUNCIONAMIENTO</h2>
              
              <div className="flex justify-center gap-6 text-sm">
                <p className="font-bold">Nro. <span className="text-lg font-mono text-blue-900">{numeroLicencia}</span> — {new Date().getFullYear()} MPT-GDEL-SGL</p>
                <p className="font-bold">Ley Nro. 28976</p>
              </div>
            </div>

            {/* Escudo Derecha */}
            <div className="w-24 h-24 border border-gray-300 flex items-center justify-center bg-gray-100 rounded-full">
              <Award className="w-12 h-12 text-gray-400" />
            </div>
          </div>
        </div>

        {/* Cuerpo */}
        <div className="space-y-6 text-sm leading-relaxed px-4">
          <p className="italic text-gray-700">
            En uso de las Facultades conferidas mediante Resolución Gerencial N° 1261-{new Date().getFullYear()}-MPT-GDEL, la
            Ordenanza Municipal Nro. 014-{new Date().getFullYear()}-MPT y la Ley Orgánica de Municipalidades.
          </p>

          <p className="font-extrabold text-lg">CONCEDE A:</p>

          {/* Lista de datos dinámicos */}
          <div className="grid grid-cols-[1fr,2fr] gap-x-6 gap-y-4 items-start pl-6">
            <DataRow label="Razón Social" value={razonSocial} />
            <DataRow label="Doc. de Identidad" value={`RUC: ${ruc}`} />
            <DataRow label="Representante Legal" value={representanteLegal} />
            <DataRow label="Doc. de Identidad" value={`DNI: ${dniRepresentante}`} />
            <DataRow label="Nombre Comercial" value={nombreComercial} />
            <DataRow label="Dirección" value={direccionLocal} />
            <DataRow label="Código Catastral" value={codigoCatastral} />
            <DataRow label="Giro" value={giro} />
            <DataRow label="Zonificación" value={zonificacion} />
            <DataRow label="Área" value={area !== '-' ? `${area} m2` : '-'} />
            <DataRow label="Horario de Atención" value={horarioAtencion} />
            <DataRow label="Visto el Expediente" value={codigoExpediente} />
          </div>
        </div>

        {/* Pie de página */}
        <div className="absolute bottom-16 left-16 right-16 px-4">
          <div className="text-center space-y-12 mb-16">
            <p className="font-bold text-sm">Trujillo, {fechaActual}</p>
            
            {/* Firma */}
            <div className="flex flex-col items-center">
              <div className="w-32 h-32 border-4 border-double border-gray-300 rounded-full flex items-center justify-center bg-gray-50 mb-4 shadow-inner">
                <CheckCircle className="w-16 h-16 text-blue-900" />
              </div>
              <div className="text-center font-extrabold text-sm space-y-1 font-sans">
                <p>MUNICIPALIDAD PROVINCIAL DE TRUJILLO</p>
                <p>Gerencia de Desarrollo Económico Local</p>
                <p>Subgerencia de Licencias y Comercializaciones</p>
                <p className="mt-6 text-xs text-gray-700">___________________________________________________</p>
                <p className="mt-1">Abog. Jackeline Bustamante Fernández</p>
                <p className="text-xs text-gray-700 font-normal">Sub Gerente</p>
              </div>
            </div>
          </div>

          {/* Prohibiciones */}
          <div className="bg-orange-50 border-t-2 border-orange-200 p-6 rounded-t-lg font-sans">
            <h3 className="font-extrabold text-orange-950 text-base mb-3 tracking-tight">PROHIBICIONES AL ESTABLECIMIENTO:</h3>
            <ul className="list-disc list-outside pl-5 text-xs text-orange-900 space-y-1.5 leading-snug">
              <li>Prohibido consumir bebidas alcohólicas dentro y fuera del local</li>
              <li>Prohibido ocupar pasajes de circulación</li>
              <li className="font-bold text-sm text-orange-950">ES OBLIGATORIO QUE SE EXHIBA EN UN LUGAR VISIBLE DEL ESTABLECIMIENTO</li>
            </ul>
          </div>
        </div>

        {/* Borde decorativo inferior */}
        <div className="absolute bottom-0 left-0 w-full h-12 bg-blue-950 rounded-t-[50%] -z-10"></div>
      </div>
    </div>
  );
};

const DataRow = ({ label, value }) => (
  <div className="flex items-start col-span-2">
    <p className="font-extrabold text-sm text-gray-900 min-w-[200px]">{label}:</p>
    <p className="text-sm text-gray-800 flex-1">{value}</p>
  </div>
);

export default CertificadoLicencia;