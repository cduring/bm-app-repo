import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import * as Crypto from 'expo-crypto';
import { supabase } from './supabase';

export async function signInWithApple(): Promise<{ error: string | null }> {
  const nonce = Math.random().toString(36).substring(2, 10);
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    nonce
  );
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });
    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken!,
      nonce,
    });
    return { error: error?.message ?? null };
  } catch (e: any) {
    if (e.code === 'ERR_REQUEST_CANCELED') return { error: null };
    return { error: e.message ?? 'Apple sign-in failed' };
  }
}

export async function signInWithGoogle(): Promise<{ error: string | null }> {
  const redirectUrl = Linking.createURL('auth/callback');
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: redirectUrl, skipBrowserRedirect: true },
  });
  if (error || !data.url) return { error: error?.message ?? 'Failed to start Google sign-in' };

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
  if (result.type !== 'success') return { error: null };

  const parsed = Linking.parse(result.url);
  const code = parsed.queryParams?.code as string | undefined;
  if (!code) return { error: 'No code returned from Google' };

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  return { error: exchangeError?.message ?? null };
}
