// ============================================
// AUDIT TYPES & WEIGHTS
// Single source of truth for audit performance calculation
// ============================================

/**
 * Types of checklists recognized by the system
 */
export type AuditChecklistType = 
  | 'SUPERVISOR'
  | 'FISCAL'
  | 'AUDITORIA_DE_ALIMENTOS';

/**
 * Leadership positions for performance calculation
 */
export type LeadershipPositionCode = 
  | 'chefe_salao'
  | 'chefe_apv'
  | 'chefe_parrilla'
  | 'chefe_bar'
  | 'chefe_cozinha'
  | 'gerente_back'
  | 'gerente_front';

/**
 * Audit sectors that can be identified from checklists
 */
export type AuditSectorCode = 
  // FRONT sectors
  | 'salao'
  | 'area_comum'
  | 'documentos'
  | 'lavagem'
  | 'delivery'
  | 'asg'
  | 'manutencao'
  | 'brinquedoteca'
  | 'recepcao'
  // BACK sectors
  | 'estoque'
  | 'cozinha'
  | 'cozinha_quente'
  | 'saladas_sobremesas'
  | 'parrilla'
  | 'sushi'
  | 'bar'
  | 'dml'
  // Fallback
  | 'outros';

/**
 * Official weights per checklist type
 * SUPERVISOR: weight 2
 * FISCAL: weight 1
 * AUDITORIA_DE_ALIMENTOS: weight 1
 */
export const AUDIT_TYPE_WEIGHTS: Record<AuditChecklistType, number> = {
  SUPERVISOR: 2,
  FISCAL: 1,
  AUDITORIA_DE_ALIMENTOS: 1,
};

/**
 * Display labels for audit types
 */
export const AUDIT_TYPE_LABELS: Record<AuditChecklistType, string> = {
  SUPERVISOR: 'Supervisão',
  FISCAL: 'Fiscal',
  AUDITORIA_DE_ALIMENTOS: 'Auditoria de Alimentos',
};

/**
 * Display labels for positions
 */
export const POSITION_LABELS: Record<LeadershipPositionCode, string> = {
  chefe_salao: 'Chefe de Salão',
  chefe_apv: 'Chefe de APV',
  chefe_parrilla: 'Chefe de Parrilla',
  chefe_bar: 'Chefe de Bar',
  chefe_cozinha: 'Chef de Cozinha',
  gerente_back: 'Gerente de Back',
  gerente_front: 'Gerente de Front',
};

/**
 * Position colors for UI badges
 */
export const POSITION_COLORS: Record<LeadershipPositionCode, string> = {
  chefe_salao: 'hsl(150, 60%, 45%)',    // Green
  chefe_apv: 'hsl(45, 80%, 50%)',       // Yellow/Gold
  chefe_parrilla: 'hsl(0, 70%, 50%)',   // Red
  chefe_bar: 'hsl(280, 70%, 50%)',      // Purple
  chefe_cozinha: 'hsl(20, 80%, 50%)',   // Orange
  gerente_back: 'hsl(340, 70%, 50%)',   // Magenta
  gerente_front: 'hsl(220, 70%, 50%)',  // Navy Blue
};

/**
 * Sector display names
 */
export const SECTOR_LABELS: Record<AuditSectorCode, string> = {
  salao: 'Salão',
  area_comum: 'Área Comum',
  documentos: 'Documentos',
  lavagem: 'Área de Lavagem',
  delivery: 'Delivery',
  asg: 'ASG',
  manutencao: 'Manutenção',
  brinquedoteca: 'Brinquedoteca',
  recepcao: 'Recepção',
  estoque: 'Estoque',
  cozinha: 'Cozinha',
  cozinha_quente: 'Cozinha Quente',
  saladas_sobremesas: 'Saladas/Sobremesas',
  parrilla: 'Parrilla',
  sushi: 'Sushi',
  bar: 'Bar',
  dml: 'DML',
  outros: 'Outros',
};

/**
 * Keywords for sector identification from item names/categories
 */
export const SECTOR_KEYWORDS: Record<AuditSectorCode, string[]> = {
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

/**
 * Tier classification based on score
 */
export type PerformanceTier = 'ouro' | 'prata' | 'bronze' | 'red_flag';

export interface TierThreshold {
  tier: PerformanceTier;
  minScore: number;
  label: string;
  color: string;
}

export const TIER_THRESHOLDS: TierThreshold[] = [
  { tier: 'ouro', minScore: 95, label: 'Ouro', color: 'hsl(45, 93%, 47%)' },
  { tier: 'prata', minScore: 90, label: 'Prata', color: 'hsl(0, 0%, 75%)' },
  { tier: 'bronze', minScore: 85, label: 'Bronze', color: 'hsl(30, 67%, 55%)' },
  { tier: 'red_flag', minScore: 0, label: 'Red Flag', color: 'hsl(0, 84%, 60%)' },
];

/**
 * Get tier classification for a score
 */
export function getTierForScore(score: number): TierThreshold {
  for (const threshold of TIER_THRESHOLDS) {
    if (score >= threshold.minScore) {
      return threshold;
    }
  }
  return TIER_THRESHOLDS[TIER_THRESHOLDS.length - 1];
}

/**
 * Audit score entry for calculation
 */
export interface AuditScoreEntry {
  id: string;
  auditId: string;
  lojaId: string;
  sector: AuditSectorCode;
  checklistType: AuditChecklistType;
  score: number;
  auditDate: string;
  monthYear: string; // YYYY-MM format
}

/**
 * Calculated position performance result
 */
export interface PositionPerformanceResult {
  position: LeadershipPositionCode;
  label: string;
  finalScore: number | null;
  tier: TierThreshold | null;
  breakdown: {
    checklistType: AuditChecklistType;
    label: string;
    averageScore: number;
    weight: number;
    auditCount: number;
  }[];
  totalAudits: number;
  needsReview: boolean;
  reviewReasons: string[];
}

/**
 * Complete leadership performance report
 */
export interface LeadershipPerformanceReport {
  lojaId: string;
  monthYear: string;
  positions: PositionPerformanceResult[];
  generalScore: number | null;
  calculatedAt: string;
}
