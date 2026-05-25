import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { Building2 } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ ruc: '', razon_social: '', domicilio_fiscal: '' });
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validación básica
    if (formData.ruc.length !== 11) {
      setError('El RUC debe tener 11 dígitos.');
      return;
    }

    try {
      // 1. Buscamos si la empresa ya existe en la base de datos
      let { data: empresa, error: fetchError } = await supabase
        .from('empresas')
        .select('*')
        .eq('ruc', formData.ruc)
        .single();

      // 2. Si no existe, la creamos (Simulando validación exitosa de SUNAT)
      if (!empresa) {
        const { data: newEmpresa, error: insertError } = await supabase
          .from('empresas')
          .insert([{ 
            ruc: formData.ruc, 
            razon_social: formData.razon_social, 
            domicilio_fiscal: formData.domicilio_fiscal 
          }])
          .select()
          .single();
          
        if (insertError) throw insertError;
        empresa = newEmpresa;
      }

      // Guardamos el ID de la empresa en el navegador temporalmente y avanzamos
      localStorage.setItem('empresa_id', empresa.id);
      navigate('/solicitud');

    } catch (err) {
      setError('Ocurrió un error al conectar con el servidor.');
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md">
        <div className="flex flex-col items-center mb-6">
          <div className="bg-blue-600 p-3 rounded-full mb-3">
            <Building2 className="text-white w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800">Trámite de Licencia</h2>
          <p className="text-gray-500 text-sm mt-1">Municipalidad Provincial</p>
        </div>

        {error && <div className="bg-red-100 text-red-700 p-3 rounded mb-4 text-sm">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">RUC de la Empresa</label>
            <input 
              type="number" 
              name="ruc" 
              value={formData.ruc} 
              onChange={handleChange} 
              required 
              className="mt-1 w-full p-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500" 
              placeholder="Ej. 20123456789"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Razón Social</label>
            <input 
              type="text" 
              name="razon_social" 
              value={formData.razon_social} 
              onChange={handleChange} 
              required 
              className="mt-1 w-full p-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500" 
              placeholder="Ej. Mi Empresa S.A.C."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Domicilio Fiscal</label>
            <input 
              type="text" 
              name="domicilio_fiscal" 
              value={formData.domicilio_fiscal} 
              onChange={handleChange} 
              required 
              className="mt-1 w-full p-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500" 
              placeholder="Ej. Av. Principal 123"
            />
          </div>
          
          <button type="submit" className="w-full bg-blue-600 text-white font-bold py-2 px-4 rounded hover:bg-blue-700 transition">
            Ingresar y Validar
          </button>
        </form>
        {/* Enlace al Seguimiento - Pégalo justo debajo del form */}
        <div className="mt-6 pt-6 border-t border-gray-200 text-center">
          <p className="text-sm text-gray-600 mb-2">¿Ya inició su trámite anteriormente?</p>
          <button 
            onClick={() => navigate('/seguimiento')}
            className="w-full bg-white border border-blue-600 text-blue-700 font-bold py-2 px-4 rounded hover:bg-blue-50 transition"
          >
            Consultar Estado de Expediente
          </button>
        </div>
      </div>
    </div>
  );
}