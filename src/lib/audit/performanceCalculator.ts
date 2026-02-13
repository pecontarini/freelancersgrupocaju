// ============================================
// PERFORMANCE CALCULATOR ENGINE v2
// "Média de Médias por Setor" - Single source of truth
// ============================================

import {
  AuditChecklistType,
  AuditScoreEntry,
  AuditSectorCode,
  AUDIT_TYPE_LABELS,
  AUDIT_TYPE_WEIGHTS,
  getTierForScore,
  LeadershipPositionCode,
  LeadershipPerformanceReport,
  POSITION_LABELS,
  PositionPerformanceResult,
  SECTOR_KEYWORDS,
} from './auditTypes';

import {
  getValidChecklistTypesForPosition,
  POSITION_ROUTING_RULES,
} from './positionRoutingRules';

/**
 * Sector score entry from audit_sector_scores table
 */
export interface SectorScoreEntry {
  id: string;
  auditId: string;
  lojaId: string;
  sectorCode: AuditSectorCode;
  checklistType: AuditChecklistType;
  score: number;
  auditDate: string;
  monthYear: string;
}

/**
 * Categorize an item/category text into a sector based on keywords
 */
export function categorizeSector(
  itemName: string,
  category?: string | null
): { sector: AuditSectorCode; confidence: 'high' | 'medium' | 'low' } {
  const searchText = `${itemName} ${category || ''}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (category) {
    const categoryLower = category
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    for (const [sectorCode, keywords] of Object.entries(SECTOR_KEYWORDS)) {
      const normalizedKeywords = keywords.map(kw =>
        kw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      );
      if (normalizedKeywords.some(kw => categoryLower.includes(kw))) {
        return { sector: sectorCode as AuditSectorCode, confidence: 'high' };
      }
    }
  }

  for (const [sectorCode, keywords] of Object.entries(SECTOR_KEYWORDS)) {
    const normalizedKeywords = keywords.map(kw =>
      kw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    );
    if (normalizedKeywords.some(kw => searchText.includes(kw))) {
      return { sector: sectorCode as AuditSectorCode, confidence: 'medium' };
    }
  }

  return { sector: 'outros', confidence: 'low' };
}

/**
 * Detect checklist type from audit metadata or category
 */
export function detectChecklistType(
  category?: string | null,
  metadata?: Record<string, unknown>
): AuditChecklistType | null {
  const searchText = (category || '').toLowerCase();
  if (searchText.includes('fiscal') && searchText.includes('cpd')) return 'FISCAL_CPD';
  if (searchText.includes('fiscal')) return 'FISCAL';
  if (searchText.includes('alimento') || searchText.includes('food')) return 'AUDITORIA_DE_ALIMENTOS';
  if (searchText.includes('supervisor') || searchText.includes('supervisão')) return 'SUPERVISOR';
  return 'SUPERVISOR';
}

/**
 * CORE: Calculate position performance using Weighted Points Accumulation
 * 
 * Algorithm:
 * 1. For each audit score matching this position's valid sectors/checklist types:
 *    a. audit_points = (score / 100) * WEIGHT_OF_CHECKLIST_TYPE
 *    b. max_points = 1.0 * WEIGHT_OF_CHECKLIST_TYPE
 * 2. final_score = (sum_audit_points / sum_max_points) * 100
 * 
 * Example: Supervisor(w=2) at 80% + Fiscal(w=1) at 100%
 *   points = (0.80*2) + (1.00*1) = 2.6
 *   max    = 2 + 1 = 3.0
 *   final  = (2.6/3.0)*100 = 86.66%
 */
export function calculatePositionFromSectorScores(
  position: LeadershipPositionCode,
  sectorScores: SectorScoreEntry[]
): PositionPerformanceResult {
  const rule = POSITION_ROUTING_RULES[position];
  const reviewReasons: string[] = [];
  const breakdown: PositionPerformanceResult['breakdown'] = [];
  let totalAuditPoints = 0;
  let totalMaxPoints = 0;
  let totalAudits = 0;

  for (const [checklistType, validSectors] of Object.entries(rule.rules)) {
    if (validSectors === null || validSectors === undefined) continue;

    // Filter scores matching this checklist type AND valid sectors
    const matchingScores = sectorScores.filter(
      s => s.checklistType === (checklistType as AuditChecklistType) &&
           validSectors.includes(s.sectorCode)
    );

    if (matchingScores.length === 0) continue;

    const weight = AUDIT_TYPE_WEIGHTS[checklistType as AuditChecklistType];

    // Accumulate weighted points for each individual audit score
    let typeAuditPoints = 0;
    let typeMaxPoints = 0;
    for (const s of matchingScores) {
      typeAuditPoints += (s.score / 100) * weight;
      typeMaxPoints += 1.0 * weight;
    }

    const typeAverage = (typeAuditPoints / typeMaxPoints) * 100;
    totalAuditPoints += typeAuditPoints;
    totalMaxPoints += typeMaxPoints;
    totalAudits += matchingScores.length;

    breakdown.push({
      checklistType: checklistType as AuditChecklistType,
      label: AUDIT_TYPE_LABELS[checklistType as AuditChecklistType],
      averageScore: typeAverage,
      weight,
      auditCount: matchingScores.length,
    });
  }

  if (totalMaxPoints === 0) {
    return {
      position,
      label: POSITION_LABELS[position],
      finalScore: null,
      tier: null,
      breakdown,
      totalAudits,
      needsReview: false,
      reviewReasons,
    };
  }

  const finalScore = (totalAuditPoints / totalMaxPoints) * 100;
  return {
    position,
    label: POSITION_LABELS[position],
    finalScore,
    tier: getTierForScore(finalScore),
    breakdown,
    totalAudits,
    needsReview: reviewReasons.length > 0,
    reviewReasons,
  };
}

/**
 * Calculate performance for all positions using sector scores
 */
export function calculateLeadershipPerformanceFromSectors(
  lojaId: string,
  monthYear: string,
  sectorScores: SectorScoreEntry[]
): LeadershipPerformanceReport {
  const filteredScores = sectorScores.filter(
    s => s.lojaId === lojaId && s.monthYear === monthYear
  );

  const positions: PositionPerformanceResult[] = [];

  // Chiefs
  const chiefPositions: LeadershipPositionCode[] = [
    'chefe_salao', 'chefe_apv', 'chefe_parrilla', 'chefe_bar', 'chefe_cozinha',
  ];
  for (const p of chiefPositions) {
    positions.push(calculatePositionFromSectorScores(p, filteredScores));
  }

  // Managers
  for (const p of ['gerente_front', 'gerente_back'] as LeadershipPositionCode[]) {
    positions.push(calculatePositionFromSectorScores(p, filteredScores));
  }

  // General score = simple average of ALL sector scores
  let generalScore: number | null = null;
  if (filteredScores.length > 0) {
    const sum = filteredScores.reduce((acc, s) => acc + s.score, 0);
    generalScore = sum / filteredScores.length;
  }

  return {
    lojaId,
    monthYear,
    positions,
    generalScore,
    calculatedAt: new Date().toISOString(),
  };
}

// ============================================
// LEGACY COMPATIBILITY
// Keep old functions for backward compatibility during migration
// ============================================

/**
 * @deprecated Use calculatePositionFromSectorScores instead
 */
export function calculatePositionPerformance(
  position: LeadershipPositionCode,
  allScores: AuditScoreEntry[]
): PositionPerformanceResult {
  // Convert old format to sector scores and use new engine
  const sectorScores: SectorScoreEntry[] = allScores.map(s => ({
    id: s.id,
    auditId: s.auditId,
    lojaId: s.lojaId,
    sectorCode: s.sector,
    checklistType: s.checklistType,
    score: s.score,
    auditDate: s.auditDate,
    monthYear: s.monthYear,
  }));
  return calculatePositionFromSectorScores(position, sectorScores);
}

/**
 * @deprecated Use calculateLeadershipPerformanceFromSectors instead
 */
export function calculateLeadershipPerformance(
  lojaId: string,
  monthYear: string,
  scores: AuditScoreEntry[]
): LeadershipPerformanceReport {
  const sectorScores: SectorScoreEntry[] = scores.map(s => ({
    id: s.id,
    auditId: s.auditId,
    lojaId: s.lojaId,
    sectorCode: s.sector,
    checklistType: s.checklistType,
    score: s.score,
    auditDate: s.auditDate,
    monthYear: s.monthYear,
  }));
  return calculateLeadershipPerformanceFromSectors(lojaId, monthYear, sectorScores);
}

/**
 * Convert supervision failures to audit score entries
 * @deprecated Use audit_sector_scores table directly
 */
export function convertAuditsToScoreEntries(
  audits: Array<{ id: string; loja_id: string; audit_date: string; global_score: number }>,
  failures: Array<{ audit_id: string; loja_id: string; item_name: string; category?: string | null }>
): AuditScoreEntry[] {
  return createSectorLevelEntries(audits, failures);
}

/**
 * Create score entries from audits
 * @deprecated Use audit_sector_scores table directly
 */
export function createSectorLevelEntries(
  audits: Array<{ id: string; loja_id: string; audit_date: string; global_score: number }>,
  failures: Array<{ audit_id: string; loja_id: string; item_name: string; category?: string | null }>
): AuditScoreEntry[] {
  const entries: AuditScoreEntry[] = [];

  for (const audit of audits) {
    const auditDate = new Date(audit.audit_date);
    const monthYear = `${auditDate.getFullYear()}-${String(auditDate.getMonth() + 1).padStart(2, '0')}`;
    const auditFailures = failures.filter(f => f.audit_id === audit.id);
    const checklistType = detectChecklistType(auditFailures[0]?.category) || 'SUPERVISOR';

    entries.push({
      id: audit.id,
      auditId: audit.id,
      lojaId: audit.loja_id,
      sector: 'outros',
      checklistType,
      score: audit.global_score,
      auditDate: audit.audit_date,
      monthYear,
    });
  }

  return entries;
}
