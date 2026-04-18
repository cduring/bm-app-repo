import { useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';

export type TabKey = 'discover' | 'map' | 'my-events' | 'account';

const STORE_KEY_PREFIX = 'intro_seen_v1_';

export function useIntroModal(tabKey: TabKey, userId: string | undefined) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    (async () => {
      const raw = await SecureStore.getItemAsync(`${STORE_KEY_PREFIX}${userId}`);
      const seen: Partial<Record<TabKey, boolean>> = raw ? JSON.parse(raw) : {};
      if (!cancelled && !seen[tabKey]) {
        setVisible(true);
      }
    })();

    return () => { cancelled = true; };
  }, [userId, tabKey]);

  const dismiss = async () => {
    setVisible(false);
    if (!userId) return;
    const raw = await SecureStore.getItemAsync(`${STORE_KEY_PREFIX}${userId}`);
    const seen: Partial<Record<TabKey, boolean>> = raw ? JSON.parse(raw) : {};
    seen[tabKey] = true;
    await SecureStore.setItemAsync(`${STORE_KEY_PREFIX}${userId}`, JSON.stringify(seen));
  };

  return { visible, dismiss };
}
