-- 1) Tabela pracas_plano_chao (por loja)
CREATE TABLE IF NOT EXISTS public.pracas_plano_chao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES public.config_lojas(id) ON DELETE CASCADE,
  setor text NOT NULL,
  nome_praca text NOT NULL,
  turno text NOT NULL,
  dia_semana text NOT NULL,
  qtd_necessaria integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pracas_turno_check CHECK (turno IN ('ALMOCO','JANTAR','TARDE')),
  CONSTRAINT pracas_dia_check CHECK (dia_semana IN ('SEGUNDA','TERCA','QUARTA','QUINTA','SEXTA','SABADO','DOMINGO')),
  CONSTRAINT pracas_unique UNIQUE (unit_id, setor, nome_praca, turno, dia_semana)
);

CREATE INDEX IF NOT EXISTS idx_pracas_unit ON public.pracas_plano_chao(unit_id);
CREATE INDEX IF NOT EXISTS idx_pracas_lookup ON public.pracas_plano_chao(unit_id, setor, turno, dia_semana);

ALTER TABLE public.pracas_plano_chao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View pracas of accessible stores"
  ON public.pracas_plano_chao FOR SELECT
  TO authenticated
  USING (public.user_has_access_to_loja(auth.uid(), unit_id));

CREATE POLICY "Admins manage all pracas"
  ON public.pracas_plano_chao FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Chefes setor manage pracas of their stores"
  ON public.pracas_plano_chao FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'chefe_setor') AND public.user_has_access_to_loja(auth.uid(), unit_id))
  WITH CHECK (public.has_role(auth.uid(), 'chefe_setor') AND public.user_has_access_to_loja(auth.uid(), unit_id));

