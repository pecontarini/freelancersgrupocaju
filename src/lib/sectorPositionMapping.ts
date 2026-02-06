// Sector-to-Position Mapping for Hierarchical Audit Responsibility
// This module defines the mapping between audit sectors (Áreas) and leadership positions
// Updated structure: FRONT (Gerente Front) / BACK (Gerente Back) with specific chief assignments

export type LeadershipPosition = 
  | 'chefe_bar'
  | 'chefe_cozinha'
  | 'chefe_parrilla'
  | 'chefe_sushi'
  | 'chefe_salao'
  | 'chefe_apv'
  | 'gerente_front'
  | 'gerente_back';

export type AuditSector = 
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

export type AreaType = 'back' | 'front';

// Mapping of sectors to their responsible positions
// primaryChief: Direct responsible chief (if any)
// responsibleManager: Manager (Gerente) who oversees the area
export const SECTOR_POSITION_MAP: Record<AuditSector, {
  primaryChief: LeadershipPosition | null;
  responsibleManager: LeadershipPosition;
  areaType: AreaType;
  displayName: string;
  keywords: string[];
}> = {
  // ============================================
  // FRONT Area Sectors (Gerente de Front)
  // ============================================
  
  // Chefe de Salão responsible
  salao: {
    primaryChief: 'chefe_salao',
    responsibleManager: 'gerente_front',
    areaType: 'front',
    displayName: 'Salão',
    keywords: ['salão', 'salao', 'mesa', 'cadeira', 'atendimento', 'cardápio', 'cliente', 'ambiente', 'decoração', 'garçom', 'garcom'],
  },
  
  // Chefe de APV responsible sectors
  delivery: {
    primaryChief: 'chefe_apv',
    responsibleManager: 'gerente_front',
    areaType: 'front',
    displayName: 'Delivery',
    keywords: ['delivery', 'ifood', 'entrega', 'aplicativo', 'motoboy', 'rappi', 'uber eats', 'expedição', 'expedicao'],
  },
  asg: {
    primaryChief: 'chefe_apv',
    responsibleManager: 'gerente_front',
    areaType: 'front',
    displayName: 'ASG',
    keywords: ['asg', 'auxiliar serviços gerais', 'serviços gerais', 'limpeza geral', 'higienização'],
  },
  manutencao: {
    primaryChief: 'chefe_apv',
    responsibleManager: 'gerente_front',
    areaType: 'front',
    displayName: 'Manutenção',
    keywords: ['manutenção', 'manutencao', 'ar condicionado', 'elétrica', 'eletrica', 'hidráulica', 'hidraulica', 'reparo', 'equipamento'],
  },
  brinquedoteca: {
    primaryChief: 'chefe_apv',
    responsibleManager: 'gerente_front',
    areaType: 'front',
    displayName: 'Brinquedoteca',
    keywords: ['brinquedoteca', 'espaço kids', 'espaco kids', 'criança', 'crianca', 'playground', 'recreação', 'recreacao'],
  },
  recepcao: {
    primaryChief: 'chefe_apv',
    responsibleManager: 'gerente_front',
    areaType: 'front',
    displayName: 'Recepção',
    keywords: ['recepção', 'recepcao', 'hostess', 'entrada', 'fila', 'reserva', 'espera'],
  },
  lavagem: {
    primaryChief: 'chefe_apv',
    responsibleManager: 'gerente_front',
    areaType: 'front',
    displayName: 'Área de Lavagem',
    keywords: ['lavagem', 'lavar', 'louça', 'louca', 'copa', 'higienização louça', 'área de lavagem'],
  },
  documentos: {
    primaryChief: 'chefe_apv',
    responsibleManager: 'gerente_front',
    areaType: 'front',
    displayName: 'Documentos',
    keywords: ['documentos', 'documento', 'alvará', 'alvara', 'licença', 'licenca', 'certificado', 'registro', 'fiscalização'],
  },
  
  // No specific chief - directly under Gerente Front
  area_comum: {
    primaryChief: null,
    responsibleManager: 'gerente_front',
    areaType: 'front',
    displayName: 'Área Comum',
    keywords: ['área comum', 'area comum', 'corredor', 'escada', 'elevador', 'hall', 'banheiro', 'sanitário', 'sanitario', 'wc', 'toalete', 'lavabo', 'fachada', 'letreiro', 'luminoso', 'calçada', 'estacionamento'],
  },

  // ============================================
  // BACK Area Sectors (Gerente de Back)
  // ============================================
  
  // Chefe de Bar responsible
  bar: {
    primaryChief: 'chefe_bar',
    responsibleManager: 'gerente_back',
    areaType: 'back',
    displayName: 'Bar',
    keywords: ['bar', 'bebida', 'drink', 'coquetel', 'cerveja', 'vinho', 'gelo', 'bebidas', 'bartender'],
  },
  
  // Chef de Cozinha responsible
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
    keywords: ['cozinha quente', 'fogão', 'fogao', 'forno', 'chapa', 'fritura', 'fritadeira', 'panela'],
  },
  saladas_sobremesas: {
    primaryChief: 'chefe_cozinha',
    responsibleManager: 'gerente_back',
    areaType: 'back',
    displayName: 'Saladas/Sobremesas',
    keywords: ['salada', 'sobremesa', 'fria', 'cold', 'dessert', 'confeitaria', 'doce', 'fruta', 'verdura', 'legume'],
  },
  
  // Chefe de Parrilla responsible
  parrilla: {
    primaryChief: 'chefe_parrilla',
    responsibleManager: 'gerente_back',
    areaType: 'back',
    displayName: 'Parrilla',
    keywords: ['parrilla', 'churrasqueira', 'grelhado', 'carne', 'brasa', 'parrillero', 'grelha', 'churrasco'],
  },
  
  // Chefe de Sushi responsible
  sushi: {
    primaryChief: 'chefe_sushi',
    responsibleManager: 'gerente_back',
    areaType: 'back',
    displayName: 'Sushi',
    keywords: ['sushi', 'japonês', 'japones', 'sashimi', 'temaki', 'oriental', 'peixe cru', 'niguiri'],
  },
  
  // No specific chief - directly under Gerente Back
  estoque: {
    primaryChief: null,
    responsibleManager: 'gerente_back',
    areaType: 'back',
    displayName: 'Estoque',
    keywords: ['estoque', 'armazenamento', 'validade', 'etiqueta', 'organização', 'fifo', 'peps', 'depósito', 'deposito', 'recebimento', 'fornecedor', 'nota fiscal'],
  },
  dml: {
    primaryChief: null,
    responsibleManager: 'gerente_back',
    areaType: 'back',
    displayName: 'DML',
    keywords: ['dml', 'depósito material limpeza', 'produtos químicos', 'quimicos', 'material de limpeza', 'detergente', 'desinfetante'],
  },
  
  // ============================================
  // Fallback
  // ============================================
  outros: {
    primaryChief: null,
    responsibleManager: 'gerente_back',
    areaType: 'back',
    displayName: 'Outros',
    keywords: ['higiene', 'outros', 'geral'],
  },
};

