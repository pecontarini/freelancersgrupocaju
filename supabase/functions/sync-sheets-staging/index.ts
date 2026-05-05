import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SyncRequest {
  sourceId: string;
  url: string;
  referenciaMes: string;
}

interface SheetRow {
  unidade?: string;
  data_referencia?: string;
  faturamento?: string | number;
  nps?: string | number;
  nota_reclamacao?: string | number;
  tipo_operacao?: string;
}

// Parse CSV content with proper handling
function parseCSV(csvContent: string): SheetRow[] {
  const lines = csvContent.split('\n').filter(line => line.trim());
  if (lines.length < 2) return [];

  // Normalize headers
  const headers = lines[0].split(',').map(h => 
    h.trim().toLowerCase()
      .replace(/["']/g, '')
      .replace(/\s+/g, '_')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  );

  const rows: SheetRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    // Handle CSV values with potential commas inside quotes
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (const char of lines[i]) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim().replace(/["']/g, ''));
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim().replace(/["']/g, ''));

    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });

    rows.push(row as unknown as SheetRow);
  }

  return rows;
}

// Normalize store name
function normalizeUnidade(name: string): string {
  return name
    .toUpperCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_');
}

// Parse number from string
function parseNumber(value: string | number | undefined): number {
  if (value === undefined || value === null || value === '') return 0;
  if (typeof value === 'number') return value;
  
  const cleaned = value
    .replace(/[R$\s]/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  
  return parseFloat(cleaned) || 0;
}

// Parse date string
function parseDate(value: string | undefined): string | null {
  if (!value) return null;
  
  // Try various formats
  const patterns = [
    /^(\d{4})-(\d{2})-(\d{2})/, // YYYY-MM-DD
    /^(\d{2})\/(\d{2})\/(\d{4})/, // DD/MM/YYYY
  ];

  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (match) {
      if (pattern === patterns[0]) {
        return `${match[1]}-${match[2]}-${match[3]}`;
      } else {
        return `${match[3]}-${match[2]}-${match[1]}`;
      }
    }
  }
  
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: SyncRequest = await req.json();
    const { sourceId, url, referenciaMes } = body;

    console.log('Starting staging sync:', { sourceId, referenciaMes });

    // Normaliza qualquer link Google Sheets para CSV canônico
    const normalizeSheetsUrl = (raw: string): string | null => {
      if (!raw) return null;
      const t = raw.trim();
      if (/\/spreadsheets\/d\/[a-zA-Z0-9-_]+\/gviz\/tq/.test(t)) return t;
      const idMatch = t.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      if (!idMatch) return null;
      const gidMatch = t.match(/[#?&]gid=(\d+)/);
      const gid = gidMatch ? gidMatch[1] : '0';
      return `https://docs.google.com/spreadsheets/d/${idMatch[1]}/export?format=csv&gid=${gid}`;
    };

    const normalizedUrl = normalizeSheetsUrl(url);
    if (!normalizedUrl) {
      throw new Error('URL inválida. Cole um link do Google Sheets.');
    }

    // Fetch CSV
    const csvResponse = await fetch(normalizedUrl);
    if (!csvResponse.ok) {
      throw new Error('Não foi possível acessar a planilha. Verifique se está pública.');
    }

    const csvContent = await csvResponse.text();
    const rows = parseCSV(csvContent);

    if (rows.length === 0) {
      throw new Error('Planilha vazia ou formato inválido.');
    }

    console.log(`Parsed ${rows.length} rows`);

    // Validate required columns
    const requiredColumns = ['unidade', 'data_referencia', 'faturamento'];
    const firstRow = rows[0] as Record<string, unknown>;
    const missingColumns = requiredColumns.filter(col => !(col in firstRow));
    
    if (missingColumns.length > 0) {
      throw new Error(`Colunas obrigatórias faltando: ${missingColumns.join(', ')}`);
    }

    // Get stores for matching
    const { data: lojas } = await supabase
      .from('config_lojas')
      .select('id, nome');

    const lojaMap = new Map(lojas?.map(l => [normalizeUnidade(l.nome), l.id]) || []);

    // Create sync record
    const { data: syncData, error: syncError } = await supabase
      .from('sincronizacoes_sheets')
      .insert({
        url: normalizedUrl,
        referencia_mes: referenciaMes,
        loja_id: null,
        status: 'processing',
      })
      .select()
      .single();

    if (syncError) {
      console.error('Error creating sync record:', syncError);
    }

    const syncId = syncData?.id;

    // Process rows into staging
    const stagingRows = [];
    let importedCount = 0;

    for (const row of rows) {
      const unidadeRaw = (row.unidade || '').toString().trim();
      if (!unidadeRaw) continue;

      const unidadeNormalizada = normalizeUnidade(unidadeRaw);
      const lojaId = lojaMap.get(unidadeNormalizada) || null;

      // Try partial match if exact match fails
      let matchedLojaId = lojaId;
      if (!matchedLojaId) {
        for (const [nome, id] of lojaMap.entries()) {
          if (nome.includes(unidadeNormalizada) || unidadeNormalizada.includes(nome)) {
            matchedLojaId = id;
            break;
          }
        }
      }

      const dataRef = parseDate(row.data_referencia?.toString()) || `${referenciaMes}-15`;
      const tipoOp = row.tipo_operacao?.toString().toLowerCase();
      const validTipo = tipoOp === 'salao' || tipoOp === 'delivery' ? tipoOp : null;

      stagingRows.push({
        source_id: sourceId,
        sync_id: syncId,
        unidade_raw: unidadeRaw,
        unidade_normalizada: unidadeNormalizada,
        loja_id: matchedLojaId,
        data_referencia: dataRef,
        faturamento: parseNumber(row.faturamento),
        nps: row.nps ? parseNumber(row.nps) : null,
        nota_reclamacao: row.nota_reclamacao ? parseNumber(row.nota_reclamacao) : null,
        tipo_operacao: validTipo,
        processed: false,
      });

      importedCount++;
    }

    // Insert staging data
    if (stagingRows.length > 0) {
      const { error: insertError } = await supabase
        .from('sheets_staging')
        .insert(stagingRows);

      if (insertError) {
        console.error('Error inserting staging:', insertError);
        throw new Error('Erro ao inserir dados no staging.');
      }
    }

    // Update source last sync
    await supabase
      .from('sheets_sources')
      .update({ ultima_sincronizacao: new Date().toISOString() })
      .eq('id', sourceId);

    // Update sync status
    if (syncId) {
      await supabase
        .from('sincronizacoes_sheets')
        .update({
          status: 'success',
          linhas_importadas: importedCount,
          completed_at: new Date().toISOString(),
        })
        .eq('id', syncId);
    }

    console.log(`Staging sync completed. ${importedCount} rows imported.`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        rowsImported: importedCount,
        message: `${importedCount} linhas importadas para staging.`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Sync error:', error);

    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro ao processar planilha',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
