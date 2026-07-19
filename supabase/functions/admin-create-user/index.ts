import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Inicializar cliente de Supabase con SERVICE_ROLE_KEY
    // Esto es crucial para saltarse RLS y tener permisos de administrador en Auth
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { email, password, rol, nombre_completo } = await req.json()

    if (!email || !password || !rol || !nombre_completo) {
      throw new Error('Faltan datos obligatorios')
    }

    // 1. Crear el usuario en Auth usando admin.createUser
    // Esto NO altera la sesión de quien hace la llamada.
    const { data: authData, error: authError } = await supabaseClient.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true
    })

    if (authError) throw authError

    // 2. Insertar metadata en nuestra tabla personalizada 'usuarios_internos'
    const { error: dbError } = await supabaseClient
      .from('usuarios_internos')
      .insert([
        {
          id: authData.user.id,
          email: email,
          rol: rol,
          nombre_completo: nombre_completo
        }
      ])

    if (dbError) throw dbError

    return new Response(
      JSON.stringify({ message: 'Usuario creado exitosamente', user: authData.user }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
