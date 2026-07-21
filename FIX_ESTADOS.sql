-- ESTE SCRIPT CORRIGE EL ERROR "Error al generar el expediente"
-- Cópialo y pégalo en el SQL Editor de tu Dashboard de Supabase y dale a "Run"

ALTER TABLE public.expedientes DROP CONSTRAINT IF EXISTS expedientes_estado_check;

ALTER TABLE public.expedientes 
ADD CONSTRAINT expedientes_estado_check 
CHECK (estado IN ('Pendiente', 'En Inspeccion', 'Aprobado', 'Rechazado', 'Observado', 'Subsanacion', 'Vencido'));
