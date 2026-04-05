import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BorderRadius, Colors, Spacing, Typography } from '../src/constants/theme';
import { useAuth } from '../src/context/auth';
import { useProfile } from '../src/hooks/useProfile';
import { useSearchProfiles } from '../src/hooks/useSearch';
import { supabase } from '../src/lib/supabase';
import type { Profile } from '../src/types';

// ─── Reusable row ────────────────────────────────────────────────────────────

type RowProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  destructive?: boolean;
  external?: boolean;
};

function SettingsRow({ icon, label, onPress, destructive, external }: RowProps) {
  const color = destructive ? Colors.cancelled : Colors.textPrimary;
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.rowLeft}>
        <Ionicons name={icon} size={20} color={color} />
        <Text style={[styles.rowLabel, destructive && styles.rowLabelDestructive]}>
          {label}
        </Text>
      </View>
      <Ionicons
        name={external ? 'open-outline' : 'chevron-forward'}
        size={16}
        color={Colors.textTertiary}
      />
    </TouchableOpacity>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

// ─── Section ──────────────────────────────────────────────────────────────────

function Section({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      {title ? <Text style={styles.sectionTitle}>{title}</Text> : null}
      <View style={styles.card}>{children}</View>
    </View>
  );
}

// ─── Contact Support Modal ────────────────────────────────────────────────────

function ContactSupportModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  function handleClose() {
    setSubject('');
    setMessage('');
    onClose();
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.modalOuter}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableWithoutFeedback onPress={handleClose}>
          <View style={styles.modalBackdrop} />
        </TouchableWithoutFeedback>

        <View style={styles.sheet}>
          {/* Sheet header */}
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Contact Support</Text>
            <TouchableOpacity onPress={handleClose} activeOpacity={0.7}>
              <Ionicons name="close" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.input}
            placeholder="Subject"
            placeholderTextColor={Colors.textTertiary}
            value={subject}
            onChangeText={setSubject}
            returnKeyType="next"
          />
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            placeholder="Tell us what's on your mind…"
            placeholderTextColor={Colors.textTertiary}
            value={message}
            onChangeText={setMessage}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
          />

          <TouchableOpacity
            style={[styles.submitButton, !(subject.trim() && message.trim()) && styles.submitButtonDisabled]}
            onPress={handleClose}
            activeOpacity={0.8}
            disabled={!subject.trim() || !message.trim()}
          >
            <Text style={styles.submitButtonText}>Submit</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Report User Modal ────────────────────────────────────────────────────────

function ReportUserModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<Pick<Profile, 'id' | 'display_name' | 'profile_picture_url'> | null>(null);
  const [reason, setReason] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: searchResults = [], isFetching } = useSearchProfiles(debouncedQuery);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQuery(searchQuery), 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery]);

  function handleClose() {
    setSearchQuery('');
    setDebouncedQuery('');
    setSelectedUser(null);
    setReason('');
    Keyboard.dismiss();
    onClose();
  }

  function handleSelectUser(user: Pick<Profile, 'id' | 'display_name' | 'profile_picture_url'>) {
    setSelectedUser(user);
    setSearchQuery('');
    setDebouncedQuery('');
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.modalOuter}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableWithoutFeedback onPress={handleClose}>
          <View style={styles.modalBackdrop} />
        </TouchableWithoutFeedback>

        <View style={styles.sheet}>
          {/* Sheet header */}
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Report a User</Text>
            <TouchableOpacity onPress={handleClose} activeOpacity={0.7}>
              <Ionicons name="close" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Selected user chip */}
          {selectedUser ? (
            <View style={styles.selectedChip}>
              {selectedUser.profile_picture_url ? (
                <Image
                  source={{ uri: selectedUser.profile_picture_url }}
                  style={styles.chipAvatar}
                />
              ) : (
                <View style={[styles.chipAvatar, styles.chipAvatarPlaceholder]}>
                  <Text style={styles.chipAvatarInitial}>
                    {selectedUser.display_name.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <Text style={styles.chipName} numberOfLines={1}>
                {selectedUser.display_name}
              </Text>
              <TouchableOpacity onPress={() => setSelectedUser(null)} activeOpacity={0.7}>
                <Ionicons name="close-circle" size={18} color={Colors.textTertiary} />
              </TouchableOpacity>
            </View>
          ) : (
            /* Search input */
            <View style={styles.searchBar}>
              <Ionicons name="search" size={16} color={Colors.textTertiary} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search for a user…"
                placeholderTextColor={Colors.textTertiary}
                value={searchQuery}
                onChangeText={setSearchQuery}
                returnKeyType="search"
                autoCorrect={false}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => { setSearchQuery(''); setDebouncedQuery(''); }} activeOpacity={0.7}>
                  <Ionicons name="close-circle" size={16} color={Colors.textTertiary} />
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Search results */}
          {!selectedUser && debouncedQuery.length > 0 && (
            <View style={styles.searchResults}>
              {isFetching ? (
                <Text style={styles.searchHint}>Searching…</Text>
              ) : searchResults.length === 0 ? (
                <Text style={styles.searchHint}>No users found</Text>
              ) : (
                <FlatList
                  data={searchResults}
                  keyExtractor={(item) => item.id}
                  keyboardShouldPersistTaps="handled"
                  style={{ maxHeight: 160 }}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.resultRow}
                      onPress={() => handleSelectUser(item)}
                      activeOpacity={0.7}
                    >
                      {item.profile_picture_url ? (
                        <Image
                          source={{ uri: item.profile_picture_url }}
                          style={styles.resultAvatar}
                        />
                      ) : (
                        <View style={[styles.resultAvatar, styles.resultAvatarPlaceholder]}>
                          <Text style={styles.resultAvatarInitial}>
                            {item.display_name.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                      )}
                      <Text style={styles.resultName} numberOfLines={1}>
                        {item.display_name}
                      </Text>
                    </TouchableOpacity>
                  )}
                />
              )}
            </View>
          )}

          <TextInput
            style={[styles.input, styles.inputMultiline]}
            placeholder="Describe the reason for your report…"
            placeholderTextColor={Colors.textTertiary}
            value={reason}
            onChangeText={setReason}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />

          <TouchableOpacity
            style={[styles.submitButton, !(selectedUser && reason.trim()) && styles.submitButtonDisabled]}
            onPress={handleClose}
            activeOpacity={0.8}
            disabled={!selectedUser || !reason.trim()}
          >
            <Text style={styles.submitButtonText}>Submit Report</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const { data: profileData } = useProfile(userId);
  const profileId = profileData?.profile?.id;

  const [supportVisible, setSupportVisible] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);

  function openExternal(url: string) {
    Linking.openURL(url).catch(() =>
      Alert.alert('Error', 'Could not open this link.'),
    );
  }

  function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
          // onAuthStateChange in _layout.tsx fires → nav guard redirects to /(auth)
        },
      },
    ]);
  }

  function handleDeleteAccount() {
    Alert.alert(
      'Delete Account',
      'This permanently deletes your account and all your data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.rpc('delete_account');
            if (error) {
              Alert.alert('Error', error.message);
              return;
            }
            await supabase.auth.signOut();
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          activeOpacity={0.7}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Group 1 — Profile (no title) */}
        <Section>
          <SettingsRow
            icon="person-outline"
            label="View Profile"
            onPress={() => router.push(`/profile/${profileId}` as any)}
          />
          <Separator />
          <SettingsRow
            icon="create-outline"
            label="Edit Profile"
            onPress={() => router.push('/edit-profile' as any)}
          />
        </Section>

        {/* Group 2 — Preferences */}
        <Section title="Preferences">
          <SettingsRow
            icon="notifications-outline"
            label="Notifications"
            onPress={() => router.push('/notification-preferences' as any)}
          />
        </Section>

        {/* Group 3 — Resources */}
        <Section title="Resources">
          <SettingsRow
            icon="chatbubble-outline"
            label="Contact Support"
            onPress={() => setSupportVisible(true)}
          />
          <Separator />
          <SettingsRow
            icon="flag-outline"
            label="Report a User"
            onPress={() => setReportVisible(true)}
          />
        </Section>

        {/* Group 4 — External */}
        <Section title="External">
          <SettingsRow
            icon="star-outline"
            label="Rate on App Store"
            onPress={() => openExternal('https://apps.apple.com')}
            external
          />
          <Separator />
          <SettingsRow
            icon="logo-instagram"
            label="Find us on Instagram"
            onPress={() => openExternal('https://instagram.com')}
            external
          />
          <Separator />
          <SettingsRow
            icon="logo-tiktok"
            label="Find us on TikTok"
            onPress={() => openExternal('https://tiktok.com')}
            external
          />
        </Section>

        {/* Group 5 — Account (no title) */}
        <Section>
          <SettingsRow
            icon="log-out-outline"
            label="Sign Out"
            onPress={handleSignOut}
            destructive
          />
          <Separator />
          <SettingsRow
            icon="trash-outline"
            label="Delete Account"
            onPress={handleDeleteAccount}
            destructive
          />
        </Section>
      </ScrollView>

      <ContactSupportModal
        visible={supportVisible}
        onClose={() => setSupportVisible(false)}
      />
      <ReportUserModal
        visible={reportVisible}
        onClose={() => setReportVisible(false)}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  backButton: {
    width: 36,
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.semibold,
    color: Colors.textPrimary,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xl,
    gap: Spacing.xs,
  },

  // Section
  section: {
    gap: Spacing.xs,
    paddingTop: Spacing.md,
  },
  sectionTitle: {
    fontSize: Typography.size.xs,
    fontWeight: Typography.weight.semibold,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: Spacing.xs,
    paddingBottom: Spacing.xs,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },

  // Row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    minHeight: 56,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  rowLabel: {
    fontSize: Typography.size.base,
    color: Colors.textPrimary,
    fontWeight: Typography.weight.regular,
  },
  rowLabelDestructive: {
    color: Colors.cancelled,
  },
  separator: {
    height: 1,
    backgroundColor: Colors.border,
    marginLeft: Spacing.md + 20 + Spacing.md, // align with text (icon + gap)
  },

  // Modal / Sheet
  modalOuter: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing['2xl'],
    gap: Spacing.md,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  sheetTitle: {
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.semibold,
    color: Colors.textPrimary,
  },
  input: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: Typography.size.base,
    color: Colors.textPrimary,
  },
  inputMultiline: {
    minHeight: 100,
    paddingTop: Spacing.sm,
  },
  submitButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.4,
  },
  submitButtonText: {
    fontSize: Typography.size.base,
    fontWeight: Typography.weight.semibold,
    color: Colors.textPrimary,
  },

  // Contact support / report search
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: Typography.size.base,
    color: Colors.textPrimary,
  },
  searchResults: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  searchHint: {
    fontSize: Typography.size.sm,
    color: Colors.textTertiary,
    padding: Spacing.md,
    textAlign: 'center',
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  resultAvatar: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.avatar,
  },
  resultAvatarPlaceholder: {
    backgroundColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultAvatarInitial: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.bold,
    color: Colors.primary,
  },
  resultName: {
    flex: 1,
    fontSize: Typography.size.base,
    color: Colors.textPrimary,
  },

  // Selected user chip
  selectedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  chipAvatar: {
    width: 24,
    height: 24,
    borderRadius: BorderRadius.avatar,
  },
  chipAvatarPlaceholder: {
    backgroundColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipAvatarInitial: {
    fontSize: Typography.size.xs,
    fontWeight: Typography.weight.bold,
    color: Colors.primary,
  },
  chipName: {
    fontSize: Typography.size.sm,
    color: Colors.textPrimary,
    fontWeight: Typography.weight.medium,
    flexShrink: 1,
  },
});