CREATE TRIGGER update_pracas_updated_at
  BEFORE UPDATE ON public.pracas_plano_chao
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Vínculo praca_id em schedules
ALTER TABLE public.schedules
  ADD COLUMN IF NOT EXISTS praca_id uuid REFERENCES public.pracas_plano_chao(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_schedules_praca ON public.schedules(praca_id) WHERE praca_id IS NOT NULL;

-- 3) Seed para todas as lojas existentes
INSERT INTO public.pracas_plano_chao (unit_id, setor, nome_praca, turno, dia_semana, qtd_necessaria)
SELECT cl.id, v.setor, v.nome_praca, v.turno, v.dia_semana, v.qtd
FROM public.config_lojas cl
CROSS JOIN (VALUES
  -- SUBCHEFE DE SALAO
  ('Subchefe de Salão','Subchefe Almoço','ALMOCO','SEGUNDA',2),('Subchefe de Salão','Subchefe Almoço','ALMOCO','TERCA',2),
  ('Subchefe de Salão','Subchefe Almoço','ALMOCO','QUARTA',2),('Subchefe de Salão','Subchefe Almoço','ALMOCO','QUINTA',3),
  ('Subchefe de Salão','Subchefe Almoço','ALMOCO','SEXTA',3),('Subchefe de Salão','Subchefe Almoço','ALMOCO','SABADO',3),
  ('Subchefe de Salão','Subchefe Almoço','ALMOCO','DOMINGO',3),
  ('Subchefe de Salão','Subchefe Jantar','JANTAR','SEGUNDA',2),('Subchefe de Salão','Subchefe Jantar','JANTAR','TERCA',3),
  ('Subchefe de Salão','Subchefe Jantar','JANTAR','QUARTA',3),('Subchefe de Salão','Subchefe Jantar','JANTAR','QUINTA',3),
  ('Subchefe de Salão','Subchefe Jantar','JANTAR','SEXTA',3),('Subchefe de Salão','Subchefe Jantar','JANTAR','SABADO',3),
  ('Subchefe de Salão','Subchefe Jantar','JANTAR','DOMINGO',2),
  -- GARCOM
  ('Garçom','Garçom Almoço','ALMOCO','SEGUNDA',8),('Garçom','Garçom Almoço','ALMOCO','TERCA',8),
  ('Garçom','Garçom Almoço','ALMOCO','QUARTA',10),('Garçom','Garçom Almoço','ALMOCO','QUINTA',12),
  ('Garçom','Garçom Almoço','ALMOCO','SEXTA',20),('Garçom','Garçom Almoço','ALMOCO','SABADO',20),
  ('Garçom','Garçom Almoço','ALMOCO','DOMINGO',20),
  ('Garçom','Garçom Jantar','JANTAR','SEGUNDA',15),('Garçom','Garçom Jantar','JANTAR','TERCA',16),
  ('Garçom','Garçom Jantar','JANTAR','QUARTA',19),('Garçom','Garçom Jantar','JANTAR','QUINTA',20),
  ('Garçom','Garçom Jantar','JANTAR','SEXTA',20),('Garçom','Garçom Jantar','JANTAR','SABADO',20),
  ('Garçom','Garçom Jantar','JANTAR','DOMINGO',17),
  -- CUMIN
  ('Cumin','Cumin Almoço','ALMOCO','SEGUNDA',8),('Cumin','Cumin Almoço','ALMOCO','TERCA',9),
  ('Cumin','Cumin Almoço','ALMOCO','QUARTA',10),('Cumin','Cumin Almoço','ALMOCO','QUINTA',11),
  ('Cumin','Cumin Almoço','ALMOCO','SEXTA',13),('Cumin','Cumin Almoço','ALMOCO','SABADO',13),
  ('Cumin','Cumin Almoço','ALMOCO','DOMINGO',13),
  ('Cumin','Cumin Jantar','JANTAR','SEGUNDA',10),('Cumin','Cumin Jantar','JANTAR','TERCA',11),
  ('Cumin','Cumin Jantar','JANTAR','QUARTA',11),('Cumin','Cumin Jantar','JANTAR','QUINTA',11),
  ('Cumin','Cumin Jantar','JANTAR','SEXTA',14),('Cumin','Cumin Jantar','JANTAR','SABADO',13),
  ('Cumin','Cumin Jantar','JANTAR','DOMINGO',11),
  -- HOSTESS
  ('Hostess','Hostess Almoço','ALMOCO','SEGUNDA',1),('Hostess','Hostess Almoço','ALMOCO','TERCA',1),
  ('Hostess','Hostess Almoço','ALMOCO','QUARTA',1),('Hostess','Hostess Almoço','ALMOCO','QUINTA',2),
  ('Hostess','Hostess Almoço','ALMOCO','SEXTA',3),('Hostess','Hostess Almoço','ALMOCO','SABADO',3),
  ('Hostess','Hostess Almoço','ALMOCO','DOMINGO',3),
  ('Hostess','Hostess Jantar','JANTAR','SEGUNDA',2),('Hostess','Hostess Jantar','JANTAR','TERCA',2),
  ('Hostess','Hostess Jantar','JANTAR','QUARTA',2),('Hostess','Hostess Jantar','JANTAR','QUINTA',3),
  ('Hostess','Hostess Jantar','JANTAR','SEXTA',3),('Hostess','Hostess Jantar','JANTAR','SABADO',3),
  ('Hostess','Hostess Jantar','JANTAR','DOMINGO',2),
  -- CAIXA/DELIVERY
  ('Caixa/Delivery','Caixa Almoço','ALMOCO','SEGUNDA',1),('Caixa/Delivery','Caixa Almoço','ALMOCO','TERCA',1),
  ('Caixa/Delivery','Caixa Almoço','ALMOCO','QUARTA',1),('Caixa/Delivery','Caixa Almoço','ALMOCO','QUINTA',2),
  ('Caixa/Delivery','Caixa Almoço','ALMOCO','SEXTA',2),('Caixa/Delivery','Caixa Almoço','ALMOCO','SABADO',2),
  ('Caixa/Delivery','Caixa Almoço','ALMOCO','DOMINGO',3),
  ('Caixa/Delivery','Caixa Jantar','JANTAR','SEGUNDA',2),('Caixa/Delivery','Caixa Jantar','JANTAR','TERCA',2),
  ('Caixa/Delivery','Caixa Jantar','JANTAR','QUARTA',2),('Caixa/Delivery','Caixa Jantar','JANTAR','QUINTA',2),
  ('Caixa/Delivery','Caixa Jantar','JANTAR','SEXTA',2),('Caixa/Delivery','Caixa Jantar','JANTAR','SABADO',2),
  ('Caixa/Delivery','Caixa Jantar','JANTAR','DOMINGO',1),
  -- PARRILLA
  ('Parrilla','Parrilla Almoço','ALMOCO','SEGUNDA',2),('Parrilla','Parrilla Almoço','ALMOCO','TERCA',2),
  ('Parrilla','Parrilla Almoço','ALMOCO','QUARTA',2),('Parrilla','Parrilla Almoço','ALMOCO','QUINTA',2),
  ('Parrilla','Parrilla Almoço','ALMOCO','SEXTA',2),('Parrilla','Parrilla Almoço','ALMOCO','SABADO',2),
  ('Parrilla','Parrilla Almoço','ALMOCO','DOMINGO',2),
  ('Parrilla','Parrilla Jantar','JANTAR','SEGUNDA',1),('Parrilla','Parrilla Jantar','JANTAR','TERCA',1),
  ('Parrilla','Parrilla Jantar','JANTAR','QUARTA',1),('Parrilla','Parrilla Jantar','JANTAR','QUINTA',2),
  ('Parrilla','Parrilla Jantar','JANTAR','SEXTA',2),('Parrilla','Parrilla Jantar','JANTAR','SABADO',2),
  ('Parrilla','Parrilla Jantar','JANTAR','DOMINGO',2),
  -- COZINHA
  ('Cozinha','Fogão','ALMOCO','SEGUNDA',1),('Cozinha','Fogão','ALMOCO','TERCA',1),
  ('Cozinha','Fogão','ALMOCO','QUARTA',2),('Cozinha','Fogão','ALMOCO','QUINTA',2),
  ('Cozinha','Fogão','ALMOCO','SEXTA',2),('Cozinha','Fogão','ALMOCO','SABADO',2),
  ('Cozinha','Fogão','ALMOCO','DOMINGO',2),
  ('Cozinha','Fritadeira','ALMOCO','SEGUNDA',1),('Cozinha','Fritadeira','ALMOCO','TERCA',1),
  ('Cozinha','Fritadeira','ALMOCO','QUARTA',1),('Cozinha','Fritadeira','ALMOCO','QUINTA',1),
  ('Cozinha','Fritadeira','ALMOCO','SEXTA',1),('Cozinha','Fritadeira','ALMOCO','SABADO',1),
  ('Cozinha','Fritadeira','ALMOCO','DOMINGO',1),
  ('Cozinha','Sobremesa','ALMOCO','SEGUNDA',1),('Cozinha','Sobremesa','ALMOCO','TERCA',1),
  ('Cozinha','Sobremesa','ALMOCO','QUARTA',1),('Cozinha','Sobremesa','ALMOCO','QUINTA',1),
  ('Cozinha','Sobremesa','ALMOCO','SEXTA',1),('Cozinha','Sobremesa','ALMOCO','SABADO',1),
  ('Cozinha','Sobremesa','ALMOCO','DOMINGO',1),
  ('Cozinha','Subchefe Plantão','ALMOCO','SEGUNDA',1),('Cozinha','Subchefe Plantão','ALMOCO','TERCA',1),
  ('Cozinha','Subchefe Plantão','ALMOCO','QUARTA',1),('Cozinha','Subchefe Plantão','ALMOCO','QUINTA',1),
  ('Cozinha','Subchefe Plantão','ALMOCO','SEXTA',1),('Cozinha','Subchefe Plantão','ALMOCO','SABADO',1),
  ('Cozinha','Subchefe Plantão','ALMOCO','DOMINGO',1),
  ('Cozinha','Fogão','JANTAR','SEGUNDA',1),('Cozinha','Fogão','JANTAR','TERCA',1),
  ('Cozinha','Fogão','JANTAR','QUARTA',1),('Cozinha','Fogão','JANTAR','QUINTA',1),
  ('Cozinha','Fogão','JANTAR','SEXTA',2),('Cozinha','Fogão','JANTAR','SABADO',2),
  ('Cozinha','Fogão','JANTAR','DOMINGO',1),
  ('Cozinha','Fritadeira','JANTAR','SEGUNDA',1),('Cozinha','Fritadeira','JANTAR','TERCA',1),
  ('Cozinha','Fritadeira','JANTAR','QUARTA',1),('Cozinha','Fritadeira','JANTAR','QUINTA',1),
  ('Cozinha','Fritadeira','JANTAR','SEXTA',1),('Cozinha','Fritadeira','JANTAR','SABADO',1),
  ('Cozinha','Fritadeira','JANTAR','DOMINGO',1),
  ('Cozinha','Sobremesa','JANTAR','SEGUNDA',1),('Cozinha','Sobremesa','JANTAR','TERCA',1),
  ('Cozinha','Sobremesa','JANTAR','QUARTA',1),('Cozinha','Sobremesa','JANTAR','QUINTA',1),
  ('Cozinha','Sobremesa','JANTAR','SEXTA',1),('Cozinha','Sobremesa','JANTAR','SABADO',1),
  ('Cozinha','Sobremesa','JANTAR','DOMINGO',1),
  ('Cozinha','Subchefe Plantão','JANTAR','SEGUNDA',1),('Cozinha','Subchefe Plantão','JANTAR','TERCA',1),
  ('Cozinha','Subchefe Plantão','JANTAR','QUARTA',1),('Cozinha','Subchefe Plantão','JANTAR','QUINTA',1),
  ('Cozinha','Subchefe Plantão','JANTAR','SEXTA',1),('Cozinha','Subchefe Plantão','JANTAR','SABADO',1),
  ('Cozinha','Subchefe Plantão','JANTAR','DOMINGO',1),
  -- BAR
  ('Bar','Bar Almoço','ALMOCO','SEGUNDA',4),('Bar','Bar Almoço','ALMOCO','TERCA',4),
  ('Bar','Bar Almoço','ALMOCO','QUARTA',4),('Bar','Bar Almoço','ALMOCO','QUINTA',5),
  ('Bar','Bar Almoço','ALMOCO','SEXTA',9),('Bar','Bar Almoço','ALMOCO','SABADO',8),
  ('Bar','Bar Almoço','ALMOCO','DOMINGO',6),
  ('Bar','Bar Jantar','JANTAR','SEGUNDA',5),('Bar','Bar Jantar','JANTAR','TERCA',5),
  ('Bar','Bar Jantar','JANTAR','QUARTA',5),('Bar','Bar Jantar','JANTAR','QUINTA',7),
  ('Bar','Bar Jantar','JANTAR','SEXTA',9),('Bar','Bar Jantar','JANTAR','SABADO',8),
  ('Bar','Bar Jantar','JANTAR','DOMINGO',6),
  -- SERVICOS GERAIS
  ('Serviços Gerais','Serv. Gerais Almoço','ALMOCO','SEGUNDA',3),('Serviços Gerais','Serv. Gerais Almoço','ALMOCO','TERCA',3),
  ('Serviços Gerais','Serv. Gerais Almoço','ALMOCO','QUARTA',3),('Serviços Gerais','Serv. Gerais Almoço','ALMOCO','QUINTA',4),
  ('Serviços Gerais','Serv. Gerais Almoço','ALMOCO','SEXTA',4),('Serviços Gerais','Serv. Gerais Almoço','ALMOCO','SABADO',4),
  ('Serviços Gerais','Serv. Gerais Almoço','ALMOCO','DOMINGO',4),
  ('Serviços Gerais','Serv. Gerais Jantar','JANTAR','SEGUNDA',3),('Serviços Gerais','Serv. Gerais Jantar','JANTAR','TERCA',3),
  ('Serviços Gerais','Serv. Gerais Jantar','JANTAR','QUARTA',3),('Serviços Gerais','Serv. Gerais Jantar','JANTAR','QUINTA',4),
  ('Serviços Gerais','Serv. Gerais Jantar','JANTAR','SEXTA',4),('Serviços Gerais','Serv. Gerais Jantar','JANTAR','SABADO',4),
  ('Serviços Gerais','Serv. Gerais Jantar','JANTAR','DOMINGO',4),
  -- PRODUCAO
  ('Produção','Produção Almoço','ALMOCO','SEGUNDA',6),('Produção','Produção Almoço','ALMOCO','TERCA',6),
  ('Produção','Produção Almoço','ALMOCO','QUARTA',6),('Produção','Produção Almoço','ALMOCO','QUINTA',6),
  ('Produção','Produção Almoço','ALMOCO','SEXTA',6),('Produção','Produção Almoço','ALMOCO','SABADO',6),
  ('Produção','Produção Almoço','ALMOCO','DOMINGO',5),
  ('Produção','Produção Tarde','TARDE','SEGUNDA',5),('Produção','Produção Tarde','TARDE','TERCA',5),
  ('Produção','Produção Tarde','TARDE','QUARTA',5),('Produção','Produção Tarde','TARDE','QUINTA',5),
  ('Produção','Produção Tarde','TARDE','SEXTA',5),('Produção','Produção Tarde','TARDE','SABADO',0),
  ('Produção','Produção Tarde','TARDE','DOMINGO',0)
) AS v(setor, nome_praca, turno, dia_semana, qtd)
ON CONFLICT (unit_id, setor, nome_praca, turno, dia_semana) DO NOTHING;