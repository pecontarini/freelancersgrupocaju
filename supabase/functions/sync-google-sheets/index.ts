import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SyncRequest {
  syncId: string;
  url: string;
  referenciaMes: string;
  lojaId?: string;
}

interface SheetRow {
  unidade?: string;
  loja?: string;
  data_referencia?: string;
  faturamento?: string | number;
  faturamento_salao?: string | number;
  faturamento_delivery?: string | number;
  nps?: string | number;
  reclamacoes?: string | number;
  reclamacoes_salao?: string | number;
  reclamacoes_ifood?: string | number;
}

// Extract Google Sheets ID from URL
function extractSheetsId(url: string): string | null {
  const patterns = [
    /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/,
    /\/d\/([a-zA-Z0-9-_]+)\//,
    /^([a-zA-Z0-9-_]{40,})$/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }
  return null;
}

// Parse CSV content
function parseCSV(csvContent: string): SheetRow[] {
  const lines = csvContent.split('\n').filter(line => line.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => 
    h.trim().toLowerCase()
      .replace(/["']/g, '')
      .replace(/\s+/g, '_')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  );

  const rows: SheetRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/["']/g, ''));
    const row: Record<string, string> = {};

    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });

    rows.push(row as unknown as SheetRow);
  }

  return rows;
}

// Parse currency values
function parseCurrency(value: string | number | undefined): number {
  if (value === undefined || value === null || value === '') return 0;
  if (typeof value === 'number') return value;
  
  // Remove currency symbols and parse
  const cleaned = value
    .replace(/[R$\s]/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  
  return parseFloat(cleaned) || 0;
}

// Parse integer values
function parseInteger(value: string | number | undefined): number {
  if (value === undefined || value === null || value === '') return 0;
  if (typeof value === 'number') return Math.round(value);
  return parseInt(value.replace(/\D/g, ''), 10) || 0;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: SyncRequest = await req.json();
    const { syncId, url, referenciaMes, lojaId } = body;

    console.log('Starting Google Sheets sync:', { syncId, url, referenciaMes, lojaId });

    // Update sync status to processing
    await supabase
      .from('sincronizacoes_sheets')
      .update({ status: 'processing' })
      .eq('id', syncId);

    // Extract sheets ID
    const sheetsId = extractSheetsId(url);
    if (!sheetsId) {
      throw new Error('URL do Google Sheets inválida. Use o link de compartilhamento.');
    }

    // Fetch CSV data
    const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetsId}/export?format=csv&gid=0`;
    console.log('Fetching CSV from:', csvUrl);

    const csvResponse = await fetch(csvUrl);
    if (!csvResponse.ok) {
      throw new Error('Não foi possível acessar a planilha. Verifique se ela está compartilhada publicamente.');
    }

    const csvContent = await csvResponse.text();
    const rows = parseCSV(csvContent);

    if (rows.length === 0) {
      throw new Error('Planilha vazia ou formato inválido.');
    }

    console.log(`Parsed ${rows.length} rows from spreadsheet`);

    // Get all stores for matching
    const { data: lojas } = await supabase
      .from('config_lojas')
      .select('id, nome');

    const lojaMap = new Map(lojas?.map(l => [l.nome.toUpperCase(), l.id]) || []);

    // Process rows and create performance entries
    const entries = [];
    let importedCount = 0;

    for (const row of rows) {
      const unidadeName = (row.unidade || row.loja || '').toString().toUpperCase().trim();
      if (!unidadeName) continue;

      // Find matching loja
      let matchedLojaId = lojaId;
      if (!matchedLojaId) {
        // Try exact match
        matchedLojaId = lojaMap.get(unidadeName);
        
        // Try partial match
        if (!matchedLojaId) {
          for (const [nome, id] of lojaMap.entries()) {
            if (nome.includes(unidadeName) || unidadeName.includes(nome)) {
              matchedLojaId = id;
              break;
            }
          }
        }
      }

      if (!matchedLojaId) {
        console.log(`Skipping row - no matching store for: ${unidadeName}`);
        continue;
      }

      // Parse values
      const faturamentoSalao = parseCurrency(row.faturamento_salao || row.faturamento);
      const faturamentoDelivery = parseCurrency(row.faturamento_delivery || 0);
      const reclamacoesSalao = parseInteger(row.reclamacoes_salao || row.reclamacoes);
      const reclamacoesIfood = parseInteger(row.reclamacoes_ifood || 0);

      // Create entry date from referenciaMes
      const entryDate = `${referenciaMes}-15`; // Middle of month

      entries.push({
        loja_id: matchedLojaId,
        entry_date: entryDate,
        faturamento_salao: faturamentoSalao,
        faturamento_delivery: faturamentoDelivery,
        reclamacoes_salao: reclamacoesSalao,
        reclamacoes_ifood: reclamacoesIfood,
        notes: `Importado via Google Sheets em ${new Date().toISOString()}`,
      });

      importedCount++;
    }

    // Insert entries
    if (entries.length > 0) {
      const { error: insertError } = await supabase
        .from('store_performance_entries')
        .upsert(entries, { 
          onConflict: 'loja_id,entry_date',
          ignoreDuplicates: false 
        });

      if (insertError) {
        console.error('Error inserting entries:', insertError);
        throw new Error('Erro ao inserir dados no banco.');
      }
    }

    // Update sync status to success
    await supabase
      .from('sincronizacoes_sheets')
      .update({ 
        status: 'success',
        linhas_importadas: importedCount,
        completed_at: new Date().toISOString()
      })
      .eq('id', syncId);

    console.log(`Sync completed successfully. Imported ${importedCount} rows.`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        linhasImportadas: importedCount,
        message: `${importedCount} linhas importadas com sucesso.`
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Sync error:', error);

    // Try to update sync status to error
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      const body = await req.clone().json();
      if (body.syncId) {
        await supabase
          .from('sincronizacoes_sheets')
          .update({ 
            status: 'error',
            erro: error instanceof Error ? error.message : 'Erro desconhecido',
            completed_at: new Date().toISOString()
          })
          .eq('id', body.syncId);
      }
    } catch (e) {
      console.error('Error updating sync status:', e);
    }

    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro ao processar planilha' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});