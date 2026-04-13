import { useCallback, useState } from 'react';

/**
 * Encapsulates the common pull-to-refresh pattern:
 * tracks `refreshing` state and calls all refetch functions in parallel.
 */
export function useRefreshHandler(...refetchFns: Array<() => Promise<any>>) {
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all(refetchFns.map(fn => fn()));
    } finally {
      setRefreshing(false);
    }
  }, refetchFns);

  return { refreshing, handleRefresh };
}
