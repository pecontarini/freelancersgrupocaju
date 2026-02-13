// ============================================
// LEADERSHIP PERFORMANCE CALCULATOR v2
// "Média de Médias por Setor" engine
// Uses audit_sector_scores as source of truth
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

interface SectorScoreRow {
  id: string;
  audit_id: string;
  loja_id: string;
  sector_code: string;
  checklist_type: string;
  score: number;
  audit_date: string;
  month_year: string;
}

interface PositionBreakdown {
  checklistType: AuditChecklistType;
  label: string;
  averageScore: number;
  weight: number;
  sectorAverages: { sector: string; average: number; count: number }[];
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

const TIER_THRESHOLDS = [
  { tier: 'ouro', minScore: 95 },
  { tier: 'prata', minScore: 90 },
  { tier: 'bronze', minScore: 85 },
  { tier: 'red_flag', minScore: 0 },
];

function getTier(score: number): string {
  for (const t of TIER_THRESHOLDS) {
    if (score >= t.minScore) return t.tier;
  }
  return 'red_flag';
}

// ============================================
// POSITION ROUTING RULES (Regra Mãe)
// ============================================

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

// Sector keywords for fallback categorization from failures
const SECTOR_KEYWORDS: Record<string, string[]> = {
  salao: ['salão', 'salao', 'mesa', 'cadeira', 'atendimento', 'cardápio', 'cliente', 'ambiente', 'garçom', 'garcom'],
  area_comum: ['área comum', 'area comum', 'corredor', 'banheiro', 'sanitário', 'fachada', 'estacionamento'],
  documentos: ['documentos', 'documento', 'alvará', 'licença', 'certificado'],
  lavagem: ['lavagem', 'lavar', 'louça', 'louca', 'copa'],
  delivery: ['delivery', 'ifood', 'entrega', 'motoboy', 'rappi'],
  asg: ['asg', 'serviços gerais', 'limpeza geral', 'higienização'],
  manutencao: ['manutenção', 'manutencao', 'ar condicionado', 'elétrica', 'hidráulica'],
  brinquedoteca: ['brinquedoteca', 'espaço kids', 'criança', 'playground'],
  recepcao: ['recepção', 'recepcao', 'hostess', 'entrada', 'reserva'],
  estoque: ['estoque', 'armazenamento', 'validade', 'fifo', 'depósito', 'recebimento'],
  cozinha: ['cozinha', 'preparo', 'alimento', 'temperatura', 'geladeira', 'freezer'],
  cozinha_quente: ['cozinha quente', 'fogão', 'forno', 'chapa', 'fritura'],
  saladas_sobremesas: ['salada', 'sobremesa', 'fria', 'confeitaria', 'doce', 'fruta', 'verdura'],
  parrilla: ['parrilla', 'churrasqueira', 'grelhado', 'carne', 'brasa', 'grelha'],
  sushi: ['sushi', 'japonês', 'sashimi', 'temaki', 'oriental'],
  bar: ['bar', 'bebida', 'drink', 'coquetel', 'cerveja', 'vinho', 'bartender'],
  dml: ['dml', 'material limpeza', 'produtos químicos', 'detergente'],
  outros: ['outros', 'geral'],
};

function normalizeText(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function categorizeSector(itemName: string, category?: string | null): AuditSectorCode {
  const searchText = normalizeText(`${itemName} ${category || ''}`);
  if (category) {
    const catNorm = normalizeText(category);
    for (const [code, keywords] of Object.entries(SECTOR_KEYWORDS)) {
      if (keywords.map(normalizeText).some(kw => catNorm.includes(kw))) {
        return code as AuditSectorCode;
      }
    }
  }
  for (const [code, keywords] of Object.entries(SECTOR_KEYWORDS)) {
    if (keywords.map(normalizeText).some(kw => searchText.includes(kw))) {
      return code as AuditSectorCode;
    }
  }
  return 'outros';
}

function detectChecklistType(category?: string | null): AuditChecklistType {
  const text = (category || '').toLowerCase();
  if (text.includes('fiscal')) return 'FISCAL';
  if (text.includes('alimento') || text.includes('food')) return 'AUDITORIA_DE_ALIMENTOS';
  return 'SUPERVISOR';
}

// ============================================
// CORE: "Média de Médias por Setor" ENGINE
// ============================================

/**
 * Calculate performance for a position using the "average of averages by sector" logic:
 * 1. Filter sector scores valid for this position per checklist type
 * 2. For each checklist type: average the scores of valid sectors  
 * 3. Weighted average across checklist types (Supervisor×2, Fiscal×1, Alimentos×1)
 */
function calculatePositionFromSectorScores(
  position: LeadershipPositionCode,
  sectorScores: SectorScoreRow[]
): { finalScore: number | null; tier: string | null; breakdown: PositionBreakdown[]; totalAudits: number } {
  const rule = POSITION_ROUTING_RULES[position];
  if (!rule) return { finalScore: null, tier: null, breakdown: [], totalAudits: 0 };

  const breakdown: PositionBreakdown[] = [];
  let weightedSum = 0;
  let totalWeight = 0;
  let totalAudits = 0;

  for (const [checklistType, validSectors] of Object.entries(rule.rules)) {
    if (validSectors === null || validSectors === undefined) continue;

    // Filter sector scores matching this checklist type AND valid sectors
    const matchingScores = sectorScores.filter(
      s => s.checklist_type === checklistType && validSectors.includes(s.sector_code as AuditSectorCode)
    );

    if (matchingScores.length === 0) continue;

    // Step 1: Group by sector and calculate average per sector
    const sectorGroups = new Map<string, number[]>();
    for (const s of matchingScores) {
      const existing = sectorGroups.get(s.sector_code) || [];
      existing.push(s.score);
      sectorGroups.set(s.sector_code, existing);
    }

    const sectorAverages: { sector: string; average: number; count: number }[] = [];
    for (const [sector, scores] of sectorGroups) {
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      sectorAverages.push({ sector, average: avg, count: scores.length });
    }

    // Step 2: Average across sectors (each sector counts equally)
    const typeAverage = sectorAverages.reduce((sum, s) => sum + s.average, 0) / sectorAverages.length;

    const weight = AUDIT_TYPE_WEIGHTS[checklistType as AuditChecklistType];
    weightedSum += typeAverage * weight;
    totalWeight += weight;
    totalAudits += matchingScores.length;

    breakdown.push({
      checklistType: checklistType as AuditChecklistType,
      label: AUDIT_TYPE_LABELS[checklistType as AuditChecklistType],
      averageScore: typeAverage,
      weight,
      sectorAverages,
      auditCount: matchingScores.length,
    });
  }

  if (totalWeight === 0) {
    return { finalScore: null, tier: null, breakdown, totalAudits };
  }

  const finalScore = weightedSum / totalWeight;
  return {
    finalScore,
    tier: getTier(finalScore),
    breakdown,
    totalAudits,
  };
}

// ============================================
// BACKFILL: Generate sector scores from existing data
// ============================================

async function backfillSectorScores(
  supabase: ReturnType<typeof createClient>,
  lojaId?: string,
  monthYear?: string
) {
  console.log('[backfill] Starting sector scores backfill...');

  // Fetch audits
  let auditsQuery = supabase.from('supervision_audits').select('id, loja_id, audit_date, global_score');
  if (lojaId) auditsQuery = auditsQuery.eq('loja_id', lojaId);
  if (monthYear) {
    const [year, month] = monthYear.split('-');
    const startDate = `${year}-${month}-01`;
    const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
    auditsQuery = auditsQuery.gte('audit_date', startDate).lte('audit_date', `${year}-${month}-${lastDay}`);
  }

  const { data: audits, error: auditsError } = await auditsQuery;
  if (auditsError) throw auditsError;
  if (!audits || audits.length === 0) {
    console.log('[backfill] No audits found');
    return 0;
  }

  // Fetch failures for these audits
  const auditIds = audits.map(a => a.id);
  
  // Batch fetch failures (handle >1000 audits)
  let allFailures: Array<{ audit_id: string; loja_id: string; item_name: string; category: string | null }> = [];
  for (let i = 0; i < auditIds.length; i += 500) {
    const batch = auditIds.slice(i, i + 500);
    const { data: failures, error: failuresError } = await supabase
      .from('supervision_failures')
      .select('audit_id, loja_id, item_name, category')
      .in('audit_id', batch);
    if (failuresError) throw failuresError;
    allFailures = allFailures.concat(failures || []);
  }

  // Generate sector scores for each audit
  const sectorScoreRows: Array<{
    audit_id: string;
    loja_id: string;
    sector_code: string;
    checklist_type: string;
    score: number;
    total_points: number;
    earned_points: number;
    item_count: number;
    audit_date: string;
    month_year: string;
  }> = [];

  for (const audit of audits) {
    const auditDate = new Date(audit.audit_date);
    const my = `${auditDate.getFullYear()}-${String(auditDate.getMonth() + 1).padStart(2, '0')}`;
    const auditFailures = allFailures.filter(f => f.audit_id === audit.id);
    const checklistType = detectChecklistType(auditFailures[0]?.category);

    // Categorize failures into sectors
    const sectorFailureCounts = new Map<string, number>();
    for (const f of auditFailures) {
      const sector = categorizeSector(f.item_name, f.category);
      sectorFailureCounts.set(sector, (sectorFailureCounts.get(sector) || 0) + 1);
    }

    if (sectorFailureCounts.size === 0) {
      // No failures at all → whole audit scored at global_score, assign to 'outros'
      sectorScoreRows.push({
        audit_id: audit.id,
        loja_id: audit.loja_id,
        sector_code: 'outros',
        checklist_type: checklistType,
        score: audit.global_score,
        total_points: 100,
        earned_points: audit.global_score,
        item_count: 1,
        audit_date: audit.audit_date,
        month_year: my,
      });
    } else {
      // Distribute the global score proportionally across sectors
      // Sectors with MORE failures get LOWER scores
      const totalFailures = auditFailures.length;
      
      // Each sector gets a score based on its share of failures
      // If global = 85% and sector has 60% of failures, that sector is worse
      for (const [sector, failCount] of sectorFailureCounts) {
        // Weighted failure proportion for this sector
        const failureProportion = failCount / totalFailures;
        // Total loss = 100 - global_score
        const totalLoss = 100 - audit.global_score;
        // This sector's estimated loss (proportional to its failure share)
        // But we also adjust so average comes back to global_score
        const sectorLoss = totalLoss * failureProportion * sectorFailureCounts.size;
        const sectorScore = Math.max(0, Math.min(100, 100 - sectorLoss));

        sectorScoreRows.push({
          audit_id: audit.id,
          loja_id: audit.loja_id,
          sector_code: sector,
          checklist_type: checklistType,
          score: Math.round(sectorScore * 100) / 100,
          total_points: 100,
          earned_points: Math.round(sectorScore * 100) / 100,
          item_count: failCount,
          audit_date: audit.audit_date,
          month_year: my,
        });
      }
    }
  }

  // Upsert sector scores in batches
  let inserted = 0;
  for (let i = 0; i < sectorScoreRows.length; i += 200) {
    const batch = sectorScoreRows.slice(i, i + 200);
    const { error: upsertError } = await supabase
      .from('audit_sector_scores')
      .upsert(batch, { onConflict: 'audit_id,sector_code,checklist_type' });
    if (upsertError) {
      console.error('[backfill] Upsert error:', upsertError);
    } else {
      inserted += batch.length;
    }
  }

  console.log(`[backfill] Inserted/updated ${inserted} sector scores from ${audits.length} audits`);
  return inserted;
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
      action = 'calculate',
      loja_id,
      month_year,
      trigger_type = 'manual',
      trigger_audit_id,
    } = body;

    console.log(`[calculate-leadership-performance] Action: ${action}, Store: ${loja_id || 'all'}, Month: ${month_year || 'all'}`);

    // Create calculation log entry
    const { data: logEntry } = await supabase
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

    // Step 1: Backfill sector scores from existing audit data
    if (action === 'backfill' || action === 'calculate') {
      await backfillSectorScores(supabase, loja_id, month_year);
    }

    // Step 2: Read sector scores
    let scoresQuery = supabase.from('audit_sector_scores').select('*');
    if (loja_id) scoresQuery = scoresQuery.eq('loja_id', loja_id);
    if (month_year) scoresQuery = scoresQuery.eq('month_year', month_year);

    const { data: sectorScores, error: scoresError } = await scoresQuery;
    if (scoresError) throw scoresError;

    // Step 3: Group by store and month
    const storeMonthGroups = new Map<string, SectorScoreRow[]>();
    for (const score of (sectorScores || [])) {
      const key = `${score.loja_id}|${score.month_year}`;
      const existing = storeMonthGroups.get(key) || [];
      existing.push(score as SectorScoreRow);
      storeMonthGroups.set(key, existing);
    }

    // Step 4: Calculate and persist position scores
    const positions: LeadershipPositionCode[] = [
      'chefe_salao', 'chefe_apv', 'chefe_parrilla',
      'chefe_bar', 'chefe_cozinha', 'gerente_front', 'gerente_back'
    ];

    let positionsUpdated = 0;
    let storesUpdated = 0;

    for (const [key, scores] of storeMonthGroups) {
      const [storeId, monthYearKey] = key.split('|');
      storesUpdated++;

      // Calculate position scores using "Média de Médias por Setor"
      for (const position of positions) {
        const result = calculatePositionFromSectorScores(position, scores);

        const { error: upsertError } = await supabase
          .from('leadership_performance_scores')
          .upsert({
            loja_id: storeId,
            month_year: monthYearKey,
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

      // Calculate store-level scores
      // General score = simple average of ALL sector scores (all types)
      const allScoreValues = scores.map(s => s.score);
      const generalScore = allScoreValues.length > 0
        ? allScoreValues.reduce((a, b) => a + b, 0) / allScoreValues.length
        : null;

      // Front/Back scores from their respective managers
      const frontResult = calculatePositionFromSectorScores('gerente_front', scores);
      const backResult = calculatePositionFromSectorScores('gerente_back', scores);

      // Count failures per area
      const frontSectors = new Set(POSITION_ROUTING_RULES.gerente_front.rules.SUPERVISOR || []);
      const backSectors = new Set(POSITION_ROUTING_RULES.gerente_back.rules.SUPERVISOR || []);

      // Get failure counts from supervision_failures for this store/month
      const auditIds = [...new Set(scores.map(s => s.audit_id))];
      let frontFailures = 0;
      let backFailures = 0;
      let totalFailures = 0;

      if (auditIds.length > 0) {
        const { data: failures } = await supabase
          .from('supervision_failures')
          .select('item_name, category')
          .in('audit_id', auditIds.slice(0, 500));

        if (failures) {
          totalFailures = failures.length;
          for (const f of failures) {
            const sector = categorizeSector(f.item_name, f.category);
            if (frontSectors.has(sector)) frontFailures++;
            else if (backSectors.has(sector)) backFailures++;
          }
        }
      }

      const { error: storeUpsertError } = await supabase
        .from('leadership_store_scores')
        .upsert({
          loja_id: storeId,
          month_year: monthYearKey,
          general_score: generalScore,
          front_score: frontResult.finalScore,
          back_score: backResult.finalScore,
          general_tier: generalScore !== null ? getTier(generalScore) : null,
          front_tier: frontResult.tier,
          back_tier: backResult.tier,
          total_audits: auditIds.length,
          total_failures: totalFailures,
          front_failures: frontFailures,
          back_failures: backFailures,
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

    const response = {
      success: true,
      action,
      storesProcessed: storesUpdated,
      positionsUpdated,
      algorithm: 'media_de_medias_por_setor_v2',
    };

    console.log('[calculate-leadership-performance] Result:', response);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error('[calculate-leadership-performance] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
