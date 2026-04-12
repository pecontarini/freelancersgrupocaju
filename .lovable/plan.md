

# Plano: Padronizar Nomes e Cargos em CAPS LOCK nas Escalas

## Resumo
Aplicar `uppercase` (CSS ou `.toUpperCase()`) em todos os pontos de exibição de nomes de funcionários e cargos nos componentes do módulo de escalas, garantindo visual padronizado e premium.

## Abordagem
Usar a classe Tailwind `uppercase` nos elementos de texto que exibem nomes e cargos. Isso mantém os dados originais intactos no banco e aplica a transformação apenas visualmente.

## Arquivos e Pontos de Mudança

| Arquivo | O que muda |
|---------|-----------|
| `src/components/escalas/ManualScheduleGrid.tsx` | `emp.name` (linhas ~601, ~720) e `emp.job_title` (linhas ~621, ~723) — adicionar `uppercase` |
| `src/components/escalas/WeeklyScheduler.tsx` | `emp.name` (linha ~430) — adicionar `uppercase` |
| `src/components/escalas/MobileScheduler.tsx` | `emp.name` (linhas ~413, ~565) e `emp.job_title` (linha ~567) — adicionar `uppercase` |
| `src/components/escalas/D1SectorAccordion.tsx` | `s.employee_name` (linha ~246) e `s.job_title` (linha ~254) — adicionar `uppercase` |
| `src/components/escalas/D1ManagementPanel.tsx` | `s.employee_name` nos textos de exibição — adicionar `uppercase` |
| `src/components/escalas/TeamManagement.tsx` | `emp.name` (linha ~373) e `emp.job_title` badge (linha ~376) — adicionar `uppercase` |
| `src/components/escalas/FreelancerAddModal.tsx` | Nome do freelancer no Select (linha ~249) — adicionar `uppercase` |
| `src/components/escalas/ScheduleEditModal.tsx` | Nome do funcionário no header do modal — adicionar `uppercase` |

## Exemplo da mudança
```tsx
// Antes
<span className="truncate max-w-[110px]">{emp.name}</span>
<div className="text-[10px] text-muted-foreground truncate">{emp.job_title}</div>

// Depois
<span className="truncate max-w-[110px] uppercase">{emp.name}</span>
<div className="text-[10px] text-muted-foreground truncate uppercase">{emp.job_title}</div>
```

## O que NÃO muda
- Dados no banco de dados (continuam com capitalização original)
- Campos de input/formulário (digitação livre)
- Mensagens de WhatsApp (mantêm formatação natural para comunicação)
- Relatórios PDF/Excel (mantêm formatação existente)

