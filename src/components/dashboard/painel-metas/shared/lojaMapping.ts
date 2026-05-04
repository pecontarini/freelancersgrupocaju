/**
 * Mapeia o nome da loja em config_lojas para o `loja_codigo` usado em metas_snapshot.
 * Baseado em palavras-chave de bandeira + suffix de unidade.
 */
export function lojaCodigoFromNome(nome: string | null | undefined): string | null {
  if (!nome) return null;
  const n = nome.toUpperCase();

  let bandeira: string | null = null;
  if (n.includes("CAMINITO")) bandeira = "CP";
  else if (n.includes("NAZO")) bandeira = "NZ";
  else if (n.includes("CAJU")) bandeira = "CJ";
  else if (n.includes("FB") || n.includes("FOSTER")) bandeira = "FB";
  if (!bandeira) return null;

  let suf: string | null = null;
  if (n.includes("ASA NORTE")) suf = "AN";
  else if (n.includes("ASA SUL")) suf = "AS";
  else if (n.includes("AGUAS CLARAS") || n.includes("ÁGUAS CLARAS")) suf = "AC";
  else if (n.includes("SIG")) suf = "SG";
  else if (n.includes("GO") || n.includes("GOIAN")) suf = "GO";
  if (!suf) return null;

  return `${bandeira}_${suf}`;
}
