// ============================================
// LEADERSHIP PERFORMANCE CALCULATOR
// Edge Function for continuous performance calculation
// Triggered by: audit inserts, manual backfill, rule updates
// ============================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================
// TYPES
// ============================================

type AuditChecklistType = 'SUPERVISOR' | 'FISCAL' | 'AUDITORIA_DE_ALIMENTOS';
type LeadershipPositionCode = 
  | 'chefe_salao' | 'chefe_apv' | 'chefe_parrilla' 
  | 'chefe_bar' | 'chefe_cozinha' | 'gerente_back' | 'gerente_front';
type AuditSectorCode = 
  | 'salao' | 'area_comum' | 'documentos' | 'lavagem' | 'delivery'
  | 'asg' | 'manutencao' | 'brinquedoteca' | 'recepcao'
  | 'estoque' | 'cozinha' | 'cozinha_quente' | 'saladas_sobremesas'
  | 'parrilla' | 'sushi' | 'bar' | 'dml' | 'outros';

interface AuditScoreEntry {
  id: string;
  auditId: string;
  lojaId: string;
  sector: AuditSectorCode;
  checklistType: AuditChecklistType;
  score: number;
  auditDate: string;
  monthYear: string;
}

interface PositionBreakdown {
  checklistType: AuditChecklistType;
  label: string;
  averageScore: number;
  weight: number;
  auditCount: number;
}

// ============================================
// CONSTANTS
// ============================================

const AUDIT_TYPE_WEIGHTS: Record<AuditChecklistType, number> = {
  SUPERVISOR: 2,
  FISCAL: 1,
  AUDITORIA_DE_ALIMENTOS: 1,
};

const AUDIT_TYPE_LABELS: Record<AuditChecklistType, string> = {
  SUPERVISOR: 'Supervisão',
  FISCAL: 'Fiscal',
  AUDITORIA_DE_ALIMENTOS: 'Auditoria de Alimentos',
};

const POSITION_ROUTING_RULES: Record<LeadershipPositionCode, {
  rules: Partial<Record<AuditChecklistType, AuditSectorCode[] | null>>;
  areaType: 'front' | 'back';
}> = {
  chefe_salao: {
    rules: {
      SUPERVISOR: ['salao'],
      FISCAL: ['salao'],
      AUDITORIA_DE_ALIMENTOS: ['salao'],
    },
    areaType: 'front',
  },
  chefe_apv: {
    rules: {
      SUPERVISOR: ['delivery', 'asg', 'manutencao', 'brinquedoteca', 'recepcao'],
      FISCAL: null,
      AUDITORIA_DE_ALIMENTOS: ['lavagem', 'documentos'],
    },
    areaType: 'front',
  },
  chefe_parrilla: {
    rules: {
      SUPERVISOR: ['parrilla'],
      FISCAL: ['parrilla'],
      AUDITORIA_DE_ALIMENTOS: ['parrilla'],
    },
    areaType: 'back',
  },
  chefe_bar: {
    rules: {
      SUPERVISOR: ['bar'],
      FISCAL: ['bar'],
      AUDITORIA_DE_ALIMENTOS: ['bar'],
    },
    areaType: 'back',
  },
  chefe_cozinha: {
    rules: {
      SUPERVISOR: ['cozinha'],
      FISCAL: ['cozinha_quente', 'saladas_sobremesas'],
      AUDITORIA_DE_ALIMENTOS: ['cozinha'],
    },
    areaType: 'back',
  },
  gerente_back: {
    rules: {
      SUPERVISOR: ['estoque', 'cozinha', 'sushi', 'parrilla', 'bar', 'dml'],
      FISCAL: ['estoque', 'cozinha', 'cozinha_quente', 'saladas_sobremesas', 'sushi', 'parrilla', 'bar', 'dml'],
      AUDITORIA_DE_ALIMENTOS: ['estoque', 'cozinha', 'sushi', 'parrilla', 'bar', 'dml'],
    },
    areaType: 'back',
  },
  gerente_front: {
    rules: {
      SUPERVISOR: ['salao', 'area_comum', 'documentos', 'lavagem', 'delivery', 'asg', 'manutencao', 'brinquedoteca', 'recepcao'],
      FISCAL: ['salao', 'area_comum'],
      AUDITORIA_DE_ALIMENTOS: ['salao', 'area_comum', 'documentos', 'lavagem'],
    },
    areaType: 'front',
  },
};

