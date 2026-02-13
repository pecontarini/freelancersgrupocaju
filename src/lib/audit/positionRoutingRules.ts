// ============================================
// POSITION ROUTING RULES
// Official rules for routing audits to positions
// ============================================

import {
  AuditChecklistType,
  AuditSectorCode,
  LeadershipPositionCode,
} from './auditTypes';

/**
 * Routing rule for a position
 * Defines which sectors and checklist types are valid for each position
 */
export interface PositionRoutingRule {
  position: LeadershipPositionCode;
  /**
   * Rules per checklist type
   * Key: checklist type
   * Value: array of valid sectors, or null if this type doesn't apply
   */
  rules: Partial<Record<AuditChecklistType | 'FISCAL_CPD', AuditSectorCode[] | null>>;
  /**
   * Whether this position consolidates from child positions
   */
  isManager: boolean;
  /**
   * Area type for the position
   */
  areaType: 'front' | 'back';
}

/**
 * Official routing rules per position
 * Based on the business rules document
 */
export const POSITION_ROUTING_RULES: Record<LeadershipPositionCode, PositionRoutingRule> = {
  // ============================================
  // CHIEFS (Chefes)
  // ============================================

  /**
   * 🟩 CHEFE DE SALÃO
   * Setor: SALÃO
   * Abrangência: Supervisor, Fiscal, Auditoria de Alimentos
   */
  chefe_salao: {
    position: 'chefe_salao',
    rules: {
      SUPERVISOR: ['salao'],
      FISCAL: ['salao'],
      AUDITORIA_DE_ALIMENTOS: ['salao'],
    },
    isManager: false,
    areaType: 'front',
  },

  /**
   * 🟩 CHEFE DE APV
   * Bloco 1 – Supervisor: DELIVERY, ASG, MANUTENÇÃO, BRINQUEDOTECA, RECEPÇÃO
   * Bloco 2 – Auditoria de Alimentos: ÁREA DE LAVAGEM, DOCUMENTOS
   * Regras: FISCAL não entra para Chefe de APV
   */
  chefe_apv: {
    position: 'chefe_apv',
    rules: {
      SUPERVISOR: ['delivery', 'asg', 'manutencao', 'brinquedoteca', 'recepcao'],
      FISCAL: null, // FISCAL não entra para Chefe de APV
      AUDITORIA_DE_ALIMENTOS: ['lavagem', 'documentos'],
    },
    isManager: false,
    areaType: 'front',
  },

  /**
   * 🟩 CHEFE DE PARRILLA
   * Setor: PARRILLA
   * Abrangência: Supervisor, Fiscal, Auditoria de Alimentos
   */
  chefe_parrilla: {
    position: 'chefe_parrilla',
    rules: {
      SUPERVISOR: ['parrilla'],
      FISCAL: ['parrilla'],
      AUDITORIA_DE_ALIMENTOS: ['parrilla'],
    },
    isManager: false,
    areaType: 'back',
  },

  /**
   * 🟩 CHEFE DE BAR
   * Setor: BAR
   * Abrangência: Supervisor, Fiscal, Auditoria de Alimentos
   */
  chefe_bar: {
    position: 'chefe_bar',
    rules: {
      SUPERVISOR: ['bar'],
      FISCAL: ['bar'],
      AUDITORIA_DE_ALIMENTOS: ['bar'],
    },
    isManager: false,
    areaType: 'back',
  },

  /**
   * 🟩 CHEFE DE COZINHA
   * Bloco 1 – Fiscal: COZINHA QUENTE, SALADAS/SOBREMESAS
   * Bloco 2 – Supervisor + Auditoria de Alimentos: COZINHA (GERAL)
   */
  chefe_cozinha: {
    position: 'chefe_cozinha',
    rules: {
      SUPERVISOR: ['cozinha'],
      FISCAL: ['cozinha_quente', 'saladas_sobremesas'],
      AUDITORIA_DE_ALIMENTOS: ['cozinha'],
    },
    isManager: false,
    areaType: 'back',
  },

  // ============================================
  // MANAGERS (Gerentes)
  // ============================================

  /**
   * 🟦 GERENTE DE BACK
   * Componentes: Supervisor de Back (peso 2), Fiscal de Back (peso 1), Auditoria de Alimentos (peso 1)
   * Abrangência: ESTOQUE, COZINHA, SUSHI ou PARRILLA, BAR
   */
  gerente_back: {
    position: 'gerente_back',
    rules: {
      SUPERVISOR: ['estoque', 'cozinha', 'sushi', 'parrilla', 'bar', 'dml'],
      FISCAL: ['estoque', 'cozinha', 'cozinha_quente', 'saladas_sobremesas', 'sushi', 'parrilla', 'bar', 'dml'],
      FISCAL_CPD: ['estoque', 'cozinha', 'cozinha_quente', 'saladas_sobremesas', 'sushi', 'parrilla', 'bar', 'dml'],
      AUDITORIA_DE_ALIMENTOS: ['estoque', 'cozinha', 'sushi', 'parrilla', 'bar', 'dml'],
    },
    isManager: true,
    areaType: 'back',
  },

  /**
   * 🟦 GERENTE DE FRONT
   * Componentes: Supervisor de Front (peso 2), Auditoria de Alimentos (peso 1)
   * Abrangência: SALÃO, ÁREA COMUM, DOCUMENTOS, ÁREA DE LAVAGEM
   * Note: FISCAL is included for front areas too
   */
  gerente_front: {
    position: 'gerente_front',
    rules: {
      SUPERVISOR: ['salao', 'area_comum', 'documentos', 'lavagem', 'delivery', 'asg', 'manutencao', 'brinquedoteca', 'recepcao'],
      FISCAL: ['salao', 'area_comum'],
      FISCAL_CPD: ['salao', 'area_comum'],
      AUDITORIA_DE_ALIMENTOS: ['salao', 'area_comum', 'documentos', 'lavagem'],
    },
    isManager: true,
    areaType: 'front',
  },
};

