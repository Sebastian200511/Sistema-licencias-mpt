import { supabase } from '../supabaseClient';

export const authService = {
  loginInterno: async (email, password) => {
    // 1. Autenticar con Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: password,
    });

    if (authError || !authData.user) {
      throw new Error('Credenciales institucionales incorrectas.');
    }

    // 2. Obtener el rol y datos del usuario de usuarios_internos
    const { data: userData, error: userError } = await supabase
      .from('usuarios_internos')
      .select('rol, nombre_completo, activo')
      .eq('id', authData.user.id)
      .single();

    if (userError || !userData) {
      // Si no está en usuarios_internos, cerramos su sesión de Auth
      await supabase.auth.signOut();
      throw new Error('El usuario no tiene un rol asignado en el sistema.');
    }
    
    if (!userData.activo) {
      await supabase.auth.signOut();
      throw new Error('El usuario está inactivo.');
    }

    return {
      id: authData.user.id,
      email: authData.user.email,
      rol: userData.rol,
      nombre_completo: userData.nombre_completo
    };
  },
  
  logout: async () => {
    await supabase.auth.signOut();
  },

  crearPersonal: async (usuarioData) => {
    // Invocamos la Edge Function para crear el usuario de forma administrativa
    // Esto evita que supabase reemplace la sesión activa del Administrador
    const { data, error } = await supabase.functions.invoke('admin-create-user', {
      body: usuarioData
    });

    if (error) {
      throw new Error(error.message || 'Error al invocar la función de creación.');
    }
    
    if (data && data.error) {
       throw new Error(data.error);
    }

    return data;
  }
};
