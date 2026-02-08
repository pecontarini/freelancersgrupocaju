import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface CMVIgnoredItem {
  id: string;
  item_name: string;
  reason: string | null;
  ignored_by: string | null;
  created_at: string;
}

export function useCMVIgnoredItems() {
  const queryClient = useQueryClient();

  const { data: ignoredItems = [], isLoading } = useQuery({
    queryKey: ["cmv-ignored-items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cmv_ignored_items")
        .select("*")
        .order("item_name");
      if (error) throw error;
      return data as CMVIgnoredItem[];
    },
  });

  const ignoreItem = useMutation({
    mutationFn: async ({ itemName, reason }: { itemName: string; reason?: string }) => {
      const { data: user } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("cmv_ignored_items")
        .insert({
          item_name: itemName.toUpperCase().trim(),
          reason: reason || null,
          ignored_by: user.user?.id,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cmv-ignored-items"] });
      queryClient.invalidateQueries({ queryKey: ["unmapped-sales-items"] });
      toast.success("Item marcado como ignorado");
    },
    onError: (error: Error) => {
      if (error.message.includes("duplicate")) {
        toast.error("Este item já está na lista de ignorados");
      } else {
        toast.error(`Erro ao ignorar item: ${error.message}`);
      }
    },
  });

  const unignoreItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("cmv_ignored_items")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cmv-ignored-items"] });
      queryClient.invalidateQueries({ queryKey: ["unmapped-sales-items"] });
      toast.success("Item removido da lista de ignorados");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao remover item: ${error.message}`);
    },
  });

  // Helper to check if an item is ignored
  const ignoredNamesSet = new Set(ignoredItems.map(i => i.item_name.toUpperCase().trim()));
  const isItemIgnored = (itemName: string) => ignoredNamesSet.has(itemName.toUpperCase().trim());

  return { 
    ignoredItems, 
    isLoading, 
    ignoreItem, 
    unignoreItem,
    isItemIgnored,
    ignoredNamesSet,
  };
}