const SECTOR_KEYWORDS: Record<AuditSectorCode, string[]> = {
  salao: ['salão', 'salao', 'mesa', 'cadeira', 'atendimento', 'cardápio', 'cliente', 'ambiente', 'decoração', 'garçom', 'garcom'],
  area_comum: ['área comum', 'area comum', 'corredor', 'escada', 'elevador', 'hall', 'banheiro', 'sanitário', 'sanitario', 'wc', 'toalete', 'lavabo', 'fachada', 'letreiro', 'luminoso', 'calçada', 'estacionamento'],
  documentos: ['documentos', 'documento', 'alvará', 'alvara', 'licença', 'licenca', 'certificado', 'registro', 'fiscalização'],
  lavagem: ['lavagem', 'lavar', 'louça', 'louca', 'copa', 'higienização louça', 'área de lavagem'],
  delivery: ['delivery', 'ifood', 'entrega', 'aplicativo', 'motoboy', 'rappi', 'uber eats', 'expedição', 'expedicao'],
  asg: ['asg', 'auxiliar serviços gerais', 'serviços gerais', 'limpeza geral', 'higienização'],
  manutencao: ['manutenção', 'manutencao', 'ar condicionado', 'elétrica', 'eletrica', 'hidráulica', 'hidraulica', 'reparo', 'equipamento'],
  brinquedoteca: ['brinquedoteca', 'espaço kids', 'espaco kids', 'criança', 'crianca', 'playground', 'recreação', 'recreacao'],
  recepcao: ['recepção', 'recepcao', 'hostess', 'entrada', 'fila', 'reserva', 'espera'],
  estoque: ['estoque', 'armazenamento', 'validade', 'etiqueta', 'organização', 'fifo', 'peps', 'depósito', 'deposito', 'recebimento', 'fornecedor', 'nota fiscal'],
  cozinha: ['cozinha', 'preparo', 'alimento', 'temperatura', 'geladeira', 'freezer', 'manipulação', 'cocção'],
  cozinha_quente: ['cozinha quente', 'fogão', 'fogao', 'forno', 'chapa', 'fritura', 'fritadeira', 'panela'],
  saladas_sobremesas: ['salada', 'sobremesa', 'fria', 'cold', 'dessert', 'confeitaria', 'doce', 'fruta', 'verdura', 'legume'],
  parrilla: ['parrilla', 'churrasqueira', 'grelhado', 'carne', 'brasa', 'parrillero', 'grelha', 'churrasco'],
  sushi: ['sushi', 'japonês', 'japones', 'sashimi', 'temaki', 'oriental', 'peixe cru', 'niguiri'],
  bar: ['bar', 'bebida', 'drink', 'coquetel', 'cerveja', 'vinho', 'gelo', 'bebidas', 'bartender'],
  dml: ['dml', 'depósito material limpeza', 'produtos químicos', 'quimicos', 'material de limpeza', 'detergente', 'desinfetante'],
  outros: ['higiene', 'outros', 'geral'],
};

const TIER_THRESHOLDS = [
  { tier: 'ouro', minScore: 95 },
  { tier: 'prata', minScore: 90 },
  { tier: 'bronze', minScore: 85 },
  { tier: 'red_flag', minScore: 0 },
];

// ============================================
// HELPER FUNCTIONS
// ============================================

