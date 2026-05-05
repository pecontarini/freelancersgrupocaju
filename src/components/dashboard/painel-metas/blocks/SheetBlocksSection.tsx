import { useSheetBlocks, type SheetBlock } from "@/hooks/useSheetBlocks";
import { RankingBlock } from "./RankingBlock";
import { MatrixBlock } from "./MatrixBlock";
import { SeriesBlock } from "./SeriesBlock";
import { DistributionBlock } from "./DistributionBlock";
import { ItemTableBlock } from "./ItemTableBlock";
import { Loader2, FileSpreadsheet } from "lucide-react";

function renderBlock(block: SheetBlock) {
  switch (block.block_type) {
    case "ranking": return <RankingBlock key={block.id} block={block} />;
    case "matrix": return <MatrixBlock key={block.id} block={block} />;
    case "series": return <SeriesBlock key={block.id} block={block} />;
    case "distribution": return <DistributionBlock key={block.id} block={block} />;
    case "item_table": return <ItemTableBlock key={block.id} block={block} />;
    default: return null;
  }
}

/** Renderiza todos os blocos estruturados ligados a uma meta. */
export function SheetBlocksSection({
  metaKey,
  mesRef,
  emptyMessage = "Vincule uma planilha a esta meta em Configurações para ver visualizações detalhadas.",
}: {
  metaKey: string;
  mesRef?: string;
  emptyMessage?: string;
}) {
  const { data: blocks = [], isLoading } = useSheetBlocks(metaKey, mesRef);

  if (isLoading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }
  if (!blocks.length) {
    return (
      <div className="rounded-2xl border border-dashed bg-muted/20 p-6 text-center">
        <FileSpreadsheet className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {blocks.map(renderBlock)}
    </div>
  );
}
