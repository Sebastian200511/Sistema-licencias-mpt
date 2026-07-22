-- ====================================================================
-- SCRIPT MAESTRO - SISTEMA DE LICENCIAS MPT (Fase 1 a 7)
-- Ejecuta este script en el SQL Editor de Supabase
-- ====================================================================

-- 1. LIMPIEZA DE TABLAS ANTERIORES (Cuidado: Borrará datos si existen)
DROP TABLE IF EXISTS public.caja_sesiones CASCADE;
DROP TABLE IF EXISTS public.inspecciones CASCADE;
DROP TABLE IF EXISTS public.expedientes CASCADE;
DROP TABLE IF EXISTS public.empresas CASCADE;
DROP TABLE IF EXISTS public.agenda_inspector CASCADE;
DROP TABLE IF EXISTS public.feriados CASCADE;
DROP TABLE IF EXISTS public.usuarios_internos CASCADE;

-- ====================================================================
-- 2. CREACIÓN DE TABLAS
-- ====================================================================

-- A. Usuarios Internos (Cajeros, Inspectores, Admins)
CREATE TABLE public.usuarios_internos (
    id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL PRIMARY KEY,
    email text NOT NULL,
    rol text NOT NULL CHECK (rol IN ('Admin', 'Cajero', 'Inspector')),
    nombre_completo text NOT NULL,
    activo boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);

-- B. Empresas (Contribuyentes)
CREATE TABLE public.empresas (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    ruc text NOT NULL UNIQUE,
    razon_social text NOT NULL,
    domicilio_fiscal text,
    created_at timestamp with time zone DEFAULT now()
);

-- C. Expedientes (Trámites de Licencia)
CREATE TABLE public.expedientes (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    codigo text NOT NULL UNIQUE,
    empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE NOT NULL,
    plano_url text,
    estado text DEFAULT 'Pendiente' CHECK (estado IN ('Pendiente', 'En Inspeccion', 'Aprobado', 'Rechazado', 'Subsanacion')),
    modalidad_ingreso text DEFAULT 'Virtual' CHECK (modalidad_ingreso IN ('Virtual', 'Presencial')),
    cajero_id uuid REFERENCES auth.users(id),
    fecha_vencimiento date,
    monto_pagado numeric DEFAULT 0,
    metodo_pago text DEFAULT 'Efectivo' CHECK (metodo_pago IN ('Efectivo', 'Yape', 'Transferencia', 'Tarjeta')),
    created_at timestamp with time zone DEFAULT now()
);

-- D. Inspecciones (Visitas a locales)
CREATE TABLE public.inspecciones (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    expediente_id uuid REFERENCES public.expedientes(id) ON DELETE CASCADE NOT NULL,
    fecha_programada date NOT NULL,
    inspector_id uuid REFERENCES auth.users(id),
    estado text DEFAULT 'Programada' CHECK (estado IN ('Programada', 'Realizada', 'Reprogramada')),
    observaciones text,
    url_acta text,
    created_at timestamp with time zone DEFAULT now()
);

-- E. Feriados (Días no laborables)
CREATE TABLE public.feriados (
    id serial PRIMARY KEY,
    fecha date NOT NULL UNIQUE,
    descripcion text,
    created_at timestamp with time zone DEFAULT now()
);

-- F. Agenda Inspector (Control de cupos por día)
CREATE TABLE public.agenda_inspector (
    id serial PRIMARY KEY,
    fecha date NOT NULL UNIQUE,
    cupos_totales integer DEFAULT 8,
    cupos_ocupados integer DEFAULT 0,
    activo boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);

-- G. Caja Sesiones (Apertura y Cierre de caja por cajero)
CREATE TABLE public.caja_sesiones (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    cajero_id uuid REFERENCES auth.users(id) NOT NULL,
    fecha_apertura timestamp with time zone DEFAULT now() NOT NULL,
    monto_inicial numeric NOT NULL,
    fecha_cierre timestamp with time zone,
    monto_calculado numeric,
    monto_fisico numeric,
    estado text DEFAULT 'Abierta' CHECK (estado IN ('Abierta', 'Cerrada')),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- ====================================================================
-- 3. FUNCIONES DE BASE DE DATOS (RPC)
-- ====================================================================

-- Función inteligente para asignar cupo (salta fines de semana y feriados)
CREATE OR REPLACE FUNCTION public.asignar_cupo_inspeccion(p_expediente_id uuid)
RETURNS date
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_fecha_actual date := current_date;
    v_dias_buscados integer := 0;
    v_fecha_candidata date;
    v_es_feriado boolean;
    v_es_fin_semana boolean;
    v_agenda_record public.agenda_inspector%ROWTYPE;
BEGIN
    v_fecha_candidata := v_fecha_actual + interval '1 day';

    WHILE v_dias_buscados < 30 LOOP
        v_es_fin_semana := EXTRACT(isodow FROM v_fecha_candidata) IN (6, 7);
        
        IF NOT v_es_fin_semana THEN
            SELECT EXISTS (SELECT 1 FROM public.feriados WHERE fecha = v_fecha_candidata) INTO v_es_feriado;
            
            IF NOT v_es_feriado THEN
                INSERT INTO public.agenda_inspector (fecha, cupos_totales, cupos_ocupados)
                VALUES (v_fecha_candidata, 8, 0)
                ON CONFLICT (fecha) DO NOTHING;
                
                SELECT * INTO v_agenda_record 
                FROM public.agenda_inspector 
                WHERE fecha = v_fecha_candidata FOR UPDATE;
                
                IF v_agenda_record.cupos_ocupados < v_agenda_record.cupos_totales AND v_agenda_record.activo = true THEN
                    UPDATE public.agenda_inspector 
                    SET cupos_ocupados = cupos_ocupados + 1 
                    WHERE fecha = v_fecha_candidata;
                    
                    INSERT INTO public.inspecciones (expediente_id, fecha_programada, estado, observaciones)
                    VALUES (p_expediente_id, v_fecha_candidata, 'Programada', 'Asignación automática del sistema');
                    
                    RETURN v_fecha_candidata;
                END IF;
            END IF;
        END IF;
        
        v_fecha_candidata := v_fecha_candidata + interval '1 day';
        v_dias_buscados := v_dias_buscados + 1;
    END LOOP;

    RAISE EXCEPTION 'No se encontraron cupos disponibles en los próximos 30 días hábiles.';
END;
$$;
