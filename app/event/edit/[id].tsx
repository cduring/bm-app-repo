import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Switch,
  Alert,
  Image,
} from 'react-native';
import { LocationMapPreview } from '../../../src/components/LocationMapPreview';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useQueryClient } from '@tanstack/react-query';
import { useEventById } from '../../../src/hooks/useEvents';
import { supabase } from '../../../src/lib/supabase';
import { useNiches } from '../../../src/hooks/useNiches';
import { EventTypeBadge } from '../../../src/components/EventTypeBadge';
import { Colors, Typography, Spacing, BorderRadius } from '../../../src/constants/theme';
import { formatDayDate, formatTimeRange } from '../../../src/utils/date';
import type { EventPrivacy } from '../../../src/types';

export default function EventEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: event, isLoading } = useEventById(id);
  const qc = useQueryClient();
  const { data: niches = [] } = useNiches();

  const [title, setTitle] = useState(event?.title ?? '');
  const [description, setDescription] = useState(event?.description ?? '');
  const [addressName, setAddressName] = useState(event?.address_name ?? '');
  const [latitude, setLatitude] = useState(event?.latitude ?? 43.6532);
  const [longitude, setLongitude] = useState(event?.longitude ?? -79.3832);
  const [geocoded, setGeocoded] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [privacy, setPrivacy] = useState<EventPrivacy>(event?.privacy ?? 'PUBLIC');
  const [coverUri, setCoverUri] = useState<string | null>(event?.cover_image_url ?? null);
  const [selectedNicheIds, setSelectedNicheIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (event) setSelectedNicheIds(new Set(event.niches.map(n => n.id)));
  }, [event?.id]);

  async function uploadCover(uri: string, eventId: string): Promise<string> {
    const response = await fetch(uri);
    const arrayBuffer = await response.arrayBuffer();
    const path = `${eventId}/cover.jpg`;
    const { error: uploadError } = await supabase.storage
      .from('event-covers')
      .upload(path, arrayBuffer, { contentType: 'image/jpeg', upsert: true });
    if (uploadError) throw uploadError;
    const { data: urlData } = supabase.storage.from('event-covers').getPublicUrl(path);
    return `${urlData.publicUrl}?t=${Date.now()}`;
  }

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images' as ImagePicker.MediaType,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      setCoverUri(result.assets[0].uri);
    }
  }

  async function geocodeAddress(text: string) {
    if (!text.trim()) return;
    setGeocoding(true);
    setLocationError(null);
    try {
      const query = encodeURIComponent(text.trim());
      const token = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json?access_token=${token}&country=ca&limit=1`;
      const res = await fetch(url);
      const data = await res.json();
      const feature = data.features?.[0];
      if (feature && feature.relevance >= 0.6) {
        const [lng, lat] = feature.center;
        setLatitude(lat);
        setLongitude(lng);
        setGeocoded(true);
      } else {
        setLocationError('Location not found. Try a more specific address (e.g. 55 Mill St, Toronto).');
      }
    } catch {
      setLocationError('Could not look up location. Check your connection.');
    } finally {
      setGeocoding(false);
    }
  }

  async function handleSave() {
    if (!id) return;
    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();
    const trimmedAddress = addressName.trim();

    if (!trimmedTitle) {
      Alert.alert('Validation', 'Event title is required.');
      return;
    }
    if (!trimmedDescription) {
      Alert.alert('Validation', 'Description is required.');
      return;
    }
    if (!trimmedAddress) {
      Alert.alert('Validation', 'Location is required.');
      return;
    }

    setSaving(true);
    try {
      // Upload new cover image if the user picked a local file
      let finalCoverUrl = coverUri;
      if (coverUri && !coverUri.startsWith('http')) {
        finalCoverUrl = await uploadCover(coverUri, id);
      }

      const { error } = await supabase
        .from('events')
        .update({
          title: trimmedTitle,
          description: trimmedDescription,
          address_name: trimmedAddress,
          ...(geocoded ? { latitude, longitude } : {}),
          privacy,
          cover_image_url: finalCoverUrl,
        })
        .eq('id', id);

      if (error) throw error;

      // Convert REQUESTED → GOING when switching EXCLUSIVE → PUBLIC
      if (event?.privacy === 'EXCLUSIVE' && privacy === 'PUBLIC') {
        await supabase
          .from('event_rsvps')
          .update({ status: 'GOING' })
          .eq('event_id', id)
          .eq('status', 'REQUESTED');
      }

      // Sync event niches: delete all then re-insert
      await supabase.from('event_niches').delete().eq('event_id', id);
      if (selectedNicheIds.size > 0) {
        const { error: nicheError } = await supabase.from('event_niches').insert(
          [...selectedNicheIds].map(nicheId => ({ event_id: id, niche_id: nicheId }))
        );
        if (nicheError) throw nicheError;
      }

      qc.invalidateQueries({ queryKey: ['events'] });
      qc.invalidateQueries({ queryKey: ['event', id] });
      qc.invalidateQueries({ queryKey: ['hostedEvents'] });
      qc.invalidateQueries({ queryKey: ['eventRequestors'] });
      router.back();
    } catch (err) {
      console.error('[event-edit] save error:', err);
      Alert.alert('Error', 'We encountered an error trying to save your changes. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  function handleCancelEvent() {
    if (!id || !event) return;
    Alert.alert(
      'Cancel Event',
      'Are you sure you want to cancel this event? This cannot be undone.',
      [
        { text: 'No', style: 'cancel' },
        { text: 'Yes, Cancel Event', style: 'destructive', onPress: () => confirmCancel() },
      ],
    );
  }

  async function confirmCancel() {
    if (!id) return;
    try {
      const { error } = await supabase
        .from('events')
        .update({ status: 'CANCELLED' })
        .eq('id', id);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ['events'] });
      qc.invalidateQueries({ queryKey: ['event', id] });
      qc.invalidateQueries({ queryKey: ['hostedEvents'] });
      router.back();
    } catch (err) {
      console.error('[event-edit] cancel error:', err);
      Alert.alert('Error', 'We encountered an error trying to cancel your event. Please try again.');
    }
  }

  if (isLoading && !event) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  if (!event) {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle-outline" size={32} color={Colors.textTertiary} />
        <Text style={styles.errorText}>Event not found.</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backLink}>
          <Text style={styles.backLinkText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Nav Header */}
      <View style={styles.navHeader}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="close" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Edit Event</Text>
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator size="small" color={Colors.textInverse} />
          ) : (
            <Text style={styles.saveButtonText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Cover Image */}
        <TouchableOpacity style={styles.coverPicker} onPress={pickImage} activeOpacity={0.8}>
          {coverUri ? (
            <>
              <Image source={{ uri: coverUri }} style={styles.coverImage} />
              <View style={styles.coverEditOverlay}>
                <Ionicons name="camera-outline" size={20} color={Colors.textPrimary} />
                <Text style={styles.coverEditText}>Change Photo</Text>
              </View>
            </>
          ) : (
            <View style={styles.coverPlaceholder}>
              <Ionicons name="image-outline" size={32} color={Colors.textTertiary} />
              <Text style={styles.coverPlaceholderText}>Add Cover Photo</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Event Type (read-only) */}
        <View style={styles.section}>
          <Text style={styles.label}>Event Type</Text>
          <View style={styles.typeRow}>
            <EventTypeBadge eventType={event.event_type} />
            <Text style={styles.typeNote}>Type cannot be changed after creation</Text>
          </View>
        </View>

        {/* Niches */}
        <View style={styles.section}>
          <Text style={styles.label}>Niches</Text>
          <View style={styles.nicheGrid}>
            {niches.map(niche => {
              const active = selectedNicheIds.has(niche.id);
              const color = niche.color ?? Colors.primary;
              return (
                <TouchableOpacity
                  key={niche.id}
                  style={[
                    styles.nicheChip,
                    active && {
                      borderColor: color,
                      backgroundColor: color + '25',
                      shadowColor: color,
                      shadowOpacity: 0.5,
                      shadowRadius: 10,
                      shadowOffset: { width: 0, height: 0 },
                      elevation: 5,
                    },
                  ]}
                  onPress={() => {
                    setSelectedNicheIds(prev => {
                      const next = new Set(prev);
                      if (next.has(niche.id)) next.delete(niche.id);
                      else next.add(niche.id);
                      return next;
                    });
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.nicheChipText, active && { color, fontWeight: Typography.weight.medium }]}>
                    {niche.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Schedule (read-only display) */}
        <View style={styles.section}>
          <Text style={styles.label}>Date & Time</Text>
          <View style={styles.scheduleDisplay}>
            <Ionicons name="calendar-outline" size={16} color={Colors.textTertiary} />
            <Text style={styles.scheduleText}>
              {formatDayDate(event.start_time)} · {formatTimeRange(event.start_time, event.end_time)}
            </Text>
          </View>
          <Text style={styles.scheduleNote}>
            Reschedule via the full edit flow (coming soon)
          </Text>
        </View>

        {/* Title */}
        <View style={styles.section}>
          <Text style={styles.label}>Title</Text>
          <TextInput
            style={styles.textInput}
            value={title}
            onChangeText={setTitle}
            placeholder="Event title"
            placeholderTextColor={Colors.textTertiary}
            maxLength={100}
          />
        </View>

        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.textInput, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Describe your event…"
            placeholderTextColor={Colors.textTertiary}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
            maxLength={2000}
          />
        </View>

        {/* Location */}
        <View style={styles.section}>
          <Text style={styles.label}>Location</Text>
          <View style={styles.locationRow}>
            <TextInput
              style={[styles.textInput, styles.locationInput]}
              value={addressName}
              onChangeText={(t) => {
                setAddressName(t);
                setGeocoded(false);
                setLocationError(null);
              }}
              onEndEditing={(e) => geocodeAddress(e.nativeEvent.text)}
              placeholder="Address or venue name"
              placeholderTextColor={Colors.textTertiary}
              autoCorrect={false}
              returnKeyType="done"
              maxLength={200}
            />
            {geocoding ? (
              <ActivityIndicator style={styles.locationStatus} color={Colors.textTertiary} size="small" />
            ) : geocoded ? (
              <Ionicons name="checkmark-circle" style={styles.locationStatus} size={20} color="#4CAF50" />
            ) : null}
          </View>
          {locationError && (
            <Text style={styles.locationErrorText}>{locationError}</Text>
          )}
          {geocoded && !locationError && (
            <LocationMapPreview latitude={latitude} longitude={longitude} />
          )}
        </View>

        {/* Privacy */}
        <View style={styles.section}>
          <Text style={styles.label}>Privacy</Text>
          <View style={styles.privacyRow}>
            <View style={styles.privacyInfo}>
              <Ionicons
                name={privacy === 'EXCLUSIVE' ? 'lock-closed-outline' : 'earth-outline'}
                size={18}
                color={privacy === 'EXCLUSIVE' ? Colors.primary : Colors.textSecondary}
              />
              <View>
                <Text style={styles.privacyLabel}>
                  {privacy === 'EXCLUSIVE' ? 'Exclusive' : 'Public'}
                </Text>
                <Text style={styles.privacyDesc}>
                  {privacy === 'EXCLUSIVE'
                    ? 'Attendees must request access'
                    : 'Anyone can RSVP'}
                </Text>
              </View>
            </View>
            <Switch
              value={privacy === 'EXCLUSIVE'}
              onValueChange={val => setPrivacy(val ? 'EXCLUSIVE' : 'PUBLIC')}
              trackColor={{ false: Colors.border, true: Colors.primary + '80' }}
              thumbColor={privacy === 'EXCLUSIVE' ? Colors.primary : Colors.textTertiary}
            />
          </View>
        </View>

        {/* Cancel Event */}
        <View style={styles.dangerSection}>
          <Text style={styles.dangerSectionTitle}>Danger Zone</Text>
          <TouchableOpacity
            style={styles.cancelEventButton}
            onPress={handleCancelEvent}
            activeOpacity={0.8}
          >
            <Ionicons name="close-circle-outline" size={18} color={Colors.cancelled} />
            <Text style={styles.cancelEventText}>Cancel This Event</Text>
          </TouchableOpacity>
          <Text style={styles.cancelEventNote}>
            Cancelling will mark the event as cancelled for all attendees.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: Spacing.xl * 2 },
  centered: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  errorText: { color: Colors.textSecondary, fontSize: Typography.size.base },
  backLink: { marginTop: Spacing.sm },
  backLinkText: { color: Colors.primary, fontSize: Typography.size.base },

  // Nav header
  navHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.sm,
  },
  backButton: { width: 40, height: 40, justifyContent: 'center' },
  navTitle: {
    flex: 1,
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.semibold,
    color: Colors.textPrimary,
  },
  saveButton: {
    paddingVertical: 8,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    minWidth: 60,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: Typography.size.base,
    fontWeight: Typography.weight.bold,
    color: Colors.textInverse,
  },

  // Cover image
  coverPicker: {
    height: 200,
    backgroundColor: Colors.surfaceElevated,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    overflow: 'hidden',
  },
  coverImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  coverEditOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#00000060',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  coverEditText: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.medium,
    color: Colors.textPrimary,
  },
  coverPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  coverPlaceholderText: {
    fontSize: Typography.size.sm,
    color: Colors.textTertiary,
  },

  // Form sections
  section: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    gap: Spacing.sm,
  },
  label: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.semibold,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  // Event type row
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  typeNote: {
    fontSize: Typography.size.xs,
    color: Colors.textTertiary,
    fontStyle: 'italic',
  },

  // Schedule display
  scheduleDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  scheduleText: {
    fontSize: Typography.size.base,
    color: Colors.textSecondary,
  },
  scheduleNote: {
    fontSize: Typography.size.xs,
    color: Colors.textTertiary,
    fontStyle: 'italic',
  },

  // Text inputs
  textInput: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    fontSize: Typography.size.base,
    color: Colors.textPrimary,
  },
  textArea: {
    minHeight: 120,
    paddingTop: Spacing.sm + 2,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  locationInput: { flex: 1 },
  locationStatus: { width: 20 },
  locationErrorText: {
    fontSize: Typography.size.sm,
    color: Colors.cancelled,
    marginTop: Spacing.xs,
  },

  // Privacy toggle
  privacyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
  privacyInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  privacyLabel: {
    fontSize: Typography.size.base,
    fontWeight: Typography.weight.semibold,
    color: Colors.textPrimary,
  },
  privacyDesc: {
    fontSize: Typography.size.xs,
    color: Colors.textTertiary,
    marginTop: 2,
  },

  // Danger zone
  dangerSection: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.xl,
    gap: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.lg,
  },
  dangerSectionTitle: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.semibold,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  cancelEventButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.cancelled + '40',
    backgroundColor: Colors.cancelled + '10',
  },
  cancelEventText: {
    fontSize: Typography.size.base,
    fontWeight: Typography.weight.medium,
    color: Colors.cancelled,
  },
  cancelEventNote: {
    fontSize: Typography.size.xs,
    color: Colors.textTertiary,
    lineHeight: 18,
    textAlign: 'center',
  },

  // Niche chips
  nicheGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  nicheChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.chip,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceElevated,
  },
  nicheChipText: {
    fontSize: Typography.size.sm,
    color: Colors.textSecondary,
  },
});
