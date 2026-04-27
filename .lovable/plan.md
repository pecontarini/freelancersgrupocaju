# Reset do Módulo CMV Unitários

Vamos limpar todo o histórico operacional do CMV, mantendo intactos os itens cadastrados, seus parâmetros (custo, unidade, categoria) e os mapeamentos de vendas/NFe. Assim você reinicia as contagens e a operação do zero, agora com a IA integrada para potencializar o uso.

## O que será PRESERVADO (mantido como está)

| Tabela | Registros | Por quê |
|---|---|---|
| `cmv_items` | 22 ativos | Itens da contagem (carnes + insumos), com nome, categoria, unidade |
| `cmv_items.preco_custo_atual` | — | Preço de custo de cada item permanece |
| `cmv_sales_mappings` | 74 | Mapeamento "nome de venda → item CMV + multiplicador" |
| `cmv_nfe_mappings` | 3 | Mapeamento de itens de NFe |
| `cmv_ignored_items` | 327 | Lista de itens de venda ignorados |

## O que será ZERADO (apagado)

| Tabela | Registros | Conteúdo |
|---|---|---|
| `cmv_contagens` | 252 | Todas as contagens diárias históricas |
| `cmv_camara` | 0 | Contagens da câmara congelada |
| `cmv_praca` | 1 | Contagens da praça |
| `cmv_inventory` | 22 | Saldos correntes de inventário |
| `cmv_movements` | 24 | Movimentações legadas (entradas/saídas) |
| `cmv_vendas_ajuste` | 0 | Ajustes de vendas |
| `cmv_price_history` | 18 | Histórico de variação de preço |
| `cmv_pending_sales_items` | 1 | Itens pendentes de mapeamento |
| `inventory_transactions` (CMV) | 0 | Transações de estoque |
| `daily_stock_positions` | 0 | Snapshots diários de posição |
| `daily_sales` | 2698 | Vendas diárias importadas (serão reimportadas conforme o novo fluxo) |

> Observação: `daily_sales` alimenta o cálculo teórico de consumo. Confirme se quer apagar também — se preferir manter o histórico de vendas, basta dizer e eu removo essa tabela do reset.

## Como será feito

1. Criar uma migração com função SECURITY DEFINER `reset_cmv_module(p_unit_ids uuid[] DEFAULT NULL)`:
   - Restrita a `admin` (via `has_role`)
   - Se `p_unit_ids` for NULL → zera tudo (todas as unidades)
   - Se vier array → zera apenas as unidades selecionadas
   - Retorna JSON com a contagem de registros apagados por tabela
2. Adicionar UI de controle dentro da aba "IA" do `CMVTab.tsx` (ou em um novo card "Zona de Risco"):
   - Botão "Zerar Histórico do CMV"
   - Seletor opcional de unidades (padrão: todas)
   - Modal de confirmação exigindo digitação literal de **`ZERAR CMV`** (padrão do sistema para ações destrutivas)
   - Exibe o relatório retornado (X contagens removidas, Y vendas removidas, etc.)
3. Após o reset, invalidar as queries do React Query (`cmv_*`, `inventory_*`, `daily_*`) para o painel atualizar automaticamente.

## Próximas etapas (após o reset)

Com o módulo zerado, o próximo ciclo será:
- Primeira contagem (T0) por turno → câmara e praça
- Lançamentos diários alimentando IA CMV
- IA passa a sugerir planos de ação assim que houver pelo menos 3 dias de contagens

Posso seguir com a implementação?
