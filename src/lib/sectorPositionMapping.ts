// Sector-to-Position Mapping for Hierarchical Audit Responsibility
// This module defines the mapping between audit sectors (Áreas) and leadership positions

export type LeadershipPosition = 
  | 'chefe_bar'
  | 'chefe_cozinha'
  | 'chefe_parrilla'
  | 'chefe_sushi'
  | 'chefe_salao'
  | 'chefe_apv'
  | 'gerente_front'
  | 'gerente_back'
  | 'gerente_cpd';

export type AuditSector = 
  | 'bar'
  | 'cozinha'
  | 'cozinha_quente'
  | 'parrilla'
  | 'sushi'
  | 'estoque'
  | 'recebimento'
  | 'dml'
  | 'producao'
  | 'salao'
  | 'recepcao'
  | 'area_comum'
  | 'brinquedoteca'
  | 'banheiros'
  | 'fachada'
  | 'manutencao'
  | 'apv'
  | 'delivery'
  | 'expedicao'
  | 'caixa'
  | 'administrativo'
  | 'outros';

export type AreaType = 'back' | 'front';

// Mapping of sectors to their responsible positions
export const SECTOR_POSITION_MAP: Record<AuditSector, {
  primaryChief: LeadershipPosition | null;
  responsibleManager: LeadershipPosition;
  areaType: AreaType;
  displayName: string;
  keywords: string[];
}> = {
  // BACK Area Sectors
  bar: {
    primaryChief: 'chefe_bar',
    responsibleManager: 'gerente_back',
    areaType: 'back',
    displayName: 'Bar',
    keywords: ['bar', 'bebida', 'drink', 'coquetel', 'cerveja', 'vinho', 'gelo', 'bebidas'],
  },
  cozinha: {
    primaryChief: 'chefe_cozinha',
    responsibleManager: 'gerente_back',
    areaType: 'back',
    displayName: 'Cozinha',
    keywords: ['cozinha', 'preparo', 'alimento', 'temperatura', 'geladeira', 'freezer', 'manipulação', 'cocção'],
  },
  cozinha_quente: {
    primaryChief: 'chefe_cozinha',
    responsibleManager: 'gerente_back',
    areaType: 'back',
    displayName: 'Cozinha Quente',
    keywords: ['cozinha quente', 'fogão', 'forno', 'chapa', 'fritura'],
  },
  parrilla: {
    primaryChief: 'chefe_parrilla',
    responsibleManager: 'gerente_back',
    areaType: 'back',
    displayName: 'Parrilla',
    keywords: ['parrilla', 'churrasqueira', 'grelhado', 'carne', 'brasa', 'parrillero'],
  },
  sushi: {
    primaryChief: 'chefe_sushi',
    responsibleManager: 'gerente_back',
    areaType: 'back',
    displayName: 'Sushi',
    keywords: ['sushi', 'japonês', 'sashimi', 'temaki', 'oriental', 'peixe cru'],
  },
  estoque: {
    primaryChief: null,
    responsibleManager: 'gerente_back',
    areaType: 'back',
    displayName: 'Estoque',
    keywords: ['estoque', 'armazenamento', 'validade', 'etiqueta', 'organização', 'fifo', 'peps', 'depósito'],
  },
  recebimento: {
    primaryChief: null,
    responsibleManager: 'gerente_back',
    areaType: 'back',
    displayName: 'Recebimento',
    keywords: ['recebimento', 'fornecedor', 'nota fiscal', 'entrada', 'conferência'],
  },
  dml: {
    primaryChief: null,
    responsibleManager: 'gerente_back',
    areaType: 'back',
    displayName: 'DML',
    keywords: ['dml', 'depósito material limpeza', 'produtos químicos', 'material de limpeza'],
  },
  producao: {
    primaryChief: 'chefe_cozinha',
    responsibleManager: 'gerente_back',
    areaType: 'back',
    displayName: 'Produção',
    keywords: ['produção', 'pré-preparo', 'mise en place', 'porcionamento'],
  },

  // FRONT Area Sectors
  salao: {
    primaryChief: 'chefe_salao',
    responsibleManager: 'gerente_front',
    areaType: 'front',
    displayName: 'Salão',
    keywords: ['salão', 'mesa', 'cadeira', 'atendimento', 'cardápio', 'cliente', 'ambiente', 'decoração', 'garçom'],
  },
  recepcao: {
    primaryChief: 'chefe_salao',
    responsibleManager: 'gerente_front',
    areaType: 'front',
    displayName: 'Recepção',
    keywords: ['recepção', 'hostess', 'entrada', 'fila', 'reserva'],
  },
  area_comum: {
    primaryChief: 'chefe_salao',
    responsibleManager: 'gerente_front',
    areaType: 'front',
    displayName: 'Área Comum',
    keywords: ['área comum', 'corredor', 'escada', 'elevador', 'hall'],
  },
  brinquedoteca: {
    primaryChief: 'chefe_salao',
    responsibleManager: 'gerente_front',
    areaType: 'front',
    displayName: 'Brinquedoteca',
    keywords: ['brinquedoteca', 'espaço kids', 'criança', 'playground', 'recreação'],
  },
  banheiros: {
    primaryChief: null,
    responsibleManager: 'gerente_front',
    areaType: 'front',
    displayName: 'Banheiros',
    keywords: ['banheiro', 'sanitário', 'wc', 'toalete', 'lavabo'],
  },
  fachada: {
    primaryChief: null,
    responsibleManager: 'gerente_front',
    areaType: 'front',
    displayName: 'Fachada',
    keywords: ['fachada', 'letreiro', 'luminoso', 'entrada principal', 'calçada', 'estacionamento'],
  },
  manutencao: {
    primaryChief: null,
    responsibleManager: 'gerente_front',
    areaType: 'front',
    displayName: 'Manutenção',
    keywords: ['manutenção', 'ar condicionado', 'elétrica', 'hidráulica', 'reparo', 'equipamento'],
  },
  apv: {
    primaryChief: 'chefe_apv',
    responsibleManager: 'gerente_front',
    areaType: 'front',
    displayName: 'APV',
    keywords: ['apv', 'área de preparo'],
  },
  delivery: {
    primaryChief: 'chefe_apv',
    responsibleManager: 'gerente_front',
    areaType: 'front',
    displayName: 'Delivery',
    keywords: ['delivery', 'ifood', 'entrega', 'aplicativo', 'motoboy', 'rappi', 'uber eats'],
  },
  expedicao: {
    primaryChief: 'chefe_apv',
    responsibleManager: 'gerente_front',
    areaType: 'front',
    displayName: 'Expedição',
    keywords: ['expedição', 'saída', 'montagem', 'embalagem', 'pedido pronto'],
  },
  caixa: {
    primaryChief: null,
    responsibleManager: 'gerente_cpd',
    areaType: 'front',
    displayName: 'Caixa',
    keywords: ['caixa', 'pagamento', 'fechamento', 'sangria', 'troco', 'pdv'],
  },
  administrativo: {
    primaryChief: null,
    responsibleManager: 'gerente_cpd',
    areaType: 'front',
    displayName: 'Administrativo',
    keywords: ['administrativo', 'escritório', 'documento', 'alvará', 'licença'],
  },
  outros: {
    primaryChief: null,
    responsibleManager: 'gerente_back',
    areaType: 'back',
    displayName: 'Outros',
    keywords: ['higiene', 'limpeza', 'outros'],
  },
};

