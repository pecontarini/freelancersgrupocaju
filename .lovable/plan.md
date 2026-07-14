# Plano: Documentação UI/UX para Aula com IA (NotebookLM)

## Objetivo
Produzir um pacote de arquivos `.md` em `/mnt/documents/ui-ux-aula/` descrevendo, tela por tela, **layout visual, componentes, fluxos de usuário, microinterações e usabilidade** da plataforma Board (2Sell / CajuPAR / Stutz). O material será otimizado para ingestão em **NotebookLM, Google Veo, Sora, HeyGen, Synthesia** ou similares — com narração pronta e roteiro visual por cena.

## Estrutura de entrega

```text
/mnt/documents/ui-ux-aula/
├── 00_INDICE.md                  ← Mapa completo + ordem sugerida de gravação
├── 01_visao_geral.md             ← O que é o Board, personas, multi-tenant, marca
├── 02_design_system.md           ← Liquid Glass, cores, tipografia, ícones, tokens
├── 03_login_e_onboarding.md      ← /auth, reset senha, tenant resolver
├── 04_layout_shell.md            ← Sidebar, PortalHeader, BottomNav mobile, UnidadeSelector
├── 05_unitarios_gerentes.md      ← Budgets, CMV Unitário, TeamReadinessCard
├── 06_gestao_pessoas.md          ← Escalas, Freelancers, Check-in, Aprovações
├── 07_agenda_lider.md            ← Chat IA, Missões, Planos de ação
├── 08_utensilios.md              ← Contagem, Budget, Matriz, PDF IA, Galeria
├── 09_cmv.md                     ← Semanas, Contagens, Vendas, Desvio
├── 10_estoque.md                 ← Catálogo, Movimentação, Inventários
├── 11_checklist_diario.md        ← POP, correções, closed-loop
├── 12_manutencao_operacional.md  ← Formulários, NF/Boleto, PIX
├── 13_configuracoes_admin.md     ← Tenants, Usuários, Roles, Sheets sync
├── 14_paginas_publicas.md        ← Contagem pública, Check-in estação, Confirm shift
├── 15_fluxos_end_to_end.md       ← 6-8 jornadas completas narradas
└── 16_roteiros_video.md          ← Cenas prontas por tela: narração + ação + tempo
```

## Conteúdo padrão por tela

Cada arquivo de tela seguirá **o mesmo template**, para a IA de vídeo conseguir extrair beats consistentes:

1. **Identidade da tela** — rota, quem acessa (role), tenant, mobile/desktop
2. **Anatomia visual** — descrição do layout em regiões (header, hero, cards, tabelas, footer/actions) com posicionamento e hierarquia
3. **Componentes-chave** — nome do componente shadcn/custom, o que exibe, estados (loading, vazio, erro, sucesso)
4. **Interações** — cliques, hovers, drags, atalhos, feedback háptico, toasts
5. **Fluxo de dados** — de onde vem (hook/tabela), pra onde vai
6. **Usabilidade** — decisões de UX (por que está assim), pontos de atenção, acessibilidade
7. **Narração sugerida (30–60s)** — parágrafo pronto para TTS, tom didático PT-BR
8. **Roteiro visual** — lista de cenas com timestamp, ação de câmera/cursor, elemento a destacar

## Como será construído

- **Varredura sistemática** de `src/pages/`, `src/components/dashboard/`, `escalas/`, `utensilios/`, `cmv/`, `checkin/`, `checklist-daily/`, `agenda-lider/`, `estoque/`, `layout/`, `admin/`
- **Screenshots de referência** — capturar cada tela principal via Playwright em desktop (1280×1800) e mobile (390×844) com sessão autenticada de super admin, salvos em `/mnt/documents/ui-ux-aula/screenshots/` e **referenciados nos .md** para a IA ancorar o vídeo no visual real
- **Reaproveitar** `docs/app-guide-notebooklm.md`, `Claude.md`, `PROJECT_STATE.md`, `ROADMAP.md` como fontes secundárias
- **Índice mestre (`00_INDICE.md`)** com ordem pedagógica sugerida (do macro → micro) e duração estimada por módulo (total ~45–60 min de vídeo)
- **Roteiros (`16_roteiros_video.md`)** já formatados em blocos `SCENE / VISUAL / VOICEOVER / DURATION` — formato que NotebookLM, Veo e HeyGen digerem bem

## Entregável final

Um `.zip` (ou pasta) em `/mnt/documents/ui-ux-aula/` com **~16 arquivos .md + screenshots**, pronto para você:
1. Arrastar para o NotebookLM como fontes → gerar áudio-aula
2. Colar os roteiros no Veo/Sora/HeyGen → gerar vídeos por módulo
3. Editar/reordenar como quiser

## Escopo — o que **não** entra
- Não vou gravar vídeo nem gerar áudio aqui (você usará as IAs externas)
- Não vou refatorar UI existente (é documentação, não redesign)
- Módulos muito nichados (ex: sync Google Sheets interno) entram resumidos, sem template completo

## Perguntas antes de executar
1. **Idioma da narração**: PT-BR (padrão) ou bilíngue PT/EN?
2. **Perspectiva**: aula para **usuário final** (gerente/operador aprendendo a usar) ou **comercial/investidor** (mostrando a plataforma como produto)? Muda o tom da narração.
3. **Screenshots**: capturo com dados reais (super admin vendo Caju) ou prefere dados anonimizados/genéricos?

Se preferir, aprove com "seguir" e eu assumo: **PT-BR, tom usuário final, screenshots com dados Caju reais**.
