-- Adiciona o valor in_route ao enum order_status caso não exista
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'in_route';
