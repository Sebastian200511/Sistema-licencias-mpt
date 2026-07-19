-- Fase 7: Entorno Real de Cajeros (Yape y Efectivo)

-- Añadimos la columna metodo_pago a la tabla de expedientes
ALTER TABLE public.expedientes
ADD COLUMN IF NOT EXISTS metodo_pago text DEFAULT 'Efectivo';

-- (Opcional) Podemos crear una restricción para asegurar que solo haya estos métodos
ALTER TABLE public.expedientes
ADD CONSTRAINT expedientes_metodo_pago_check CHECK (metodo_pago IN ('Efectivo', 'Yape', 'Transferencia', 'Tarjeta'));
