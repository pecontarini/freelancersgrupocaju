-- Create table for freelancer entries
CREATE TABLE public.freelancer_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  loja TEXT NOT NULL,
  nome_completo TEXT NOT NULL,
  setor TEXT NOT NULL,
  gerencia TEXT NOT NULL,
  data_pop DATE NOT NULL,
  valor DECIMAL(10,2) NOT NULL,
  cpf TEXT NOT NULL,
  chave_pix TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.freelancer_entries ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to perform CRUD operations (internal app)
CREATE POLICY "Allow all operations for all users" 
ON public.freelancer_entries 
FOR ALL 
USING (true) 
WITH CHECK (true);