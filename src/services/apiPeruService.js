export const apiPeruService = {
  consultarRuc: async (ruc) => {
    if (!ruc || ruc.length !== 11) {
      throw new Error('El RUC debe tener exactamente 11 dígitos.');
    }

    const token = "167797c04635f0ccded30d64a1e60f6c8088ecfc1540d88d25cd0d90cdc704df";
    
    const response = await fetch(`https://api.consultasperu.com/api/v1/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ type_document: 'ruc', document_number: ruc })
    });

    if (!response.ok) {
      throw new Error('Error al conectar con SUNAT.');
    }

    const resData = await response.json();
    
    if (!resData?.success || !resData?.data) {
      throw new Error(resData?.message || 'RUC inválido o no encontrado en SUNAT.');
    }

    const estado = resData.data.estado || resData.data.estado_del_contribuyente;
    const condicion = resData.data.condicion || resData.data.condicion_de_domicilio;

    if (estado !== 'ACTIVO') {
      throw new Error(`El RUC no está ACTIVO. Estado actual: ${estado}`);
    }
    if (condicion !== 'HABIDO') {
      throw new Error(`La condición del domicilio no es HABIDO. Condición actual: ${condicion}`);
    }

    return resData.data;
  },

  consultarRucAnexos: async (ruc) => {
    if (!ruc || ruc.length !== 11) {
      throw new Error('El RUC debe tener exactamente 11 dígitos.');
    }

    const token = "167797c04635f0ccded30d64a1e60f6c8088ecfc1540d88d25cd0d90cdc704df";
    
    try {
      const response = await fetch(`https://api.consultasperu.com/api/v1/query/ruc-anexos`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ ruc: ruc })
      });

      if (!response.ok) {
        return [];
      }

      const resData = await response.json();
      
      if (!resData?.success || !Array.isArray(resData?.data)) {
        return [];
      }

      return resData.data;
    } catch (err) {
      console.error("Error fetching branches:", err);
      return [];
    }
  }
};