/**
 * Check if a sector belongs to a position for a given checklist type
 */
export function isSectorValidForPosition(
  position: LeadershipPositionCode,
  sector: AuditSectorCode,
  checklistType: AuditChecklistType
): boolean {
  const rule = POSITION_ROUTING_RULES[position];
  if (!rule) return false;

  const validSectors = rule.rules[checklistType];
  if (validSectors === null || validSectors === undefined) return false;

  return validSectors.includes(sector);
}

/**
 * Get all positions that should receive a given audit
 */
export function getPositionsForAudit(
  sector: AuditSectorCode,
  checklistType: AuditChecklistType
): LeadershipPositionCode[] {
  const positions: LeadershipPositionCode[] = [];

  for (const [positionCode, rule] of Object.entries(POSITION_ROUTING_RULES)) {
    const validSectors = rule.rules[checklistType];
    if (validSectors && validSectors.includes(sector)) {
      positions.push(positionCode as LeadershipPositionCode);
    }
  }

  return positions;
}

/**
 * Get all valid checklist types for a position
 */
export function getValidChecklistTypesForPosition(
  position: LeadershipPositionCode
): AuditChecklistType[] {
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

/**
 * Get all valid sectors for a position and checklist type
 */
export function getValidSectorsForPosition(
  position: LeadershipPositionCode,
  checklistType?: AuditChecklistType
): AuditSectorCode[] {
  const rule = POSITION_ROUTING_RULES[position];
  if (!rule) return [];

  if (checklistType) {
    const sectors = rule.rules[checklistType];
    return sectors || [];
  }

  // Return all unique sectors across all checklist types
  const allSectors = new Set<AuditSectorCode>();
  for (const sectors of Object.values(rule.rules)) {
    if (sectors) {
      sectors.forEach(s => allSectors.add(s));
    }
  }
  return Array.from(allSectors);
}

/**
 * Get chiefs for a specific area type
 */
export function getChiefsForArea(areaType: 'front' | 'back'): LeadershipPositionCode[] {
  return Object.entries(POSITION_ROUTING_RULES)
    .filter(([_, rule]) => !rule.isManager && rule.areaType === areaType)
    .map(([code]) => code as LeadershipPositionCode);
}

/**
 * Get manager for a specific area type
 */
export function getManagerForArea(areaType: 'front' | 'back'): LeadershipPositionCode {
  return areaType === 'front' ? 'gerente_front' : 'gerente_back';
}
