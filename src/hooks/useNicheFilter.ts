import { useState } from "react";

export function useNicheFilter() {
  const [selectedNicheIds, setSelectedNicheIds] = useState(new Set<string>());

  function toggleNiche(id: string) {
    setSelectedNicheIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function clearAll() {
    setSelectedNicheIds(new Set());
  }

  return { selectedNicheIds, toggleNiche, clearAll, setSelectedNicheIds };
}
