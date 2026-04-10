

# Plano: Garantir download do modelo Excel funcione no preview

## Diagnóstico

O código executa corretamente — a função `generateScheduleTemplate` roda sem erros e o toast "Modelo baixado!" aparece. Porém, `XLSX.writeFile(wb, filename)` internamente cria um `<a href="blob:...">` e clica nele, o que pode ser bloqueado pelo ambiente de preview (iframe sandboxado).

A solução é substituir `XLSX.writeFile` por uma abordagem que use `XLSX.write` para gerar o blob manualmente e forçar o download via `window.open` ou criando o link com `target="_blank"`, garantindo compatibilidade com iframes.

## Solução

### Arquivo: `src/lib/scheduleExcel.ts`

Substituir a linha `XLSX.writeFile(wb, filename)` por uma função auxiliar `forceDownload` que:

1. Gera o buffer com `XLSX.write(wb, { bookType: 'xlsx', type: 'array' })`
2. Cria um `Blob` com o tipo MIME correto
3. Cria um `<a>` com `download` attribute, `href = URL.createObjectURL(blob)` 
4. Faz `document.body.appendChild(link)`, `link.click()`, `link.remove()`, `URL.revokeObjectURL()`

Aplicar essa mesma função auxiliar em todos os outros arquivos que usam `XLSX.writeFile`:
- `src/lib/scheduleMasterExport.ts` (linha 418)
- `src/lib/excelUtils.ts` (linhas 297, 392)
- `src/components/cmv/CMVDailyCountForm.tsx` (linha 168)

### Implementação

Criar uma função reutilizável em `src/lib/excelUtils.ts`:

```typescript
export function downloadWorkbook(wb: XLSX.WorkBook, filename: string) {
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}
```

Depois substituir todas as chamadas `XLSX.writeFile(wb, filename)` por `downloadWorkbook(wb, filename)`.

## Arquivos impactados

| Arquivo | Mudança |
|---------|---------|
| `src/lib/excelUtils.ts` | Adicionar função `downloadWorkbook` |
| `src/lib/scheduleExcel.ts` | Substituir `XLSX.writeFile` por `downloadWorkbook` |
| `src/lib/scheduleMasterExport.ts` | Substituir `XLSX.writeFile` por `downloadWorkbook` |
| `src/components/cmv/CMVDailyCountForm.tsx` | Substituir `XLSX.writeFile` por `downloadWorkbook` |

## Resultado

Download do arquivo Excel funciona de forma confiável em qualquer ambiente, incluindo o preview do Lovable.

