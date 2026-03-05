import { createContext, useContext } from 'react';
import type { Session } from '@supabase/supabase-js';

interface AuthContextValue {
  session: Session | null | undefined;
  profileExists: boolean | null;
  onboardingComplete: () => void;
}

export const AuthContext = createContext<AuthContextValue>({
  session: undefined,
  profileExists: null,
  onboardingComplete: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}
