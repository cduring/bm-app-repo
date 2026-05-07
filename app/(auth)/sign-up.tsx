import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { APP_WEBSITE } from "../../src/constants/app";
import {
  BorderRadius,
  Colors,
  Spacing,
  Typography,
} from "../../src/constants/theme";
import { signInWithApple, signInWithGoogle } from "../../src/lib/oauth";
import { supabase } from "../../src/lib/supabase";

const RESEND_COOLDOWN_SECONDS = 30;

export default function SignUpScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<"apple" | "google" | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendError, setResendError] = useState<string | null>(null);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = setInterval(
      () => setResendCooldown((c) => Math.max(0, c - 1)),
      1000,
    );
    return () => clearInterval(id);
  }, [resendCooldown]);

  async function handleOAuth(provider: "apple" | "google") {
    setOauthLoading(provider);
    setError(null);
    const { error: oauthError } =
      provider === "apple" ? await signInWithApple() : await signInWithGoogle();
    setOauthLoading(null);
    if (oauthError) setError(oauthError);
  }

  function getRedirectTo() {
    return `${APP_WEBSITE}/auth/callback`;
  }

  async function handleSignUp() {
    if (!email.trim() || !password) {
      setError("Please fill in all fields.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    setError(null);

    const { error: authError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: getRedirectTo() },
    });

    setLoading(false);

    if (authError) {
      setError(authError.message);
      return;
    }
    setSubmitted(true);
    setResendCooldown(RESEND_COOLDOWN_SECONDS);
  }

  async function handleResend() {
    setResendError(null);
    const { error: resendErr } = await supabase.auth.resend({
      type: "signup",
      email: email.trim(),
      options: { emailRedirectTo: getRedirectTo() },
    });
    if (resendErr) {
      setResendError(resendErr.message);
      return;
    }
    setResendCooldown(RESEND_COOLDOWN_SECONDS);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>

          {submitted ? (
            <View style={styles.successBox}>
              <Ionicons name="mail-outline" size={56} color={Colors.primary} />
              <Text style={styles.successTitle}>Check your email</Text>
              <Text style={styles.successBody}>
                We sent a verification link to{" "}
                <Text style={styles.successEmail}>{email.trim()}</Text>. Tap it
                to finish creating your account.
              </Text>
              <Text style={styles.successBody}>
                If you already have an account with this email,{" "}
                <Text
                  style={styles.footerLink}
                  onPress={() => router.replace("/(auth)/sign-in")}
                >
                  try logging in
                </Text>
                .
              </Text>

              {resendError && (
                <View style={styles.errorBox}>
                  <Ionicons
                    name="alert-circle-outline"
                    size={16}
                    color={Colors.cancelled}
                  />
                  <Text style={styles.errorText}>{resendError}</Text>
                </View>
              )}

              <TouchableOpacity
                onPress={handleResend}
                disabled={resendCooldown > 0}
                style={styles.resendButton}
              >
                <Text
                  style={[
                    styles.footerLink,
                    resendCooldown > 0 && styles.resendDisabled,
                  ]}
                >
                  {resendCooldown > 0
                    ? `Resend email (${resendCooldown}s)`
                    : "Didn't get it? Resend email"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => router.replace("/(auth)/sign-in")}
              >
                <Text style={styles.footerLink}>Back to sign in</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={styles.header}>
                <Text style={styles.title}>Create account</Text>
                <Text style={styles.subtitle}>
                  Join Toronto's creator community.
                </Text>
              </View>

              {/* Social sign-in */}
              <View style={styles.socialButtons}>
                {Platform.OS === "ios" && (
                  <TouchableOpacity
                    style={styles.socialButton}
                    onPress={() => handleOAuth("apple")}
                    disabled={!!oauthLoading}
                    activeOpacity={0.85}
                  >
                    {oauthLoading === "apple" ? (
                      <ActivityIndicator color={Colors.textPrimary} />
                    ) : (
                      <>
                        <Ionicons
                          name="logo-apple"
                          size={20}
                          color={Colors.textPrimary}
                        />
                        <Text style={styles.socialButtonText}>
                          Continue with Apple
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.socialButton}
                  onPress={() => handleOAuth("google")}
                  disabled={!!oauthLoading}
                  activeOpacity={0.85}
                >
                  {oauthLoading === "google" ? (
                    <ActivityIndicator color={Colors.textPrimary} />
                  ) : (
                    <>
                      <Ionicons
                        name="logo-google"
                        size={20}
                        color={Colors.textPrimary}
                      />
                      <Text style={styles.socialButtonText}>
                        Continue with Google
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              {/* Divider */}
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.dividerLine} />
              </View>

              <View style={styles.form}>
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Email</Text>
                  <TextInput
                    style={styles.input}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="you@example.com"
                    placeholderTextColor={Colors.textTertiary}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                    textContentType="emailAddress"
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Password</Text>
                  <View style={styles.passwordRow}>
                    {passwordVisible ? (
                      <TextInput
                        style={[styles.input, styles.passwordInput]}
                        value={password}
                        onChangeText={setPassword}
                        placeholder="Min. 6 characters"
                        placeholderTextColor={Colors.textTertiary}
                        autoCapitalize="none"
                        autoCorrect={false}
                        autoComplete="new-password"
                        textContentType="newPassword"
                      />
                    ) : (
                      <TextInput
                        style={[styles.input, styles.passwordInput]}
                        value={password}
                        onChangeText={setPassword}
                        placeholder="Min. 6 characters"
                        placeholderTextColor={Colors.textTertiary}
                        secureTextEntry
                        autoCapitalize="none"
                        autoCorrect={false}
                        autoComplete="new-password"
                        textContentType="newPassword"
                      />
                    )}
                    <TouchableOpacity
                      style={styles.eyeButton}
                      onPress={() => setPasswordVisible((v) => !v)}
                    >
                      <Ionicons
                        name={
                          passwordVisible ? "eye-off-outline" : "eye-outline"
                        }
                        size={20}
                        color={Colors.textTertiary}
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                {error && (
                  <View style={styles.errorBox}>
                    <Ionicons
                      name="alert-circle-outline"
                      size={16}
                      color={Colors.cancelled}
                    />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}

                <TouchableOpacity
                  style={[
                    styles.submitButton,
                    loading && styles.submitButtonDisabled,
                  ]}
                  activeOpacity={0.85}
                  onPress={handleSignUp}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color={Colors.textPrimary} />
                  ) : (
                    <Text style={styles.submitButtonText}>Create Account</Text>
                  )}
                </TouchableOpacity>
              </View>

              <View style={styles.footer}>
                <Text style={styles.footerText}>Already have an account? </Text>
                <TouchableOpacity
                  onPress={() => router.replace("/(auth)/sign-in")}
                >
                  <Text style={styles.footerLink}>Log in</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  backButton: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.lg,
    width: 40,
    height: 40,
    justifyContent: "center",
  },
  header: {
    marginBottom: Spacing.xl,
  },
  title: {
    fontSize: Typography.size["2xl"],
    fontWeight: Typography.weight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: Typography.size.base,
    color: Colors.textSecondary,
  },
  form: {
    flex: 1,
    gap: Spacing.md,
  },
  fieldGroup: {
    gap: Spacing.xs,
  },
  label: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.medium,
    color: Colors.textSecondary,
  },
  input: {
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    fontSize: Typography.size.base,
    color: Colors.textPrimary,
  },
  passwordRow: {
    position: "relative",
  },
  passwordInput: {
    paddingRight: 48,
  },
  eyeButton: {
    position: "absolute",
    right: 14,
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    backgroundColor: "#2A0A0A",
    borderWidth: 1,
    borderColor: "#4A1A1A",
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
  },
  errorText: {
    flex: 1,
    fontSize: Typography.size.sm,
    color: Colors.cancelled,
  },
  submitButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: Spacing.sm,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: Colors.textPrimary,
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.semibold,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: Spacing.xl,
  },
  footerText: {
    fontSize: Typography.size.sm,
    color: Colors.textSecondary,
  },
  footerLink: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.semibold,
    color: Colors.primary,
  },
  socialButtons: {
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  socialButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingVertical: 14,
  },
  socialButtonText: {
    fontSize: Typography.size.base,
    color: Colors.textPrimary,
    fontWeight: Typography.weight.medium,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    fontSize: Typography.size.sm,
    color: Colors.textTertiary,
  },
  successBox: {
    alignItems: "center",
    gap: Spacing.md,
    paddingTop: Spacing.xl,
    paddingHorizontal: Spacing.md,
  },
  successTitle: {
    fontSize: Typography.size["2xl"],
    fontWeight: Typography.weight.bold,
    color: Colors.textPrimary,
    marginTop: Spacing.sm,
  },
  successBody: {
    fontSize: Typography.size.base,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: Spacing.md,
  },
  successEmail: {
    color: Colors.textPrimary,
    fontWeight: Typography.weight.semibold,
  },
  resendButton: {
    marginTop: Spacing.sm,
  },
  resendDisabled: {
    color: Colors.textTertiary,
  },
});
