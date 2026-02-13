// ============================================
// PERFORMANCE CALCULATOR ENGINE
// Implements weighted average calculation with official rules
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
  isSectorValidForPosition,
  POSITION_ROUTING_RULES,
} from './positionRoutingRules';

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

  // First check category if provided (more accurate)
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

  // Then check item name
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

  if (searchText.includes('fiscal')) {
    return 'FISCAL';
  }
  if (searchText.includes('alimento') || searchText.includes('food')) {
    return 'AUDITORIA_DE_ALIMENTOS';
  }
  if (searchText.includes('supervisor') || searchText.includes('supervisão')) {
    return 'SUPERVISOR';
  }

  // Default to SUPERVISOR if no specific type detected
  // This matches the current behavior where most audits are supervision audits
  return 'SUPERVISOR';
}

/**
 * Group scores by checklist type and calculate internal averages
 * Rule: If there's more than one audit of the same type in the same period,
 * calculate the internal average before applying weights
 */
function groupAndAverageByType(
  scores: AuditScoreEntry[]
): Map<AuditChecklistType, { average: number; count: number; entries: AuditScoreEntry[] }> {
  const groups = new Map<AuditChecklistType, AuditScoreEntry[]>();

  for (const entry of scores) {
    const existing = groups.get(entry.checklistType) || [];
    existing.push(entry);
    groups.set(entry.checklistType, existing);
  }

  const result = new Map<AuditChecklistType, { average: number; count: number; entries: AuditScoreEntry[] }>();

  for (const [type, entries] of groups) {
    const sum = entries.reduce((acc, e) => acc + e.score, 0);
    const average = sum / entries.length;
    result.set(type, { average, count: entries.length, entries });
  }

  return result;
}

/**
 * Calculate weighted average for a position
 * Formula: nota_final = soma(score × peso) / soma(peso)
 */
function calculateWeightedAverage(
  typeAverages: Map<AuditChecklistType, { average: number; count: number; entries: AuditScoreEntry[] }>
): { score: number; totalWeight: number } | null {
  let weightedSum = 0;
  let totalWeight = 0;

  for (const [type, { average }] of typeAverages) {
    const weight = AUDIT_TYPE_WEIGHTS[type];
    weightedSum += average * weight;
    totalWeight += weight;
  }

  if (totalWeight === 0) {
    return null;
  }

  return {
    score: weightedSum / totalWeight,
    totalWeight,
  };
}

/**
 * Filter scores that are valid for a specific position
 * Since audits are whole-store supervision audits (single global_score),
 * we only filter by checklistType (not sector) to avoid excluding valid audits.
 */
function filterScoresForPosition(
  scores: AuditScoreEntry[],
  position: LeadershipPositionCode
): AuditScoreEntry[] {
  const validTypes = getValidChecklistTypesForPosition(position);
  return scores.filter(entry => validTypes.includes(entry.checklistType));
}

/**
 * Calculate performance for a single position
 */
export function calculatePositionPerformance(
  position: LeadershipPositionCode,
  allScores: AuditScoreEntry[]
): PositionPerformanceResult {
  const rule = POSITION_ROUTING_RULES[position];
  const validScores = filterScoresForPosition(allScores, position);
  const reviewReasons: string[] = [];

  // Check for low confidence sectors
  const lowConfidenceScores = allScores.filter(s => {
    const { confidence } = categorizeSector(s.sector, null);
    return confidence === 'low';
  });

  if (lowConfidenceScores.length > 0) {
    reviewReasons.push(`${lowConfidenceScores.length} item(s) com setor não identificado com segurança`);
  }

  // Group and average by type
  const typeAverages = groupAndAverageByType(validScores);

  // Build breakdown
  const validTypes = getValidChecklistTypesForPosition(position);
  const breakdown = validTypes.map(type => {
    const data = typeAverages.get(type);
    return {
      checklistType: type,
      label: AUDIT_TYPE_LABELS[type],
      averageScore: data?.average ?? 0,
      weight: AUDIT_TYPE_WEIGHTS[type],
      auditCount: data?.count ?? 0,
    };
  }).filter(b => b.auditCount > 0); // Only include types with audits

  // Calculate weighted average
  const weightedResult = calculateWeightedAverage(typeAverages);

  return {
    position,
    label: POSITION_LABELS[position],
    finalScore: weightedResult?.score ?? null,
    tier: weightedResult ? getTierForScore(weightedResult.score) : null,
    breakdown,
    totalAudits: validScores.length,
    needsReview: reviewReasons.length > 0,
    reviewReasons,
  };
}

