CREATE OR REPLACE FUNCTION public.sync_funcionarios_secullum(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_banco_id INTEGER := 75820;

  v_cnpjs_administrativos TEXT[] := ARRAY[
    '37.119.545/0004-74',
    '35.631.524/0001-65',
    '35.631.524/0007-50',
    '21.131.221/0005-00'
  ];

  v_funcionario JSONB;
  v_cnpj TEXT;
  v_unit_id UUID;
  v_secullum_id INTEGER;
  v_nome TEXT;
  v_cpf TEXT;
  v_phone TEXT;
  v_demissao TEXT;
  v_active BOOLEAN;
  v_gender TEXT;
  v_job_title TEXT;
  v_employee_id UUID;
  v_employee_estava_ativo BOOLEAN;
  v_manual_id UUID;

  v_total INTEGER := 0;
  v_inseridos INTEGER := 0;
  v_atualizados INTEGER := 0;
  v_reconciliados INTEGER := 0;
  v_inativados INTEGER := 0;
  v_inativos_ignorados INTEGER := 0;
  v_sem_unidade INTEGER := 0;
  v_administrativos_pulados INTEGER := 0;
  v_erros INTEGER := 0;
  v_inicio TIMESTAMPTZ := NOW();
  v_unidades_nao_mapeadas JSONB := '[]'::JSONB;
  v_erros_detalhes JSONB := '[]'::JSONB;
  v_audit_table_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'inativacoes_audit_log'
  ) INTO v_audit_table_exists;

  FOR v_funcionario IN
    SELECT * FROM jsonb_array_elements(p_payload->'funcionarios')
  LOOP
    v_total := v_total + 1;

    BEGIN
      v_secullum_id := (v_funcionario->>'Id')::INTEGER;
      v_nome := TRIM(v_funcionario->>'Nome');
      v_cpf := regexp_replace(COALESCE(v_funcionario->>'Cpf', ''), '[^0-9]', '', 'g');
      v_phone := COALESCE(NULLIF(v_funcionario->>'Celular', ''), NULLIF(v_funcionario->>'Telefone', ''), '');
      v_demissao := v_funcionario->>'Demissao';
      v_active := (v_demissao IS NULL);
      v_gender := CASE WHEN (v_funcionario->>'Masculino')::BOOLEAN THEN 'M' ELSE 'F' END;
      v_job_title := TRIM(COALESCE(v_funcionario->'Funcao'->>'Descricao', ''));
      v_cnpj := v_funcionario->'Empresa'->>'Documento';

      IF v_cnpj = ANY(v_cnpjs_administrativos) THEN
        v_administrativos_pulados := v_administrativos_pulados + 1;
        CONTINUE;
      END IF;

      -- BRANCH 1: INATIVO no Secullum
      IF NOT v_active THEN
        SELECT id, active INTO v_employee_id, v_employee_estava_ativo
        FROM employees
        WHERE banco_id = v_banco_id AND secullum_id = v_secullum_id
        LIMIT 1;

        IF v_employee_id IS NULL THEN
          v_inativos_ignorados := v_inativos_ignorados + 1;
          CONTINUE;
        END IF;

        IF v_employee_estava_ativo THEN
          UPDATE employees
          SET active = FALSE,
              sincronizado_em = NOW(),
              updated_at = NOW()
          WHERE id = v_employee_id;

          v_inativados := v_inativados + 1;

          IF v_audit_table_exists THEN
            BEGIN
              INSERT INTO inativacoes_audit_log (
                employee_id, acao, motivo,
                estado_anterior, estado_novo,
                contexto
              ) VALUES (
                v_employee_id,
                'inativar',
                'Detectado como demitido no Secullum',
                jsonb_build_object('active', TRUE),
                jsonb_build_object('active', FALSE, 'demissao_secullum', v_demissao),
                jsonb_build_object(
                  'origem', 'sync_funcionarios_secullum_v5',
                  'secullum_id', v_secullum_id,
                  'data_demissao_secullum', v_demissao
                )
              );
            EXCEPTION WHEN OTHERS THEN
              NULL;
            END;
          END IF;
        ELSE
          UPDATE employees
          SET sincronizado_em = NOW()
          WHERE id = v_employee_id;
        END IF;

        CONTINUE;
      END IF;

      -- BRANCH 2: ATIVO no Secullum
      SELECT id INTO v_unit_id
      FROM config_lojas
      WHERE cnpj = v_cnpj
      LIMIT 1;

      IF v_unit_id IS NULL THEN
        v_sem_unidade := v_sem_unidade + 1;
        v_unidades_nao_mapeadas := v_unidades_nao_mapeadas ||
          jsonb_build_object(
            'cnpj', v_cnpj,
            'nome_secullum', v_funcionario->'Empresa'->>'Nome',
            'funcionario_id_secullum', v_secullum_id,
            'funcionario_nome', v_nome
          );
        CONTINUE;
      END IF;

      -- RECONCILIAÇÃO POR CPF (novo):
      -- Se já existe cadastro Secullum por (banco_id, secullum_id), nem tenta reconciliar.
      SELECT id INTO v_employee_id
      FROM employees
      WHERE banco_id = v_banco_id AND secullum_id = v_secullum_id
      LIMIT 1;

      IF v_employee_id IS NULL AND v_cpf IS NOT NULL AND length(v_cpf) = 11 THEN
        SELECT id INTO v_manual_id
        FROM employees
        WHERE unit_id = v_unit_id
          AND active = TRUE
          AND secullum_id IS NULL
          AND regexp_replace(COALESCE(cpf, ''), '[^0-9]', '', 'g') = v_cpf
        ORDER BY created_at ASC
        LIMIT 1;

        IF v_manual_id IS NOT NULL THEN
          UPDATE employees
          SET name = v_nome,
              cpf = v_cpf,
              active = TRUE,
              worker_type = 'clt',
              unit_id = v_unit_id,
              banco_id = v_banco_id,
              secullum_id = v_secullum_id,
              job_title = COALESCE(NULLIF(v_job_title, ''), job_title),
              phone = COALESCE(NULLIF(v_phone, ''), phone),
              gender = v_gender,
              aguardando_secullum = FALSE,
              sincronizado_em = NOW(),
              updated_at = NOW()
          WHERE id = v_manual_id;

          v_reconciliados := v_reconciliados + 1;
          CONTINUE;
        END IF;
      END IF;

      -- UPSERT padrão por (banco_id, secullum_id)
      v_employee_estava_ativo := (v_employee_id IS NOT NULL);

      INSERT INTO employees (
        name, cpf, active, worker_type,
        unit_id, banco_id, secullum_id,
        job_title, phone, gender,
        aguardando_secullum, sincronizado_em
      )
      VALUES (
        v_nome, v_cpf, TRUE, 'clt',
        v_unit_id, v_banco_id, v_secullum_id,
        v_job_title, v_phone, v_gender,
        FALSE, NOW()
      )
      ON CONFLICT (banco_id, secullum_id) DO UPDATE
      SET name = EXCLUDED.name,
          cpf = EXCLUDED.cpf,
          active = TRUE,
          unit_id = EXCLUDED.unit_id,
          job_title = EXCLUDED.job_title,
          phone = EXCLUDED.phone,
          gender = EXCLUDED.gender,
          aguardando_secullum = FALSE,
          sincronizado_em = NOW(),
          updated_at = NOW();

      IF v_employee_estava_ativo THEN
        v_atualizados := v_atualizados + 1;
      ELSE
        v_inseridos := v_inseridos + 1;
      END IF;

    EXCEPTION WHEN OTHERS THEN
      v_erros := v_erros + 1;
      v_erros_detalhes := v_erros_detalhes || jsonb_build_object(
        'funcionario_id_secullum', v_secullum_id,
        'funcionario_nome', v_nome,
        'cnpj_empresa', v_cnpj,
        'demissao', v_demissao,
        'sqlerrm', SQLERRM,
        'sqlstate', SQLSTATE
      );
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'status', CASE
      WHEN v_erros > 0 THEN 'COM_ERROS'
      WHEN v_sem_unidade > 0 THEN 'OK_COM_GAPS'
      ELSE 'OK'
    END,
    'total_recebidos', v_total,
    'inseridos', v_inseridos,
    'atualizados', v_atualizados,
    'reconciliados', v_reconciliados,
    'inativados', v_inativados,
    'inativos_ignorados', v_inativos_ignorados,
    'sem_unidade', v_sem_unidade,
    'administrativos_pulados', v_administrativos_pulados,
    'erros', v_erros,
    'erros_detalhes', v_erros_detalhes,
    'duracao_ms', EXTRACT(EPOCH FROM (NOW() - v_inicio)) * 1000,
    'unidades_nao_mapeadas', v_unidades_nao_mapeadas,
    'banco_id', v_banco_id,
    'audit_log_disponivel', v_audit_table_exists,
    'processado_em', v_inicio,
    'versao', 'v5_reconcile_by_cpf'
  );
END;
$function$;