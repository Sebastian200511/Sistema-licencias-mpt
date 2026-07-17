import { supabase } from '../supabaseClient';

export const authService = {
  loginInterno: async (email, password) => {
    const { data, error } = await supabase
      .from('usuarios_internos')
      .select('*')
      .eq('email', email.trim())
      .eq('password', password)
      .single();

    if (error || !data) {
      throw new Error('Credenciales institucionales incorrectas.');
    }

    return data;
  }
};