// Position display labels
export const POSITION_LABELS: Record<LeadershipPosition, string> = {
  chefe_bar: 'Chefe de Bar',
  chefe_cozinha: 'Chefe de Cozinha',
  chefe_parrilla: 'Chefe de Parrilla',
  chefe_sushi: 'Chefe de Sushi',
  chefe_salao: 'Chefe de Salão',
  chefe_apv: 'Chefe de APV',
  gerente_front: 'Gerente de Front',
  gerente_back: 'Gerente de Back',
  gerente_cpd: 'Gerente de CPD',
};

// Position color badges
export const POSITION_COLORS: Record<LeadershipPosition, string> = {
  chefe_bar: 'hsl(280, 70%, 50%)',      // Purple
  chefe_cozinha: 'hsl(20, 80%, 50%)',   // Orange
  chefe_parrilla: 'hsl(0, 70%, 50%)',   // Red
  chefe_sushi: 'hsl(200, 70%, 50%)',    // Blue
  chefe_salao: 'hsl(150, 60%, 45%)',    // Green
  chefe_apv: 'hsl(45, 80%, 50%)',       // Yellow/Gold
  gerente_front: 'hsl(220, 70%, 50%)',  // Navy Blue
  gerente_back: 'hsl(340, 70%, 50%)',   // Magenta
  gerente_cpd: 'hsl(180, 60%, 45%)',    // Teal
};

// Get sectors managed by a position
export function getSectorsByPosition(position: LeadershipPosition): AuditSector[] {
  return Object.entries(SECTOR_POSITION_MAP)
    .filter(([, config]) => 
      config.primaryChief === position || config.responsibleManager === position
    )
    .map(([sector]) => sector as AuditSector);
}

// Get positions responsible for a sector
export function getPositionsForSector(sector: AuditSector): {
  chief: LeadershipPosition | null;
  manager: LeadershipPosition;
} {
  const config = SECTOR_POSITION_MAP[sector];
  return {
    chief: config.primaryChief,
    manager: config.responsibleManager,
  };
}

// Categorize an item name into a sector
export function categorizeItemToSector(itemName: string, category?: string | null): AuditSector {
  const searchText = `${itemName} ${category || ''}`.toLowerCase();
  
  // First check category if provided (more accurate)
  if (category) {
    const categoryLower = category.toLowerCase();
    for (const [sector, config] of Object.entries(SECTOR_POSITION_MAP)) {
      if (config.keywords.some(kw => categoryLower.includes(kw))) {
        return sector as AuditSector;
      }
    }
  }
  
  // Then check item name
  for (const [sector, config] of Object.entries(SECTOR_POSITION_MAP)) {
    if (config.keywords.some(kw => searchText.includes(kw))) {
      return sector as AuditSector;
    }
  }
  
  return 'outros';
}

// Check if a position is a Chief (not a Manager)
export function isChiefPosition(position: LeadershipPosition): boolean {
  return position.startsWith('chefe_');
}

// Check if a position is a Manager
export function isManagerPosition(position: LeadershipPosition): boolean {
  return position.startsWith('gerente_');
}

// Get manager positions for an area type
export function getManagersForArea(areaType: AreaType): LeadershipPosition[] {
  if (areaType === 'back') {
    return ['gerente_back'];
  }
  return ['gerente_front', 'gerente_cpd'];
}

// Get all chiefs for an area type
export function getChiefsForArea(areaType: AreaType): LeadershipPosition[] {
  if (areaType === 'back') {
    return ['chefe_bar', 'chefe_cozinha', 'chefe_parrilla', 'chefe_sushi'];
  }
  return ['chefe_salao', 'chefe_apv'];
}
