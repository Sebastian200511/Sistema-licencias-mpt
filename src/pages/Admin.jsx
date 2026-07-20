import { useState, useEffect } from 'react';
import { Users, UserPlus, ShieldAlert, CheckCircle, XCircle, Trash2 } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { authService } from '../services/authService';
import Button from '../components/Button';
import Alert from '../components/Alert';
import InputField from '../components/InputField';

export default function Admin() {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mensajeExito, setMensajeExito] = useState('');

  // Formulario nuevo usuario (Solo crea el perfil si el auth.user ya existe, 
  // en un entorno real se usaría una Edge Function con service_role para crear el auth.user)
  const [form, setForm] = useState({ id: '', email: '', password: '', rol: 'Cajero', nombre_completo: '' });

  const cargarUsuarios = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('usuarios_internos')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsuarios(data);
    } catch (err) {
      setError('Error al cargar usuarios: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarUsuarios();
  }, []);

  const toggleActivo = async (id, estadoActual) => {
    setError('');
    setMensajeExito('');
    try {
      const { error } = await supabase
        .from('usuarios_internos')
        .update({ activo: !estadoActual })
        .eq('id', id);

      if (error) throw error;
      setMensajeExito(`Usuario ${!estadoActual ? 'activado' : 'desactivado'} correctamente.`);
      cargarUsuarios();
    } catch (err) {
      setError('Error al cambiar estado: ' + err.message);
    }
  };

  const handleCrearUsuario = async (e) => {
    e.preventDefault();
    setError('');
    setMensajeExito('');
    setLoading(true);
    try {
      // Llamamos a nuestro servicio que internamente invoca la Edge Function
      await authService.crearPersonal(form);

      setMensajeExito('Usuario creado exitosamente. La sesión actual del administrador se mantiene intacta.');
      setForm({ id: '', email: '', password: '', rol: 'Cajero', nombre_completo: '' });
      cargarUsuarios();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-100 p-6 min-h-screen">
      <div className="max-w-6xl mx-auto space-y-6">
        
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-slate-800 p-3 rounded-xl">
            <Users className="text-white w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Panel de Administración (TI)</h1>
        </div>

        {error && <Alert type="error" message={error} />}
        {mensajeExito && <Alert type="success" message={mensajeExito} />}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Formulario de Creación */}
          <div className="bg-white p-6 rounded-xl shadow-md border-t-4 border-slate-700 h-fit">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <UserPlus className="w-5 h-5" /> Nuevo Usuario Interno
            </h2>
            <form onSubmit={handleCrearUsuario} className="space-y-4">
              <InputField 
                label="Nombre Completo" 
                id="nombre_completo" 
                value={form.nombre_completo} 
                onChange={e => setForm({...form, nombre_completo: e.target.value})} 
                required 
              />
              <InputField 
                label="Correo Electrónico" 
                type="email" 
                id="email" 
                value={form.email} 
                onChange={e => setForm({...form, email: e.target.value})} 
                required 
              />
              <InputField 
                label="Contraseña Inicial" 
                type="password" 
                id="password" 
                value={form.password} 
                onChange={e => setForm({...form, password: e.target.value})} 
                required 
              />
              <p className="text-xs text-slate-500 mt-1 mb-3">El usuario podrá cambiar esta contraseña al iniciar sesión en su cuenta.</p>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Rol en el Sistema</label>
                <select 
                  className="w-full p-2 border border-slate-300 rounded focus:ring-slate-500 focus:border-slate-500"
                  value={form.rol}
                  onChange={e => setForm({...form, rol: e.target.value})}
                >
                  <option value="Cajero">Cajero (Ventanilla Presencial)</option>
                  <option value="Inspector">Inspector (Trabajo de Campo)</option>
                  <option value="Admin">Administrador (TI)</option>
                </select>
              </div>
              <Button type="submit" isLoading={loading} className="w-full mt-4">Registrar Usuario</Button>
            </form>
          </div>

          {/* Lista de Usuarios */}
          <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-md">
            <h2 className="text-lg font-bold text-slate-800 mb-4">Directorio de Personal</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="p-3 text-sm font-bold text-slate-600">Nombre</th>
                    <th className="p-3 text-sm font-bold text-slate-600">Correo Electrónico</th>
                    <th className="p-3 text-sm font-bold text-slate-600">Rol</th>
                    <th className="p-3 text-sm font-bold text-slate-600">Estado</th>
                    <th className="p-3 text-sm font-bold text-slate-600 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {usuarios.map(u => (
                    <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="p-3 text-sm font-medium text-slate-800">{u.nombre_completo}</td>
                      <td className="p-3 text-sm text-slate-500">{u.email || '-'}</td>
                      <td className="p-3 text-sm text-slate-600">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${u.rol === 'Admin' ? 'bg-purple-100 text-purple-700' : u.rol === 'Inspector' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                          {u.rol}
                        </span>
                      </td>
                      <td className="p-3 text-sm">
                        {u.activo ? 
                          <span className="flex items-center gap-1 text-green-600 font-medium text-xs"><CheckCircle className="w-3 h-3"/> Activo</span> : 
                          <span className="flex items-center gap-1 text-red-500 font-medium text-xs"><XCircle className="w-3 h-3"/> Inactivo</span>
                        }
                      </td>
                      <td className="p-3 text-center">
                        <button 
                          onClick={() => toggleActivo(u.id, u.activo)}
                          className={`text-xs px-3 py-1 rounded font-bold transition-colors ${u.activo ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}
                        >
                          {u.activo ? 'Dar de Baja' : 'Reactivar'}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {usuarios.length === 0 && (
                    <tr>
                      <td colSpan="4" className="p-4 text-center text-slate-500">No hay usuarios registrados.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
