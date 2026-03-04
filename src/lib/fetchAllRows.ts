import { supabase } from "@/integrations/supabase/client";

/**
 * Fetches all rows from a Supabase query, paginating in chunks of 1000
 * to bypass the default row limit.
 * 
 * Usage:
 *   const data = await fetchAllRows<MyType>(
 *     () => supabase.from("my_table").select("*").order("created_at", { ascending: false })
 *   );
 * 
 * The factory function is called for each page with .range() applied.
 */
export async function fetchAllRows<T>(
  queryFactory: () => any,
  pageSize = 1000
): Promise<T[]> {
  const allData: T[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await queryFactory().range(from, from + pageSize - 1);

    if (error) throw error;

    if (data && data.length > 0) {
      allData.push(...(data as T[]));
      from += pageSize;
      hasMore = data.length === pageSize;
    } else {
      hasMore = false;
    }
  }

  return allData;
}
