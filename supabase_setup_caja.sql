-- Crear tabla de Sesiones de Caja
CREATE TABLE IF NOT EXISTS public.caja_sesiones (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    cajero_id uuid REFERENCES auth.users NOT NULL,
    fecha_apertura timestamp with time zone DEFAULT now() NOT NULL,
    monto_inicial numeric NOT NULL,
    fecha_cierre timestamp with time zone,
    monto_calculado numeric,
    monto_fisico numeric,
    estado text NOT NULL CHECK (estado IN ('Abierta', 'Cerrada')),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Habilitar seguridad (RLS)
ALTER TABLE public.caja_sesiones ENABLE ROW LEVEL SECURITY;

-- Políticas de seguridad para que el cajero solo vea y edite sus propias cajas
CREATE POLICY "cajeros_select_sesiones" ON public.caja_sesiones
    FOR SELECT USING (auth.uid() = cajero_id);

CREATE POLICY "cajeros_insert_sesiones" ON public.caja_sesiones
    FOR INSERT WITH CHECK (auth.uid() = cajero_id);

CREATE POLICY "cajeros_update_sesiones" ON public.caja_sesiones
    FOR UPDATE USING (auth.uid() = cajero_id);

-- Agregar el campo para registrar cuánto se cobró en cada trámite
ALTER TABLE public.expedientes
ADD COLUMN IF NOT EXISTS monto_pagado numeric DEFAULT 0;
