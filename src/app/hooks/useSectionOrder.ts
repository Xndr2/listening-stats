const { useState, useCallback } = Spicetify.React;

const LAYOUT_KEY = "listening-stats:card-order";

export const DEFAULT_ORDER: string[] = [
  "overview",
  "toplists",
  "activity",
  "recent",
];

/**
 * Hook to manage the order of dashboard sections with localStorage persistence.
 * Validates stored order on load: removes stale IDs and appends missing IDs
 * so that new sections added in future updates appear at the end.
 */
export function useSectionOrder() {
  const [order, setOrder] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(LAYOUT_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as string[];
        if (Array.isArray(parsed)) {
          // Remove IDs not in DEFAULT_ORDER (stale), keep valid ones in saved order
          const validated = parsed.filter((id) => DEFAULT_ORDER.includes(id));
          // Append any new section IDs not yet in the saved order
          for (const id of DEFAULT_ORDER) {
            if (!validated.includes(id)) {
              validated.push(id);
            }
          }
          return validated;
        }
      }
    } catch {
      // Ignore parse errors, fall through to default
    }
    return [...DEFAULT_ORDER];
  });

  const reorder = useCallback((newOrder: string[]) => {
    setOrder(newOrder);
    try {
      localStorage.setItem(LAYOUT_KEY, JSON.stringify(newOrder));
    } catch {
      // Ignore quota errors
    }
  }, []);

  const resetOrder = useCallback(() => {
    const defaultCopy = [...DEFAULT_ORDER];
    setOrder(defaultCopy);
    try {
      localStorage.setItem(LAYOUT_KEY, JSON.stringify(defaultCopy));
    } catch {
      // Ignore quota errors
    }
  }, []);

  return { order, reorder, resetOrder };
}