// Position display labels
export const POSITION_LABELS: Record<LeadershipPosition, string> = {
  chefe_bar: 'Chefe de Bar',
  chefe_cozinha: 'Chef de Cozinha',
  chefe_parrilla: 'Chefe de Parrilla',
  chefe_sushi: 'Chefe de Sushi',
  chefe_salao: 'Chefe de Salão',
  chefe_apv: 'Chefe de APV',
  gerente_front: 'Gerente de Front',
  gerente_back: 'Gerente de Back',
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

// Categorize an item name into a sector based on keywords
export function categorizeItemToSector(itemName: string, category?: string | null): AuditSector {
  const searchText = `${itemName} ${category || ''}`.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  // First check category if provided (more accurate)
  if (category) {
    const categoryLower = category.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    for (const [sector, config] of Object.entries(SECTOR_POSITION_MAP)) {
      const normalizedKeywords = config.keywords.map(kw => 
        kw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      );
      if (normalizedKeywords.some(kw => categoryLower.includes(kw))) {
        return sector as AuditSector;
      }
    }
  }
  
  // Then check item name
  for (const [sector, config] of Object.entries(SECTOR_POSITION_MAP)) {
    const normalizedKeywords = config.keywords.map(kw => 
      kw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    );
    if (normalizedKeywords.some(kw => searchText.includes(kw))) {
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
  return ['gerente_front'];
}

// Get all chiefs for an area type
export function getChiefsForArea(areaType: AreaType): LeadershipPosition[] {
  if (areaType === 'back') {
    return ['chefe_bar', 'chefe_cozinha', 'chefe_parrilla', 'chefe_sushi'];
  }
  return ['chefe_salao', 'chefe_apv'];
}

// Get all sectors for an area type
export function getSectorsForArea(areaType: AreaType): AuditSector[] {
  return Object.entries(SECTOR_POSITION_MAP)
    .filter(([, config]) => config.areaType === areaType)
    .map(([sector]) => sector as AuditSector);
}

// Get a summary of responsibilities by position
export function getResponsibilitySummary(): Record<LeadershipPosition, {
  directSectors: AuditSector[];
  areaType: AreaType;
}> {
  const summary: Record<LeadershipPosition, { directSectors: AuditSector[]; areaType: AreaType }> = {
    chefe_salao: { directSectors: [], areaType: 'front' },
    chefe_apv: { directSectors: [], areaType: 'front' },
    chefe_bar: { directSectors: [], areaType: 'back' },
    chefe_cozinha: { directSectors: [], areaType: 'back' },
    chefe_parrilla: { directSectors: [], areaType: 'back' },
    chefe_sushi: { directSectors: [], areaType: 'back' },
    gerente_front: { directSectors: [], areaType: 'front' },
    gerente_back: { directSectors: [], areaType: 'back' },
  };

  for (const [sector, config] of Object.entries(SECTOR_POSITION_MAP)) {
    if (config.primaryChief) {
      summary[config.primaryChief].directSectors.push(sector as AuditSector);
    } else {
      // If no chief, assign directly to manager
      summary[config.responsibleManager].directSectors.push(sector as AuditSector);
    }
  }

  return summary;
}
