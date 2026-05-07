import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  Switch,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { EVENT_TYPES } from "../constants/eventTypes";
import { useNiches } from "../hooks/useNiches";
import { BorderRadius, Colors, Spacing, Typography } from "../constants/theme";
import { useAuth } from "../context/auth";
import { useProfile } from "../hooks/useProfile";
import { supabase } from "../lib/supabase";
import type { EventPrivacy, EventType } from "../types";
import { LocationMapPreview } from "./LocationMapPreview";
import { NicheSelector } from "./NicheSelector";
import { EventTypePickerModal } from "./EventTypePickerModal";
import { DatePickerSheet, fmtDate, fmtTime } from "./DatePickerSheet";
import type { DatePickerTarget } from "./DatePickerSheet";

type AddressSuggestion = {
  id: string;
  place_name: string;
  center: [number, number];
};

function defaultStart() {
  const d = new Date();
  d.setHours(19, 0, 0, 0);
  return d;
}

function defaultEnd() {
  const d = new Date();
  d.setHours(22, 0, 0, 0);
  return d;
}

// ─────────────────────────────────────────────────────────────────────────────

export default function CreateEventForm() {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();
  const { data: profileData } = useProfile(userId);
  const { data: niches = [] } = useNiches();

  // Event form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventType, setEventType] = useState<EventType>("NETWORKING");
  const [privacy, setPrivacy] = useState<EventPrivacy>("PUBLIC");
  const [startDate, setStartDate] = useState<Date>(defaultStart);
  const [endDate, setEndDate] = useState<Date>(defaultEnd);
  const [sameDay, setSameDay] = useState(true);
  const [addressName, setAddressName] = useState("");
  const [latitude, setLatitude] = useState(43.6532);
  const [longitude, setLongitude] = useState(-79.3832);
  const [geocoded, setGeocoded] = useState(false);
  const [coverUri, setCoverUri] = useState<string | null>(null);
  const [selectedNicheIds, setSelectedNicheIds] = useState<Set<string>>(
    new Set(),
  );

  // UI state
  const [locationError, setLocationError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);

  // Overlay: 'submitting' | 'success' | 'error' | null
  const [overlayState, setOverlayState] = useState<
    "submitting" | "success" | "error" | null
  >(null);
  const saving = overlayState === "submitting";
  const [geocoding, setGeocoding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<DatePickerTarget>("date");

  const pickerValue =
    pickerTarget === "date" || pickerTarget === "start-time"
      ? startDate
      : endDate;

  const pickerMode =
    pickerTarget === "date" || pickerTarget === "end-date" ? "date" : "time";

  const pickerTitle =
    pickerTarget === "date"
      ? "Start Date"
      : pickerTarget === "end-date"
        ? "End Date"
        : pickerTarget === "start-time"
          ? "Start Time"
          : "End Time";

  function openPicker(target: DatePickerTarget) {
    setPickerTarget(target);
    setShowDatePicker(true);
  }

  function toggleNiche(id: string) {
    setSelectedNicheIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handlePickerConfirm(selected: Date) {
    if (pickerTarget === "date") {
      const s = new Date(startDate);
      s.setFullYear(
        selected.getFullYear(),
        selected.getMonth(),
        selected.getDate(),
      );
      setStartDate(s);
      if (sameDay) {
        const e = new Date(endDate);
        e.setFullYear(
          selected.getFullYear(),
          selected.getMonth(),
          selected.getDate(),
        );
        setEndDate(e);
      }
    } else if (pickerTarget === "end-date") {
      const e = new Date(endDate);
      e.setFullYear(
        selected.getFullYear(),
        selected.getMonth(),
        selected.getDate(),
      );
      setEndDate(e);
    } else if (pickerTarget === "start-time") {
      const s = new Date(startDate);
      s.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
      setStartDate(s);
    } else {
      const e = new Date(endDate);
      e.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
      setEndDate(e);
    }
  }

  function handleSameDayToggle() {
    if (sameDay) {
      const e = new Date(endDate);
      e.setFullYear(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + 1);
      setEndDate(e);
    } else {
      const e = new Date(endDate);
      e.setFullYear(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
      setEndDate(e);
    }
    setSameDay((prev) => !prev);
  }

  async function pickCover() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission denied",
        "Photo library access is needed to add a cover image.",
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images" as ImagePicker.MediaType,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) setCoverUri(result.assets[0].uri);
  }

  useEffect(() => {
    if (geocoded) return;
    if (addressName.trim().length < 3) {
      setSuggestions([]);
      setGeocoding(false);
      return;
    }
    const timer = setTimeout(() => fetchSuggestions(addressName), 300);
    return () => clearTimeout(timer);
  }, [addressName, geocoded]);

  async function fetchSuggestions(text: string) {
    setGeocoding(true);
    try {
      const query = encodeURIComponent(text.trim());
      const token = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json?access_token=${token}&country=ca&limit=5`;
      const res = await fetch(url);
      const data = await res.json();
      setSuggestions(data.features ?? []);
    } catch {
      setSuggestions([]);
    } finally {
      setGeocoding(false);
    }
  }

  function handleSuggestionSelect(feature: AddressSuggestion) {
    const [lng, lat] = feature.center;
    setAddressName(feature.place_name);
    setLatitude(lat);
    setLongitude(lng);
    setGeocoded(true);
    setSuggestions([]);
    setLocationError(null);
  }

  async function uploadCover(uri: string, eventId: string): Promise<string> {
    const response = await fetch(uri);
    const arrayBuffer = await response.arrayBuffer();
    const path = `${eventId}/cover.jpg`;
    const { error: uploadError } = await supabase.storage
      .from("event-covers")
      .upload(path, arrayBuffer, { contentType: "image/jpeg", upsert: true });
    if (uploadError) throw uploadError;
    const { data: urlData } = supabase.storage
      .from("event-covers")
      .getPublicUrl(path);
    return `${urlData.publicUrl}?t=${Date.now()}`;
  }

  function resetForm() {
    setTitle("");
    setDescription("");
    setEventType("NETWORKING");
    setPrivacy("PUBLIC");
    setStartDate(defaultStart());
    setEndDate(defaultEnd());
    setAddressName("");
    setLatitude(43.6532);
    setLongitude(-79.3832);
    setGeocoded(false);
    setSuggestions([]);
    setCoverUri(null);
    setSelectedNicheIds(new Set());
    setLocationError(null);
    setError(null);
  }

  async function handlePublish() {
    setError(null);

    if (!title.trim()) return setError("Event title is required.");
    if (!description.trim()) return setError("Description is required.");
    if (!addressName.trim()) return setError("Venue / address is required.");
    if (endDate <= startDate)
      return setError("End time must be after start time.");

    const profileId = profileData?.profile?.id;
    if (!profileId)
      return setError("Could not load your profile. Please try again.");

    setOverlayState("submitting");
    try {
      const { data: newEvent, error: insertError } = await supabase
        .from("events")
        .insert({
          host_id: profileId,
          title: title.trim(),
          description: description.trim(),
          event_type: eventType,
          privacy,
          start_time: startDate.toISOString(),
          end_time: endDate.toISOString(),
          latitude,
          longitude,
          address_name: addressName.trim(),
          status: "PUBLISHED",
          is_recurring: false,
          recurrence_rule: null,
          recurrence_end_date: null,
          parent_event_id: null,
          cover_image_url: null,
        })
        .select("id")
        .single();

      if (insertError || !newEvent)
        throw insertError ?? new Error("Failed to create event.");

      if (coverUri) {
        try {
          const coverUrl = await uploadCover(coverUri, newEvent.id);
          await supabase
            .from("events")
            .update({ cover_image_url: coverUrl })
            .eq("id", newEvent.id);
        } catch {
          await supabase.from("events").delete().eq("id", newEvent.id);
          throw new Error(
            "Image upload failed. The event was not saved — please try again.",
          );
        }
      }

      // Insert event niches
      if (selectedNicheIds.size > 0) {
        const nicheRows = [...selectedNicheIds].map((nicheId) => ({
          event_id: newEvent.id,
          niche_id: nicheId,
        }));
        const { error: nicheError } = await supabase
          .from("event_niches")
          .insert(nicheRows);
        if (nicheError) throw nicheError;
      }

      queryClient.invalidateQueries({ queryKey: ["events"] });
      setOverlayState("success");
      setTimeout(() => {
        setOverlayState(null);
        resetForm();
        router.replace("/(tabs)");
      }, 2000);
    } catch (e: any) {
      setError(e?.message ?? "Something went wrong. Please try again.");
      setOverlayState("error");
    }
  }

  const selectedTypeLabel =
    EVENT_TYPES.find((t) => t.value === eventType)?.label ?? eventType;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {/* Nav header */}
        <View style={styles.navHeader}>
          <TouchableOpacity
            style={styles.navClose}
            onPress={() => router.back()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.navTitle}>New Event</Text>
          <TouchableOpacity
            style={[styles.publishBtn, saving && styles.publishBtnDisabled]}
            onPress={handlePublish}
            disabled={saving}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator color={Colors.textPrimary} size="small" />
            ) : (
              <Text style={styles.publishBtnText}>Publish</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Event creation form */}
        <>
          {/* Sticky error banner — outside ScrollView so it stays visible */}
          {error && (
            <View style={styles.errorBox}>
              <Ionicons
                name="alert-circle-outline"
                size={16}
                color={Colors.cancelled}
              />
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity
                onPress={() => setError(null)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={16} color={Colors.cancelled} />
              </TouchableOpacity>
            </View>
          )}

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* ── Cover Image ── */}
            <TouchableOpacity
              style={styles.coverPicker}
              onPress={pickCover}
              activeOpacity={0.8}
            >
              {coverUri ? (
                <>
                  <Image
                    source={{ uri: coverUri }}
                    style={StyleSheet.absoluteFill}
                    resizeMode="cover"
                  />
                  <View style={styles.coverOverlay}>
                    <Ionicons name="camera" size={22} color="#fff" />
                    <Text style={styles.coverChangeText}>Change Cover</Text>
                  </View>
                </>
              ) : (
                <>
                  <Ionicons
                    name="image-outline"
                    size={30}
                    color={Colors.textTertiary}
                  />
                  <Text style={styles.coverPlaceholder}>Add Cover Image</Text>
                  <Text style={styles.coverSub}>Optional</Text>
                </>
              )}
            </TouchableOpacity>

            {/* ── Details ── */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Details</Text>

              <View style={styles.field}>
                <Text style={styles.label}>Title</Text>
                <TextInput
                  style={styles.input}
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Event name"
                  placeholderTextColor={Colors.textTertiary}
                  autoCorrect={false}
                  returnKeyType="next"
                  maxLength={100}
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Description</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="What's happening? Who should come?"
                  placeholderTextColor={Colors.textTertiary}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  maxLength={2000}
                />
              </View>
            </View>

            {/* ── Event Info ── */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Event Info</Text>

              <View style={styles.field}>
                <Text style={styles.label}>Type</Text>
                <TouchableOpacity
                  style={styles.selectRow}
                  onPress={() => setShowTypePicker(true)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.selectValue}>{selectedTypeLabel}</Text>
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={Colors.textTertiary}
                  />
                </TouchableOpacity>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Access</Text>
                <View style={styles.privacyToggle}>
                  <TouchableOpacity
                    style={[
                      styles.privacyOption,
                      privacy === "PUBLIC" && styles.privacyOptionActive,
                    ]}
                    onPress={() => setPrivacy("PUBLIC")}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name="globe-outline"
                      size={15}
                      color={
                        privacy === "PUBLIC"
                          ? Colors.textInverse
                          : Colors.textSecondary
                      }
                    />
                    <Text
                      style={[
                        styles.privacyText,
                        privacy === "PUBLIC" && styles.privacyTextActive,
                      ]}
                    >
                      Public
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.privacyOption,
                      privacy === "EXCLUSIVE" && styles.privacyOptionActive,
                    ]}
                    onPress={() => setPrivacy("EXCLUSIVE")}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name="lock-closed-outline"
                      size={15}
                      color={
                        privacy === "EXCLUSIVE"
                          ? Colors.textInverse
                          : Colors.textSecondary
                      }
                    />
                    <Text
                      style={[
                        styles.privacyText,
                        privacy === "EXCLUSIVE" && styles.privacyTextActive,
                      ]}
                    >
                      Exclusive
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* ── Niches ── */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Niches</Text>
              <Text style={styles.nicheHint}>Tag what your event is about</Text>
              <NicheSelector
                niches={niches}
                selectedIds={selectedNicheIds}
                onToggle={toggleNiche}
              />
            </View>

            {/* ── Schedule ── */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Schedule</Text>

              <TouchableOpacity
                style={styles.scheduleRow}
                onPress={() => openPicker("date")}
                activeOpacity={0.8}
              >
                <View style={styles.scheduleRowLeft}>
                  <Ionicons
                    name="calendar-outline"
                    size={18}
                    color={Colors.textTertiary}
                  />
                  <Text style={styles.scheduleLabel}>Start Date</Text>
                </View>
                <View style={styles.scheduleRowRight}>
                  <Text style={styles.scheduleValue}>{fmtDate(startDate)}</Text>
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={Colors.textTertiary}
                  />
                </View>
              </TouchableOpacity>

              {!sameDay && (
                <TouchableOpacity
                  style={styles.scheduleRow}
                  onPress={() => openPicker("end-date")}
                  activeOpacity={0.8}
                >
                  <View style={styles.scheduleRowLeft}>
                    <Ionicons
                      name="calendar-outline"
                      size={18}
                      color={Colors.textTertiary}
                    />
                    <Text style={styles.scheduleLabel}>End Date</Text>
                  </View>
                  <View style={styles.scheduleRowRight}>
                    <Text style={styles.scheduleValue}>{fmtDate(endDate)}</Text>
                    <Ionicons
                      name="chevron-forward"
                      size={16}
                      color={Colors.textTertiary}
                    />
                  </View>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.scheduleRow}
                onPress={() => openPicker("start-time")}
                activeOpacity={0.8}
              >
                <View style={styles.scheduleRowLeft}>
                  <Ionicons
                    name="time-outline"
                    size={18}
                    color={Colors.textTertiary}
                  />
                  <Text style={styles.scheduleLabel}>Start Time</Text>
                </View>
                <View style={styles.scheduleRowRight}>
                  <Text style={styles.scheduleValue}>{fmtTime(startDate)}</Text>
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={Colors.textTertiary}
                  />
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.scheduleRow}
                onPress={() => openPicker("end-time")}
                activeOpacity={0.8}
              >
                <View style={styles.scheduleRowLeft}>
                  <Ionicons
                    name="time-outline"
                    size={18}
                    color={Colors.textTertiary}
                  />
                  <Text style={styles.scheduleLabel}>End Time</Text>
                </View>
                <View style={styles.scheduleRowRight}>
                  <Text style={styles.scheduleValue}>{fmtTime(endDate)}</Text>
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={Colors.textTertiary}
                  />
                </View>
              </TouchableOpacity>

              <View style={styles.scheduleRow}>
                <View style={styles.scheduleRowLeft}>
                  <Ionicons
                    name="moon-outline"
                    size={18}
                    color={Colors.textTertiary}
                  />
                  <Text style={styles.scheduleLabel}>Same day</Text>
                </View>
                <Switch
                  value={sameDay}
                  onValueChange={handleSameDayToggle}
                  trackColor={{ false: Colors.textTertiary, true: Colors.primary }}
                  thumbColor="#fff"
                />
              </View>
            </View>

            {/* ── Location ── */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Location</Text>
              <View style={styles.field}>
                <Text style={styles.label}>Venue / Address</Text>
                <View style={styles.locationRow}>
                  <TextInput
                    style={[styles.input, styles.locationInput]}
                    value={addressName}
                    onChangeText={(t) => {
                      setAddressName(t);
                      setGeocoded(false);
                    }}
                    placeholder="e.g. Distillery District, 55 Mill St"
                    placeholderTextColor={Colors.textTertiary}
                    autoCorrect={false}
                    returnKeyType="done"
                    maxLength={200}
                  />
                  {geocoding ? (
                    <ActivityIndicator
                      style={styles.locationStatus}
                      color={Colors.textTertiary}
                      size="small"
                    />
                  ) : geocoded ? (
                    <Ionicons
                      name="checkmark-circle"
                      style={styles.locationStatus}
                      size={20}
                      color={Colors.going}
                    />
                  ) : null}
                </View>
                {suggestions.length > 0 && !geocoded && (
                  <View style={styles.suggestionsContainer}>
                    {suggestions.map((feature, index) => (
                      <TouchableOpacity
                        key={feature.id}
                        style={[
                          styles.suggestionItem,
                          index === suggestions.length - 1 && styles.suggestionItemLast,
                        ]}
                        onPress={() => handleSuggestionSelect(feature)}
                      >
                        <Ionicons name="location-outline" size={14} color={Colors.textTertiary} />
                        <Text style={styles.suggestionText} numberOfLines={2}>
                          {feature.place_name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                {locationError && (
                  <Text style={styles.locationErrorText}>{locationError}</Text>
                )}
                {geocoded && !locationError && (
                  <LocationMapPreview
                    latitude={latitude}
                    longitude={longitude}
                  />
                )}
              </View>
            </View>
          </ScrollView>
        </>
      </KeyboardAvoidingView>

      {/* ── Event Type Picker Modal ── */}
      <EventTypePickerModal
        visible={showTypePicker}
        onClose={() => setShowTypePicker(false)}
        eventType={eventType}
        onSelect={(v) => { setEventType(v); setShowTypePicker(false); }}
      />

      {/* ── Date / Time Picker (pure JS — works in Expo Go) ── */}
      <DatePickerSheet
        visible={showDatePicker}
        title={pickerTitle}
        mode={pickerMode}
        value={pickerValue}
        onDismiss={() => setShowDatePicker(false)}
        onConfirm={handlePickerConfirm}
      />

      {/* ── Full-screen overlay ── */}
      {overlayState !== null && (
        <View style={styles.overlay}>
          {overlayState === "submitting" && (
            <ActivityIndicator size="large" color={Colors.primary} />
          )}

          {overlayState === "success" && (
            <View style={styles.overlayToast}>
              <Ionicons
                name="checkmark-circle"
                size={28}
                color={Colors.going}
              />
              <Text style={styles.overlayToastText}>Event published!</Text>
            </View>
          )}

          {overlayState === "error" && (
            <View style={styles.overlayError}>
              <Ionicons
                name="alert-circle"
                size={36}
                color={Colors.cancelled}
              />
              <Text style={styles.overlayErrorTitle}>Something went wrong</Text>
              <Text style={styles.overlayErrorSub}>
                {error ?? "Please try again."}
              </Text>
              <TouchableOpacity
                style={styles.overlayDismissBtn}
                onPress={() => setOverlayState(null)}
                activeOpacity={0.8}
              >
                <Text style={styles.overlayDismissBtnText}>Dismiss</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: Spacing.xl * 2 },

  // Nav header
  navHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  navClose: {
    width: 72,
    alignItems: "flex-start",
  },
  navTitle: {
    flex: 1,
    fontSize: Typography.size.lg,
    fontWeight: Typography.weight.bold,
    color: Colors.textPrimary,
    textAlign: "center",
  },
  publishBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    minWidth: 72,
    alignItems: "center",
  },
  publishBtnDisabled: { opacity: 0.6 },
  publishBtnText: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.semibold,
    color: Colors.textPrimary,
  },

  // Error
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    backgroundColor: "#1A0A0A",
    borderWidth: 1,
    borderColor: "#4A1A1A",
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
  },
  errorText: {
    flex: 1,
    fontSize: Typography.size.sm,
    color: Colors.cancelled,
  },

  // Cover image picker
  coverPicker: {
    height: 180,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    overflow: "hidden",
  },
  coverOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
  },
  coverChangeText: {
    fontSize: Typography.size.sm,
    color: "#fff",
    fontWeight: Typography.weight.medium,
  },
  coverPlaceholder: {
    fontSize: Typography.size.base,
    fontWeight: Typography.weight.medium,
    color: Colors.textSecondary,
  },
  coverSub: {
    fontSize: Typography.size.xs,
    color: Colors.textTertiary,
  },

  // Sections
  section: {
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    gap: Spacing.md,
  },
  sectionTitle: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.semibold,
    color: Colors.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  field: { gap: Spacing.xs },
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
  textArea: {
    minHeight: 100,
    paddingTop: 14,
  },

  // Type select row
  selectRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
  },
  selectValue: {
    fontSize: Typography.size.base,
    color: Colors.textPrimary,
  },

  // Privacy toggle
  privacyToggle: {
    flexDirection: "row",
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 3,
    gap: 2,
  },
  privacyOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: BorderRadius.sm,
  },
  privacyOptionActive: {
    backgroundColor: Colors.primary,
  },
  privacyText: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.medium,
    color: Colors.textSecondary,
  },
  privacyTextActive: {
    color: Colors.textInverse,
    fontWeight: Typography.weight.semibold,
  },

  // Schedule rows
  scheduleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
  },

  scheduleRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  scheduleRowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  scheduleLabel: {
    fontSize: Typography.size.base,
    color: Colors.textSecondary,
  },
  scheduleValue: {
    fontSize: Typography.size.base,
    color: Colors.textPrimary,
    fontWeight: Typography.weight.medium,
  },

  // Location
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  locationInput: { flex: 1 },
  locationStatus: { width: 20 },
  locationErrorText: {
    fontSize: Typography.size.sm,
    color: Colors.cancelled,
    marginTop: Spacing.xs,
  },
  suggestionsContainer: {
    marginTop: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceElevated,
    overflow: "hidden",
  },
  suggestionItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  suggestionItemLast: {
    borderBottomWidth: 0,
  },
  suggestionText: {
    flex: 1,
    fontSize: Typography.size.sm,
    color: Colors.textPrimary,
  },

  // ── Full-screen overlay ──
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.82)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
  },
  overlayToast: {
    alignItems: "center",
    gap: Spacing.sm,
  },
  overlayToastText: {
    fontSize: Typography.size.lg,
    fontWeight: Typography.weight.bold,
    color: "#FFFFFF",
  },
  overlayError: {
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
  },
  overlayErrorTitle: {
    fontSize: Typography.size.lg,
    fontWeight: Typography.weight.bold,
    color: "#FFFFFF",
    textAlign: "center",
  },
  overlayErrorSub: {
    fontSize: Typography.size.base,
    color: "rgba(255,255,255,0.65)",
    textAlign: "center",
    lineHeight: 22,
  },
  overlayDismissBtn: {
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  overlayDismissBtnText: {
    fontSize: Typography.size.base,
    fontWeight: Typography.weight.medium,
    color: "#FFFFFF",
  },

  // Niche chips
  nicheHint: {
    fontSize: Typography.size.sm,
    color: Colors.textTertiary,
    marginTop: -Spacing.xs,
  },
});
