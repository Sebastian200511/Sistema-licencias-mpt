export const apiPeruService = {
  consultarRuc: async (ruc) => {
    if (!ruc || ruc.length !== 11) {
      throw new Error('El RUC debe tener exactamente 11 dígitos.');
    }

    const token = "73aae707fbb5c6faea3a40fd8fbb260bb68b273b73e4c2d5b0be476832ee9d1b";
    
    const response = await fetch(`https://apiperu.dev/api/ruc/${ruc}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Error al conectar con SUNAT.');
    }

    const resData = await response.json();
    
    if (!resData?.success || !resData?.data) {
      throw new Error(resData?.message || 'RUC inválido o no encontrado en SUNAT.');
    }

    const estado = resData.data.estado_del_contribuyente;
    const condicion = resData.data.condicion_de_domicilio;

    if (estado !== 'ACTIVO') {
      throw new Error(`El RUC no está ACTIVO. Estado actual: ${estado}`);
    }
    if (condicion !== 'HABIDO') {
      throw new Error(`La condición del domicilio no es HABIDO. Condición actual: ${condicion}`);
    }

    return resData.data;
  }
};
