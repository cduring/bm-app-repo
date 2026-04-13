import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import type { Niche } from "../types";

async function fetchNiches(): Promise<Niche[]> {
  const { data, error } = await supabase
    .from("niches")
    .select("id, name, color")
    .order("name");

  if (error) throw error;
  return (data ?? []).map((n) => ({
    id: String(n.id),
    name: n.name,
    color: n.color ?? undefined,
  }));
}

export function useNiches() {
  return useQuery<Niche[]>({
    queryKey: ["niches"],
    queryFn: fetchNiches,
    staleTime: Infinity, // niches rarely change
  });
}
