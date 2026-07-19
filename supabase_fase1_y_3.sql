-- ====================================================================
-- FASE 1 Y 3: Reestructuración de Base de Datos y Motor de Agenda
-- ====================================================================

-- 1. Tabla de Usuarios Internos (RBAC)
CREATE TABLE IF NOT EXISTS public.usuarios_internos (
    id uuid REFERENCES auth.users(id) NOT NULL PRIMARY KEY,
    rol text NOT NULL CHECK (rol IN ('Admin', 'Cajero', 'Inspector')),
    nombre_completo text NOT NULL,
    activo boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);

-- Habilitar seguridad en usuarios internos
ALTER TABLE public.usuarios_internos ENABLE ROW LEVEL SECURITY;

-- Políticas de seguridad para usuarios_internos
CREATE POLICY "usuarios_select_internos" ON public.usuarios_internos 
    FOR SELECT USING (
        auth.uid() = id OR 
        (SELECT rol FROM public.usuarios_internos WHERE id = auth.uid()) = 'Admin'
    );

-- Solo el Admin puede insertar o actualizar
CREATE POLICY "admin_insert_internos" ON public.usuarios_internos 
    FOR INSERT WITH CHECK (
        (SELECT rol FROM public.usuarios_internos WHERE id = auth.uid()) = 'Admin'
    );

CREATE POLICY "admin_update_internos" ON public.usuarios_internos 
    FOR UPDATE USING (
        (SELECT rol FROM public.usuarios_internos WHERE id = auth.uid()) = 'Admin'
    );

-- 2. Modificaciones a la tabla expedientes
ALTER TABLE public.expedientes
ADD COLUMN IF NOT EXISTS modalidad_ingreso text DEFAULT 'Virtual' CHECK (modalidad_ingreso IN ('Virtual', 'Presencial')),
ADD COLUMN IF NOT EXISTS cajero_id uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS fecha_vencimiento date;

-- 3. Tabla Feriados (para el cálculo de días hábiles)
CREATE TABLE IF NOT EXISTS public.feriados (
    id serial PRIMARY KEY,
    fecha date NOT NULL UNIQUE,
    descripcion text,
    created_at timestamp with time zone DEFAULT now()
);

-- 4. Tabla Agenda Inspector (Control de cupos)
CREATE TABLE IF NOT EXISTS public.agenda_inspector (
    id serial PRIMARY KEY,
    fecha date NOT NULL UNIQUE,
    cupos_totales integer DEFAULT 10,
    cupos_ocupados integer DEFAULT 0,
    activo boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);

-- 5. Stored Procedure (RPC) para buscar y asignar cupo de inspección inteligentemente
CREATE OR REPLACE FUNCTION public.asignar_cupo_inspeccion(p_expediente_id uuid)
RETURNS date
LANGUAGE plpgsql
SECURITY DEFINER -- Ejecuta con privilegios de creador para bypassear RLS si es necesario al asignar
AS $$
DECLARE
    v_fecha_actual date := current_date;
    v_dias_buscados integer := 0;
    v_fecha_candidata date;
    v_es_feriado boolean;
    v_es_fin_semana boolean;
    v_agenda_record public.agenda_inspector%ROWTYPE;
BEGIN
    -- Empezamos a buscar a partir de mañana
    v_fecha_candidata := v_fecha_actual + interval '1 day';

    WHILE v_dias_buscados < 30 LOOP
        -- Verificar si es fin de semana (Sábado = 6, Domingo = 7)
        v_es_fin_semana := EXTRACT(isodow FROM v_fecha_candidata) IN (6, 7);
        
        IF NOT v_es_fin_semana THEN
            -- Verificar si es feriado
            SELECT EXISTS (SELECT 1 FROM public.feriados WHERE fecha = v_fecha_candidata) INTO v_es_feriado;
            
            IF NOT v_es_feriado THEN
                -- Es un día hábil válido, revisar cupos
                -- Insertar la fecha en agenda_inspector si no existe, asumiendo 10 cupos por defecto
                INSERT INTO public.agenda_inspector (fecha, cupos_totales, cupos_ocupados)
                VALUES (v_fecha_candidata, 10, 0)
                ON CONFLICT (fecha) DO NOTHING;
                
                -- Bloquear la fila para evitar concurrencia (SELECT FOR UPDATE)
                SELECT * INTO v_agenda_record 
                FROM public.agenda_inspector 
                WHERE fecha = v_fecha_candidata FOR UPDATE;
                
                IF v_agenda_record.cupos_ocupados < v_agenda_record.cupos_totales AND v_agenda_record.activo = true THEN
                    -- ¡Hay cupo disponible! Lo asignamos.
                    UPDATE public.agenda_inspector 
                    SET cupos_ocupados = cupos_ocupados + 1 
                    WHERE fecha = v_fecha_candidata;
                    
                    -- Crear el registro de la inspeccion programada
                    INSERT INTO public.inspecciones (expediente_id, fecha_programada, estado, observaciones)
                    VALUES (p_expediente_id, v_fecha_candidata, 'Programada', 'Asignación automática del sistema');
                    
                    RETURN v_fecha_candidata;
                END IF;
            END IF;
        END IF;
        
        -- Si no hubo cupo o no era hábil, avanzamos al siguiente día
        v_fecha_candidata := v_fecha_candidata + interval '1 day';
        v_dias_buscados := v_dias_buscados + 1;
    END LOOP;

    -- Si buscamos por 30 días y todo estaba lleno (muy raro)
    RAISE EXCEPTION 'No se encontraron cupos disponibles en los próximos 30 días hábiles. Contacte al administrador.';
END;
$$;
