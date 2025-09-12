import { useRef } from 'react';

/**
 * Simple memo/cache keyed by a string; batches re-computations inside rAF during rapid updates.
 */
export function useLayoutCache<T>(key: string, compute: () => T): T {
  const cacheRef = useRef<{ key: string; value: T } | null>(null);
  const pendingRef = useRef<{ key: string; value: T } | null>(null);
  const frameRef = useRef<number | null>(null);

  if (cacheRef.current && cacheRef.current.key === key) {
    return cacheRef.current.value;
  }
  // Schedule recompute in next animation frame to coalesce multiple rapid key changes.
  if (!pendingRef.current || pendingRef.current.key !== key) {
    pendingRef.current = { key, value: compute() };
    if (frameRef.current == null) {
      frameRef.current = requestAnimationFrame(() => {
        if (pendingRef.current) {
          cacheRef.current = pendingRef.current;
          pendingRef.current = null;
        }
        frameRef.current = null;
      });
    }
  }
  // Return pending value immediately (speculative) so UI updates without lag.
  return pendingRef.current!.value;
}
