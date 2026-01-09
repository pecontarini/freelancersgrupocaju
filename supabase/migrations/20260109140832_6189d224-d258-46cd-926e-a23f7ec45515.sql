-- Create config tables for dynamic options
CREATE TABLE public.config_lojas (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    nome TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.config_setores (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    nome TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.config_gerencias (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    nome TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.config_lojas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.config_setores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.config_gerencias ENABLE ROW LEVEL SECURITY;

-- Allow all operations for all users (can be restricted later)
CREATE POLICY "Allow all operations on config_lojas" ON public.config_lojas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on config_setores" ON public.config_setores FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on config_gerencias" ON public.config_gerencias FOR ALL USING (true) WITH CHECK (true);

-- Insert initial data from existing LOJAS, SETORES, GERENCIAS constants
INSERT INTO public.config_lojas (nome) VALUES 
  ('LOJA 01'),
  ('LOJA 02'),
  ('LOJA 03'),
  ('LOJA 04'),
  ('LOJA 05'),
  ('LOJA 06'),
  ('LOJA 07');

INSERT INTO public.config_setores (nome) VALUES 
  ('MATERIAIS'),
  ('ALIMENTOS'),
  ('ELETRO'),
  ('TÊXTIL'),
  ('CHECKOUT'),
  ('ADMINISTRATIVO');

INSERT INTO public.config_gerencias (nome) VALUES 
  ('GERÊNCIA A'),
  ('GERÊNCIA B'),
  ('GERÊNCIA C'),
  ('GERÊNCIA D');