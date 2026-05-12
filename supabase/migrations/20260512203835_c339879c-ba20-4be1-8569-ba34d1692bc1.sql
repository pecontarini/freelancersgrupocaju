BEGIN;

UPDATE public.sheets_sources
   SET url = 'https://docs.google.com/spreadsheets/d/1r9OO3nrT24P110wdEgaD439ndbpOC22Q/export?format=csv&gid=1524681073',
       ultimo_status = 'pendente'
 WHERE meta_key = 'salmao_diario';

UPDATE public.sheets_sources
   SET meta_key = 'kds-salao',
       nome = 'KDS · Salão',
       ultimo_status = 'pendente'
 WHERE meta_key = 'kds';

UPDATE public.sheets_sources
   SET meta_key = 'kds-delivery',
       nome = 'KDS · Delivery',
       gid = '860710009',
       url = REPLACE(url, 'gid=0', 'gid=860710009'),
       ultimo_status = 'pendente'
 WHERE meta_key = 'target-preto';

INSERT INTO public.sheets_sources (nome, url, gid, meta_key, ativo, sync_diario, ultimo_status)
VALUES
  ('Painel de Metas · Regras',
   'https://docs.google.com/spreadsheets/d/19FL9uaJbmVxPiKHYMM6DRX51M9W8pFvrJt9qOljmUzQ/export?format=csv&gid=0',
   '0', 'payout_rules', true, false, 'pendente'),
  ('Painel de Metas · Registro',
   'https://docs.google.com/spreadsheets/d/19FL9uaJbmVxPiKHYMM6DRX51M9W8pFvrJt9qOljmUzQ/export?format=csv&gid=1280942689',
   '1280942689', 'payout_registry', true, true, 'pendente'),
  ('Painel de Metas · Consolidado',
   'https://docs.google.com/spreadsheets/d/19FL9uaJbmVxPiKHYMM6DRX51M9W8pFvrJt9qOljmUzQ/export?format=csv&gid=2027103192',
   '2027103192', 'payout_consolidated', true, false, 'pendente'),
  ('Painel de Metas · Target por Cargo',
   'https://docs.google.com/spreadsheets/d/19FL9uaJbmVxPiKHYMM6DRX51M9W8pFvrJt9qOljmUzQ/export?format=csv&gid=561096327',
   '561096327', 'payout_target_by_role', true, false, 'pendente');

DO $verify$
DECLARE
  v_salmao_url text;
  v_kds_salao int;
  v_kds_delivery int;
  v_old_kds int;
  v_old_target int;
  v_payout_count int;
  v_active_total int;
BEGIN
  SELECT url INTO v_salmao_url FROM public.sheets_sources WHERE meta_key = 'salmao_diario';
  IF v_salmao_url IS NULL OR v_salmao_url NOT LIKE '%gid=1524681073' THEN
    RAISE EXCEPTION 'AJUSTE 1 falhou: salmao_diario url=%', v_salmao_url;
  END IF;

  SELECT count(*) INTO v_kds_salao FROM public.sheets_sources WHERE meta_key = 'kds-salao';
  SELECT count(*) INTO v_kds_delivery FROM public.sheets_sources WHERE meta_key = 'kds-delivery';
  IF v_kds_salao = 0 OR v_kds_delivery = 0 THEN
    RAISE EXCEPTION 'AJUSTE 2 falhou: kds-salao=% kds-delivery=%', v_kds_salao, v_kds_delivery;
  END IF;

  SELECT count(*) INTO v_old_kds FROM public.sheets_sources WHERE meta_key = 'kds';
  SELECT count(*) INTO v_old_target FROM public.sheets_sources WHERE meta_key = 'target-preto';
  IF v_old_kds > 0 OR v_old_target > 0 THEN
    RAISE EXCEPTION 'AJUSTE 2 falhou: ainda existem kds=% target-preto=%', v_old_kds, v_old_target;
  END IF;

  SELECT count(*) INTO v_payout_count FROM public.sheets_sources WHERE meta_key LIKE 'payout_%';
  IF v_payout_count <> 4 THEN
    RAISE EXCEPTION 'AJUSTE 3 falhou: payout_* count=% (esperado 4)', v_payout_count;
  END IF;

  SELECT count(*) INTO v_active_total FROM public.sheets_sources WHERE ativo = true;
  RAISE NOTICE 'sheets_sources ativos: %', v_active_total;
  IF v_active_total < 13 THEN
    RAISE EXCEPTION 'Total de fontes ativas=% (esperado >=13)', v_active_total;
  END IF;

  RAISE NOTICE 'sheets_sources adjustments OK';
END
$verify$;

COMMIT;