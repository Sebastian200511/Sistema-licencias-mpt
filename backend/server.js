import express from 'express';
import cors from 'cors';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const app = express();
app.use(cors());
app.use(express.json());

// Initialize MP SDK
const client = new MercadoPagoConfig({ 
  accessToken: process.env.VITE_MP_ACCESS_TOKEN 
});

app.post('/api/crear-preferencia', async (req, res) => {
  try {
    const { razonSocial, tipoTramite } = req.body;
    
    // In real-world, price should be verified on the backend, not trusted from frontend.
    // For this project, we hardcode it to S/ 3.00 as requested by the professor.
    const montoACobrar = 3.00; 

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
        // Redirigir al frontend al terminar
        success: process.env.VITE_FRONTEND_URL || 'http://localhost:5173/solicitud?status=approved',
        failure: process.env.VITE_FRONTEND_URL || 'http://localhost:5173/solicitud?status=failure',
        pending: process.env.VITE_FRONTEND_URL || 'http://localhost:5173/solicitud?status=pending'
      },
      auto_return: 'approved'
    };

    const preference = new Preference(client);
    const result = await preference.create({ body });
    
    // Retornamos el init_point para redirigir al usuario al Checkout Pro
    res.json({ id: result.id, init_point: result.init_point });
  } catch (error) {
    console.error('Error al crear preferencia MP:', error);
    res.status(500).json({ error: 'No se pudo crear la preferencia de pago.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Backend corriendo en http://localhost:${PORT}`);
});