function normalizeText(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function categorizeSector(itemName: string, category?: string | null): AuditSectorCode {
  const searchText = normalizeText(`${itemName} ${category || ''}`);

  // Check category first (more accurate)
  if (category) {
    const categoryLower = normalizeText(category);
    for (const [sectorCode, keywords] of Object.entries(SECTOR_KEYWORDS)) {
      const normalized = keywords.map(normalizeText);
      if (normalized.some(kw => categoryLower.includes(kw))) {
        return sectorCode as AuditSectorCode;
      }
    }
  }

  // Then check item name
  for (const [sectorCode, keywords] of Object.entries(SECTOR_KEYWORDS)) {
    const normalized = keywords.map(normalizeText);
    if (normalized.some(kw => searchText.includes(kw))) {
      return sectorCode as AuditSectorCode;
    }
  }

  return 'outros';
}

function detectChecklistType(category?: string | null): AuditChecklistType {
  const searchText = (category || '').toLowerCase();
  if (searchText.includes('fiscal')) return 'FISCAL';
  if (searchText.includes('alimento') || searchText.includes('food')) return 'AUDITORIA_DE_ALIMENTOS';
  return 'SUPERVISOR';
}

function getTier(score: number): string {
  for (const t of TIER_THRESHOLDS) {
    if (score >= t.minScore) return t.tier;
  }
  return 'red_flag';
}

function isSectorValidForPosition(
  position: LeadershipPositionCode,
  sector: AuditSectorCode,
  checklistType: AuditChecklistType
): boolean {
  const rule = POSITION_ROUTING_RULES[position];
  if (!rule) return false;
  const validSectors = rule.rules[checklistType];
  if (!validSectors) return false;
  return validSectors.includes(sector);
}

function getValidChecklistTypesForPosition(position: LeadershipPositionCode): AuditChecklistType[] {
  const rule = POSITION_ROUTING_RULES[position];
  if (!rule) return [];
  const types: AuditChecklistType[] = [];
  for (const [type, sectors] of Object.entries(rule.rules)) {
    if (sectors !== null && sectors !== undefined) {
      types.push(type as AuditChecklistType);
    }
  }
  return types;
}

// ============================================
// CALCULATION ENGINE
// ============================================

function createScoreEntries(
  audits: Array<{ id: string; loja_id: string; audit_date: string; global_score: number }>,
  failures: Array<{ audit_id: string; loja_id: string; item_name: string; category?: string | null }>
): AuditScoreEntry[] {
  const entries: AuditScoreEntry[] = [];

  for (const audit of audits) {
    const auditDate = new Date(audit.audit_date);
    const monthYear = `${auditDate.getFullYear()}-${String(auditDate.getMonth() + 1).padStart(2, '0')}`;
    
    // Detect checklist type from failures
    const auditFailures = failures.filter(f => f.audit_id === audit.id);
    const checklistType = detectChecklistType(auditFailures[0]?.category);

    // Use the REAL global_score from the PDF directly - ONE entry per audit
    entries.push({
      id: audit.id,
      auditId: audit.id,
      lojaId: audit.loja_id,
      sector: 'outros', // Sector is irrelevant for whole-store audits
      checklistType,
      score: audit.global_score, // EXACT score from the PDF
      auditDate: audit.audit_date,
      monthYear,
    });
  }

  return entries;
}

function calculatePositionPerformance(
  position: LeadershipPositionCode,
  scores: AuditScoreEntry[]
): { finalScore: number | null; tier: string | null; breakdown: PositionBreakdown[]; totalAudits: number } {
  // Filter by checklist type only (not sector) since audits are whole-store
  const validTypes = getValidChecklistTypesForPosition(position);
  const validScores = scores.filter(entry => validTypes.includes(entry.checklistType));

  // Group by checklist type
  const groups = new Map<AuditChecklistType, AuditScoreEntry[]>();
  for (const entry of validScores) {
    const existing = groups.get(entry.checklistType) || [];
    existing.push(entry);
    groups.set(entry.checklistType, existing);
  }

  // Calculate averages per type
  const typeAverages = new Map<AuditChecklistType, { average: number; count: number }>();
  for (const [type, entries] of groups) {
    const sum = entries.reduce((acc, e) => acc + e.score, 0);
    typeAverages.set(type, { average: sum / entries.length, count: entries.length });
  }

  // Build breakdown
  const breakdown: PositionBreakdown[] = validTypes
    .map(type => {
      const data = typeAverages.get(type);
      return {
        checklistType: type,
        label: AUDIT_TYPE_LABELS[type],
        averageScore: data?.average ?? 0,
        weight: AUDIT_TYPE_WEIGHTS[type],
        auditCount: data?.count ?? 0,
      };
    })
    .filter(b => b.auditCount > 0);

  // Calculate weighted average
  let weightedSum = 0;
  let totalWeight = 0;
  for (const [type, { average }] of typeAverages) {
    const weight = AUDIT_TYPE_WEIGHTS[type];
    weightedSum += average * weight;
    totalWeight += weight;
  }

  if (totalWeight === 0) {
    return { finalScore: null, tier: null, breakdown, totalAudits: validScores.length };
  }

  const finalScore = weightedSum / totalWeight;
  return {
    finalScore,
    tier: getTier(finalScore),
    breakdown,
    totalAudits: validScores.length,
  };
}

// ============================================
// MAIN HANDLER
// ============================================

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { 
      action = 'calculate', // 'calculate' | 'backfill'
      loja_id,
      month_year,
      trigger_type = 'manual',
      trigger_audit_id,
    } = body;

    console.log(`[calculate-leadership-performance] Action: ${action}, Store: ${loja_id || 'all'}, Month: ${month_year || 'all'}`);

    // Create calculation log entry
    const { data: logEntry, error: logError } = await supabase
      .from('leadership_calculation_log')
      .insert({
        loja_id: loja_id || null,
        month_year: month_year || null,
        trigger_type,
        trigger_audit_id: trigger_audit_id || null,
        status: 'running',
      })
      .select()
      .single();

    if (logError) {
      console.error('Failed to create log entry:', logError);
    }

    // Fetch audits
    let auditsQuery = supabase.from('supervision_audits').select('id, loja_id, audit_date, global_score');
    if (loja_id) {
      auditsQuery = auditsQuery.eq('loja_id', loja_id);
    }
    if (month_year) {
      const [year, month] = month_year.split('-');
      const startDate = `${year}-${month}-01`;
      const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
      const endDate = `${year}-${month}-${lastDay}`;
      auditsQuery = auditsQuery.gte('audit_date', startDate).lte('audit_date', endDate);
    }

    const { data: audits, error: auditsError } = await auditsQuery;
    if (auditsError) throw auditsError;

    // Fetch failures
    const auditIds = audits?.map(a => a.id) || [];
    let failures: Array<{ audit_id: string; loja_id: string; item_name: string; category: string | null }> = [];
    
    if (auditIds.length > 0) {
      const { data: failuresData, error: failuresError } = await supabase
        .from('supervision_failures')
        .select('audit_id, loja_id, item_name, category')
        .in('audit_id', auditIds);
      
      if (failuresError) throw failuresError;
      failures = failuresData || [];
    }

    // Create score entries
    const scoreEntries = createScoreEntries(audits || [], failures);

    // Group by store and month
    const storeMonthGroups = new Map<string, AuditScoreEntry[]>();
    for (const entry of scoreEntries) {
      const key = `${entry.lojaId}|${entry.monthYear}`;
      const existing = storeMonthGroups.get(key) || [];
      existing.push(entry);
      storeMonthGroups.set(key, existing);
    }

    // Calculate and upsert scores
    const positions: LeadershipPositionCode[] = [
      'chefe_salao', 'chefe_apv', 'chefe_parrilla', 
      'chefe_bar', 'chefe_cozinha', 'gerente_front', 'gerente_back'
    ];

    let positionsUpdated = 0;
    let storesUpdated = 0;

    for (const [key, entries] of storeMonthGroups) {
      const [lojaId, monthYear] = key.split('|');
      storesUpdated++;

      // Calculate position scores
      for (const position of positions) {
        const result = calculatePositionPerformance(position, entries);
        
        // Upsert to leadership_performance_scores
        const { error: upsertError } = await supabase
          .from('leadership_performance_scores')
          .upsert({
            loja_id: lojaId,
            month_year: monthYear,
            position_code: position,
            final_score: result.finalScore,
            tier: result.tier,
            breakdown: result.breakdown,
            total_audits: result.totalAudits,
            needs_review: false,
            review_reasons: [],
            calculated_at: new Date().toISOString(),
          }, {
            onConflict: 'loja_id,month_year,position_code',
          });

        if (upsertError) {
          console.error(`Failed to upsert score for ${position}:`, upsertError);
        } else {
          positionsUpdated++;
        }
      }

      // Calculate store-level scores using REAL global_scores directly
      const storeAudits = (audits || []).filter(a => a.loja_id === lojaId);
      const storeAuditScores = storeAudits.map(a => a.global_score);
      const generalScore = storeAuditScores.length > 0 
        ? storeAuditScores.reduce((a, b) => a + b, 0) / storeAuditScores.length 
        : null;

      // Front/Back scores are the same as general for whole-store audits
      const frontScore = generalScore;
      const backScore = generalScore;

      const storeFailures = failures.filter(f => f.loja_id === lojaId);
      const { error: storeUpsertError } = await supabase
        .from('leadership_store_scores')
        .upsert({
          loja_id: lojaId,
          month_year: monthYear,
          general_score: generalScore,
          front_score: frontScore,
          back_score: backScore,
          general_tier: generalScore !== null ? getTier(generalScore) : null,
          front_tier: frontScore !== null ? getTier(frontScore) : null,
          back_tier: backScore !== null ? getTier(backScore) : null,
          total_audits: storeAudits.length,
          total_failures: storeFailures.length,
          front_failures: 0, // Will be populated when sector-specific audits are available
          back_failures: 0,
          calculated_at: new Date().toISOString(),
        }, {
          onConflict: 'loja_id,month_year',
        });

      if (storeUpsertError) {
        console.error('Failed to upsert store scores:', storeUpsertError);
      }
    }

    // Update log entry
    if (logEntry) {
      await supabase
        .from('leadership_calculation_log')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          positions_updated: positionsUpdated,
          stores_updated: storesUpdated,
        })
        .eq('id', logEntry.id);
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Calculated performance for ${storesUpdated} store-months, ${positionsUpdated} position scores updated`,
      storesProcessed: storesUpdated,
      positionsUpdated,
      auditsProcessed: audits?.length || 0,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error('[calculate-leadership-performance] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
