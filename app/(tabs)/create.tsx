import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { LocationMapPreview } from "../../src/components/LocationMapPreview";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  BorderRadius,
  Colors,
  Spacing,
  Typography,
} from "../../src/constants/theme";
import { useAuth } from "../../src/context/auth";
import { useProfile } from "../../src/hooks/useProfile";
import { supabase } from "../../src/lib/supabase";
import { ALL_NICHES } from "../../src/constants/niches";
import type { EventPrivacy, EventType } from "../../src/types";

const RECURRENCE_OPTIONS: { label: string; rule: string }[] = [
  { label: "Weekly", rule: "WEEKLY" },
  { label: "Biweekly", rule: "BIWEEKLY" },
  { label: "Monthly", rule: "MONTHLY" },
];

const EVENT_TYPES: { value: EventType; label: string }[] = [
  { value: "FASHION_SHOW", label: "Fashion Show" },
  { value: "PERFORMANCE", label: "Performance" },
  { value: "OPEN_MIC", label: "Open Mic" },
  { value: "SCREENING", label: "Screening" },
  { value: "LISTENING_PARTY", label: "Listening Party" },
  { value: "STUDIO_SESSION", label: "Studio Session" },
  { value: "WORKSHOP", label: "Workshop" },
  { value: "MASTERCLASS", label: "Masterclass" },
  { value: "PANEL", label: "Panel" },
  { value: "CRITIQUE_SESSION", label: "Critique" },
  { value: "HACKATHON", label: "Hackathon" },
  { value: "NETWORKING", label: "Networking" },
  { value: "COMMUNITY", label: "Community" },
  { value: "COLLAB_SESSION", label: "Collab Session" },
  { value: "OPEN_CALL", label: "Open Call" },
  { value: "POP_UP", label: "Pop-Up" },
  { value: "MARKET", label: "Market" },
  { value: "LAUNCH_PARTY", label: "Launch Party" },
  { value: "EXHIBITION", label: "Exhibition" },
  { value: "OPEN_STUDIO", label: "Open Studio" },
  { value: "PHOTOSHOOT", label: "Photoshoot" },
  { value: "GROUP_RUN", label: "Group Run" },
  { value: "FITNESS_CLASS", label: "Fitness Class" },
  { value: "RETREAT", label: "Retreat" },
  { value: "GAME_NIGHT", label: "Game Night" },
  { value: "BLOCK_PARTY", label: "Block Party" },
  { value: "COMPETITION", label: "Competition" },
  { value: "CHARITY", label: "Charity" },
  { value: "VIRTUAL_EVENT", label: "Virtual Event" },
  { value: "OTHER", label: "Other" },
];

type DatePickerTarget = "date" | "start-time" | "end-time";