/**
 * Calculate performance for all positions in a store for a given month
 */
export function calculateLeadershipPerformance(
  lojaId: string,
  monthYear: string,
  scores: AuditScoreEntry[]
): LeadershipPerformanceReport {
  // Filter scores for the specific store and month
  const filteredScores = scores.filter(
    s => s.lojaId === lojaId && s.monthYear === monthYear
  );

  // Calculate for all positions
  const positions: PositionPerformanceResult[] = [];

  // Calculate chiefs first
  const chiefPositions: LeadershipPositionCode[] = [
    'chefe_salao',
    'chefe_apv',
    'chefe_parrilla',
    'chefe_bar',
    'chefe_cozinha',
  ];

  for (const position of chiefPositions) {
    positions.push(calculatePositionPerformance(position, filteredScores));
  }

  // Calculate managers
  const managerPositions: LeadershipPositionCode[] = [
    'gerente_front',
    'gerente_back',
  ];

  for (const position of managerPositions) {
    positions.push(calculatePositionPerformance(position, filteredScores));
  }

  // Calculate general score (simple average of all audits)
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

/**
 * Convert supervision failures to audit score entries
 * This bridges the existing database structure to the new calculation system
 */
export function convertAuditsToScoreEntries(
  audits: Array<{
    id: string;
    loja_id: string;
    audit_date: string;
    global_score: number;
  }>,
  failures: Array<{
    audit_id: string;
    loja_id: string;
    item_name: string;
    category?: string | null;
  }>
): AuditScoreEntry[] {
  const entries: AuditScoreEntry[] = [];

  for (const audit of audits) {
    // Get failures for this audit to determine sectors
    const auditFailures = failures.filter(f => f.audit_id === audit.id);
    
    // Determine the dominant sector from failures
    const sectorCounts = new Map<AuditSectorCode, number>();
    
    for (const failure of auditFailures) {
      const { sector } = categorizeSector(failure.item_name, failure.category);
      sectorCounts.set(sector, (sectorCounts.get(sector) || 0) + 1);
    }

    // Find the dominant sector
    let dominantSector: AuditSectorCode = 'outros';
    let maxCount = 0;
    for (const [sector, count] of sectorCounts) {
      if (count > maxCount) {
        maxCount = count;
        dominantSector = sector;
      }
    }

    // Detect checklist type from first failure's category
    const firstFailure = auditFailures[0];
    const checklistType = detectChecklistType(firstFailure?.category) || 'SUPERVISOR';

    // Create month-year string
    const auditDate = new Date(audit.audit_date);
    const monthYear = `${auditDate.getFullYear()}-${String(auditDate.getMonth() + 1).padStart(2, '0')}`;

    entries.push({
      id: audit.id,
      auditId: audit.id,
      lojaId: audit.loja_id,
      sector: dominantSector,
      checklistType,
      score: audit.global_score,
      auditDate: audit.audit_date,
      monthYear,
    });
  }

  return entries;
}

/**
 * Convert audits to score entries using the ACTUAL global_score from each PDF.
 * Each audit = ONE score entry with the real score.
 * Checklist type is detected from failure categories when possible.
 * 
 * IMPORTANT: This uses global_score directly - NO synthetic/estimated scores.
 */
export function createSectorLevelEntries(
  audits: Array<{
    id: string;
    loja_id: string;
    audit_date: string;
    global_score: number;
  }>,
  failures: Array<{
    audit_id: string;
    loja_id: string;
    item_name: string;
    category?: string | null;
  }>
): AuditScoreEntry[] {
  const entries: AuditScoreEntry[] = [];

  for (const audit of audits) {
    const auditDate = new Date(audit.audit_date);
    const monthYear = `${auditDate.getFullYear()}-${String(auditDate.getMonth() + 1).padStart(2, '0')}`;

    // Detect checklist type from failures
    const auditFailures = failures.filter(f => f.audit_id === audit.id);
    const firstFailure = auditFailures[0];
    const checklistType = detectChecklistType(firstFailure?.category) || 'SUPERVISOR';

    // Use the REAL global_score from the PDF directly
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