function fmtDate(d: Date) {
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function fmtTime(d: Date) {
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

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

// ── Pure-JS date/time picker bottom sheet ─────────────────────────────────────

// ── Calendar grid (pure JS) ───────────────────────────────────────────────────

function CalendarPicker({
  value,
  onChange,
}: {
  value: Date;
  onChange: (d: Date) => void;
}) {
  const [viewYear, setViewYear] = useState(value.getFullYear());
  const [viewMonth, setViewMonth] = useState(value.getMonth());

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayRaw = new Date(viewYear, viewMonth, 1).getDay(); // 0 = Sun
  const startOffset = (firstDayRaw + 6) % 7; // convert to Mon-first (Sun → 6)
  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const today = new Date();
  const todayDay =
    today.getFullYear() === viewYear && today.getMonth() === viewMonth
      ? today.getDate()
      : -1;
  const selDay =
    value.getFullYear() === viewYear && value.getMonth() === viewMonth
      ? value.getDate()
      : -1;

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString(
    "en-US",
    {
      month: "long",
      year: "numeric",
    },
  );

  function prev() {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else setViewMonth((m) => m - 1);
  }
  function next() {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else setViewMonth((m) => m + 1);
  }
  function select(day: number) {
    const d = new Date(value);
    d.setFullYear(viewYear, viewMonth, day);
    onChange(d);
  }

  return (
    <View style={calStyles.container}>
      <View style={calStyles.monthNav}>
        <TouchableOpacity onPress={prev} style={calStyles.navBtn}>
          <Ionicons name="chevron-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={calStyles.monthLabel}>{monthLabel}</Text>
        <TouchableOpacity onPress={next} style={calStyles.navBtn}>
          <Ionicons
            name="chevron-forward"
            size={22}
            color={Colors.textPrimary}
          />
        </TouchableOpacity>
      </View>

      <View style={calStyles.weekRow}>
        {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => (
          <Text key={d} style={calStyles.weekDay}>
            {d}
          </Text>
        ))}
      </View>

      <View style={calStyles.grid}>
        {cells.map((day, idx) => {
          if (day === null)
            return <View key={`e${idx}`} style={calStyles.cell} />;
          const isSel = day === selDay;
          const isToday = day === todayDay;
          return (
            <TouchableOpacity
              key={day}
              style={calStyles.cell}
              onPress={() => select(day)}
              activeOpacity={0.7}
            >
              <View
                style={[
                  calStyles.dayCircle,
                  isSel && calStyles.selectedCircle,
                  isToday && !isSel && calStyles.todayCircle,
                ]}
              >
                <Text
                  style={[
                    calStyles.dayText,
                    isToday && !isSel && calStyles.todayText,
                    isSel && calStyles.selectedText,
                  ]}
                >
                  {day}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const calStyles = StyleSheet.create({
  container: { paddingHorizontal: Spacing.xs, paddingBottom: Spacing.md },
  monthNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  navBtn: { padding: Spacing.sm },
  monthLabel: {
    fontSize: Typography.size.base,
    fontWeight: Typography.weight.semibold,
    color: Colors.textPrimary,
  },
  weekRow: { flexDirection: "row", marginBottom: 4 },
  weekDay: {
    flex: 1,
    textAlign: "center",
    fontSize: Typography.size.xs,
    color: Colors.textTertiary,
    fontWeight: Typography.weight.medium,
    paddingVertical: 4,
  },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: "14.2857%", alignItems: "center", paddingVertical: 3 },
  dayCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  selectedCircle: { backgroundColor: Colors.primary },
  todayCircle: { borderWidth: 1, borderColor: Colors.primary },
  dayText: { fontSize: Typography.size.sm, color: Colors.textPrimary },
  todayText: { color: Colors.primary, fontWeight: Typography.weight.bold },
  selectedText: { color: "#fff", fontWeight: Typography.weight.semibold },
});

// ── Time spinner (pure JS) ────────────────────────────────────────────────────

function TimePicker({
  value,
  onChange,
}: {
  value: Date;
  onChange: (d: Date) => void;
}) {
  function adjustHour(delta: number) {
    const d = new Date(value);
    d.setHours((d.getHours() + delta + 24) % 24);
    onChange(d);
  }
  function adjustMinute(delta: number) {
    const d = new Date(value);
    const snapped = Math.round(d.getMinutes() / 5) * 5;
    let next = snapped + delta;
    if (next < 0) next = 55;
    if (next >= 60) next = 0;
    d.setMinutes(next, 0, 0);
    onChange(d);
  }
  function toggleAMPM() {
    const d = new Date(value);
    d.setHours(d.getHours() < 12 ? d.getHours() + 12 : d.getHours() - 12);
    onChange(d);
  }

  const hour12 = value.getHours() % 12 || 12;
  const minuteStr = String(value.getMinutes()).padStart(2, "0");
  const ampm = value.getHours() < 12 ? "AM" : "PM";

  return (
    <View style={dpStyles.timeRow}>
      <View style={dpStyles.timeUnit}>
        <TouchableOpacity
          onPress={() => adjustHour(-1)}
          style={dpStyles.timeArrow}
        >
          <Ionicons name="chevron-up" size={30} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={dpStyles.timeValue}>
          {String(hour12).padStart(2, "0")}
        </Text>
        <TouchableOpacity
          onPress={() => adjustHour(1)}
          style={dpStyles.timeArrow}
        >
          <Ionicons name="chevron-down" size={30} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>
      <Text style={dpStyles.colon}>:</Text>
      <View style={dpStyles.timeUnit}>
        <TouchableOpacity
          onPress={() => adjustMinute(-5)}
          style={dpStyles.timeArrow}
        >
          <Ionicons name="chevron-up" size={30} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={dpStyles.timeValue}>{minuteStr}</Text>
        <TouchableOpacity
          onPress={() => adjustMinute(5)}
          style={dpStyles.timeArrow}
        >
          <Ionicons name="chevron-down" size={30} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>
      <TouchableOpacity style={dpStyles.ampmBtn} onPress={toggleAMPM}>
        <Text style={dpStyles.ampmTxt}>{ampm}</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Bottom-sheet wrapper ──────────────────────────────────────────────────────

function DatePickerSheet({
  visible,
  title,
  mode,
  value,
  onDismiss,
  onConfirm,
}: {
  visible: boolean;
  title: string;
  mode: "date" | "time";
  value: Date;
  onDismiss: () => void;
  onConfirm: (date: Date) => void;
}) {
  const [local, setLocal] = useState(new Date(value));

  useEffect(() => {
    if (visible) setLocal(new Date(value));
  }, [visible]);

  if (!visible) return null;

  return (
    <View style={[StyleSheet.absoluteFill, { justifyContent: "flex-end" }]}>
      <TouchableOpacity
        style={[StyleSheet.absoluteFill, dpStyles.backdrop]}
        onPress={onDismiss}
        activeOpacity={1}
      />
      <View style={dpStyles.sheet}>
        <View style={dpStyles.header}>
          <Text style={dpStyles.title}>{title}</Text>
          <TouchableOpacity
            onPress={() => {
              onConfirm(local);
              onDismiss();
            }}
            style={dpStyles.doneBtn}
          >
            <Text style={dpStyles.doneTxt}>Done</Text>
          </TouchableOpacity>
        </View>
        {mode === "date" ? (
          <CalendarPicker value={local} onChange={setLocal} />
        ) : (
          <TimePicker value={local} onChange={setLocal} />
        )}
      </View>
    </View>
  );
}

const dpStyles = StyleSheet.create({
  backdrop: { backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: {
    backgroundColor: Colors.surfaceElevated,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingBottom: Spacing.xl,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: {
    fontSize: Typography.size.base,
    fontWeight: Typography.weight.semibold,
    color: Colors.textPrimary,
  },
  doneBtn: { padding: 4 },
  doneTxt: {
    fontSize: Typography.size.base,
    fontWeight: Typography.weight.semibold,
    color: Colors.primary,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.xl,
    gap: Spacing.md,
  },
  timeUnit: { alignItems: "center", width: 72 },
  timeArrow: { padding: Spacing.sm },
  timeValue: {
    fontSize: 42,
    fontWeight: Typography.weight.bold,
    color: Colors.textPrimary,
    width: 72,
    textAlign: "center",
  },
  colon: {
    fontSize: 42,
    fontWeight: Typography.weight.bold,
    color: Colors.textTertiary,
    marginBottom: 4,
  },
  ampmBtn: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginLeft: Spacing.sm,
    alignSelf: "center",
  },
  ampmTxt: {
    fontSize: Typography.size.base,
    fontWeight: Typography.weight.semibold,
    color: Colors.primary,
  },
});

// ─────────────────────────────────────────────────────────────────────────────

export default function CreateScreen() {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();
  const { data: profileData } = useProfile(userId);

  // Event form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventType, setEventType] = useState<EventType>("NETWORKING");
  const [privacy, setPrivacy] = useState<EventPrivacy>("PUBLIC");
  const [startDate, setStartDate] = useState<Date>(defaultStart);
  const [endDate, setEndDate] = useState<Date>(defaultEnd);
  const [addressName, setAddressName] = useState("");
  const [latitude, setLatitude] = useState(43.6532);
  const [longitude, setLongitude] = useState(-79.3832);
  const [geocoded, setGeocoded] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [coverUri, setCoverUri] = useState<string | null>(null);
  const [selectedNicheIds, setSelectedNicheIds] = useState<Set<string>>(new Set());

  // UI state
  const [locationError, setLocationError] = useState<string | null>(null);
  const [recurrenceRule, setRecurrenceRule] = useState("");
  const [recurrenceEndDate, setRecurrenceEndDate] = useState<Date | null>(null);
  const [showRecurrenceEndPicker, setShowRecurrenceEndPicker] = useState(false);
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
    pickerTarget === "date"
      ? startDate
      : pickerTarget === "start-time"
        ? startDate
        : endDate;

  const pickerMode = pickerTarget === "date" ? "date" : "time";

  const pickerTitle =
    pickerTarget === "date"
      ? "Select Date"
      : pickerTarget === "start-time"
        ? "Start Time"
        : "End Time";

  function openPicker(target: DatePickerTarget) {
    setPickerTarget(target);
    setShowDatePicker(true);
  }

  function toggleNiche(id: string) {
    setSelectedNicheIds(prev => {
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
      mediaTypes: 'images' as ImagePicker.MediaType,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) setCoverUri(result.assets[0].uri);
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
        setLocationError(
          "Location not found. Try a more specific address (e.g. 55 Mill St, Toronto).",
        );
      }
    } catch {
      setLocationError("Could not look up this address. Please try again.");
    } finally {
      setGeocoding(false);
    }
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
    setIsRecurring(false);
    setCoverUri(null);
    setSelectedNicheIds(new Set());
    setLocationError(null);
    setRecurrenceRule("");
    setRecurrenceEndDate(null);
    setError(null);
  }

  async function handlePublish() {
    setError(null);

    if (!title.trim()) return setError("Event title is required.");
    if (!description.trim()) return setError("Description is required.");
    if (!addressName.trim()) return setError("Venue / address is required.");
    if (endDate <= startDate)
      return setError("End time must be after start time.");
    if (isRecurring && !recurrenceRule.trim())
      return setError(
        "Please select a recurrence rule for the recurring event.",
      );

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
          is_recurring: isRecurring,
          recurrence_rule: isRecurring ? recurrenceRule.trim() : null,
          recurrence_end_date:
            isRecurring && recurrenceEndDate
              ? recurrenceEndDate.toISOString().split("T")[0]
              : null,
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
        const nicheRows = [...selectedNicheIds].map(nicheId => ({
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
            <View style={styles.nicheGrid}>
              {ALL_NICHES.map(niche => {
                const active = selectedNicheIds.has(niche.id);
                return (
                  <TouchableOpacity
                    key={niche.id}
                    style={[styles.nicheChip, active && styles.nicheChipActive]}
                    onPress={() => toggleNiche(niche.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.nicheChipText, active && styles.nicheChipTextActive]}>
                      {niche.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
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
                <Text style={styles.scheduleLabel}>Date</Text>
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

            <View style={[styles.scheduleRow, styles.scheduleRowSwitch]}>
              <View style={styles.scheduleRowLeft}>
                <Ionicons
                  name="repeat-outline"
                  size={18}
                  color={Colors.textTertiary}
                />
                <Text style={styles.scheduleLabel}>Recurring Event</Text>
              </View>
              <Switch
                value={isRecurring}
                onValueChange={setIsRecurring}
                trackColor={{ false: Colors.border, true: Colors.primary }}
                thumbColor={Colors.textPrimary}
              />
            </View>

            {isRecurring && (
              <>
                <View style={styles.field}>
                  <View style={styles.recurrenceChips}>
                    {RECURRENCE_OPTIONS.map(({ label, rule }) => (
                      <TouchableOpacity
                        key={rule}
                        style={[
                          styles.recurrenceChip,
                          recurrenceRule === rule &&
                            styles.recurrenceChipActive,
                        ]}
                        onPress={() => setRecurrenceRule(rule)}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.recurrenceChipText,
                            recurrenceRule === rule &&
                              styles.recurrenceChipTextActive,
                          ]}
                        >
                          {label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.scheduleRow}
                  onPress={() => setShowRecurrenceEndPicker(true)}
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
                    <Text
                      style={[
                        styles.scheduleValue,
                        !recurrenceEndDate && { color: Colors.textTertiary },
                      ]}
                    >
                      {recurrenceEndDate
                        ? fmtDate(recurrenceEndDate)
                        : "Optional"}
                    </Text>
                    {recurrenceEndDate ? (
                      <TouchableOpacity
                        onPress={() => setRecurrenceEndDate(null)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons
                          name="close-circle"
                          size={18}
                          color={Colors.textTertiary}
                        />
                      </TouchableOpacity>
                    ) : (
                      <Ionicons
                        name="chevron-forward"
                        size={16}
                        color={Colors.textTertiary}
                      />
                    )}
                  </View>
                </TouchableOpacity>
              </>
            )}
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
                    setLocationError(null);
                  }}
                  onEndEditing={(e) => geocodeAddress(e.nativeEvent.text)}
                  placeholder="e.g. Distillery District, 55 Mill St"
                  placeholderTextColor={Colors.textTertiary}
                  autoCorrect={false}
                  returnKeyType="done"
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
              {locationError && (
                <Text style={styles.locationErrorText}>{locationError}</Text>
              )}
              {geocoded && !locationError && (
                <LocationMapPreview latitude={latitude} longitude={longitude} />
              )}
            </View>
          </View>
        </ScrollView>
        </>
      </KeyboardAvoidingView>

      {/* ── Event Type Picker Modal ── */}
      <Modal
        visible={showTypePicker}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalSafeArea}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Event Type</Text>
            <TouchableOpacity
              onPress={() => setShowTypePicker(false)}
              style={styles.modalDoneBtn}
            >
              <Text style={styles.modalDoneText}>Done</Text>
            </TouchableOpacity>
          </View>
          <ScrollView
            contentContainerStyle={styles.typeGrid}
            showsVerticalScrollIndicator={false}
          >
            {EVENT_TYPES.map(({ value, label }) => (
              <TouchableOpacity
                key={value}
                style={[
                  styles.typeChip,
                  eventType === value && styles.typeChipSelected,
                ]}
                onPress={() => {
                  setEventType(value);
                  setShowTypePicker(false);
                }}
                activeOpacity={0.7}
              >
                {eventType === value && (
                  <Ionicons
                    name="checkmark"
                    size={13}
                    color={Colors.primary}
                    style={styles.typeChipCheck}
                  />
                )}
                <Text
                  style={[
                    styles.typeChipText,
                    eventType === value && styles.typeChipTextSelected,
                  ]}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* ── Date / Time Picker (pure JS — works in Expo Go) ── */}
      <DatePickerSheet
        visible={showDatePicker}
        title={pickerTitle}
        mode={pickerMode}
        value={pickerValue}
        onDismiss={() => setShowDatePicker(false)}
        onConfirm={handlePickerConfirm}
      />

      {/* ── Recurrence End Date Picker ── */}
      <DatePickerSheet
        visible={showRecurrenceEndPicker}
        title="Recurrence End Date"
        mode="date"
        value={recurrenceEndDate ?? startDate}
        onDismiss={() => setShowRecurrenceEndPicker(false)}
        onConfirm={(d) => setRecurrenceEndDate(d)}
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
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  navTitle: {
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.bold,
    color: Colors.textPrimary,
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
  scheduleRowSwitch: {
    paddingVertical: 10,
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
  recurrenceChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  recurrenceChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.chip,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceElevated,
  },
  recurrenceChipActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + "20",
  },
  recurrenceChipText: {
    fontSize: Typography.size.sm,
    color: Colors.textSecondary,
  },
  recurrenceChipTextActive: {
    color: Colors.primary,
    fontWeight: Typography.weight.medium,
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

  // Event type picker modal
  modalSafeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.bold,
    color: Colors.textPrimary,
  },
  modalDoneBtn: { padding: 4 },
  modalDoneText: {
    fontSize: Typography.size.base,
    fontWeight: Typography.weight.semibold,
    color: Colors.primary,
  },
  typeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  typeChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.chip,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceElevated,
  },
  typeChipSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + "20",
  },
  typeChipCheck: { marginRight: 4 },
  typeChipText: {
    fontSize: Typography.size.sm,
    color: Colors.textSecondary,
  },
  typeChipTextSelected: {
    color: Colors.primary,
    fontWeight: Typography.weight.medium,
  },

  // Niche chips
  nicheHint: {
    fontSize: Typography.size.sm,
    color: Colors.textTertiary,
    marginTop: -Spacing.xs,
  },
  nicheGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
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
  nicheChipActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + "20",
  },
  nicheChipText: {
    fontSize: Typography.size.sm,
    color: Colors.textSecondary,
  },
  nicheChipTextActive: {
    color: Colors.primary,
    fontWeight: Typography.weight.medium,
  },

});
