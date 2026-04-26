import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { BorderRadius, Colors, Spacing, Typography } from "../constants/theme";

export type DatePickerTarget = "date" | "end-date" | "start-time" | "end-time";

export function fmtDate(d: Date) {
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function fmtTime(d: Date) {
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

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
  const firstDayRaw = new Date(viewYear, viewMonth, 1).getDay();
  const startOffset = (firstDayRaw + 6) % 7;
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

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  function prev() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  }
  function next() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
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
          <Ionicons name="chevron-forward" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>
      <View style={calStyles.weekRow}>
        {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => (
          <Text key={d} style={calStyles.weekDay}>{d}</Text>
        ))}
      </View>
      <View style={calStyles.grid}>
        {cells.map((day, idx) => {
          if (day === null) return <View key={`e${idx}`} style={calStyles.cell} />;
          const isSel = day === selDay;
          const isToday = day === todayDay;
          return (
            <TouchableOpacity key={day} style={calStyles.cell} onPress={() => select(day)} activeOpacity={0.7}>
              <View style={[calStyles.dayCircle, isSel && calStyles.selectedCircle, isToday && !isSel && calStyles.todayCircle]}>
                <Text style={[calStyles.dayText, isToday && !isSel && calStyles.todayText, isSel && calStyles.selectedText]}>
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
  monthNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm },
  navBtn: { padding: Spacing.sm },
  monthLabel: { fontSize: Typography.size.base, fontWeight: Typography.weight.semibold, color: Colors.textPrimary },
  weekRow: { flexDirection: "row", marginBottom: 4 },
  weekDay: { flex: 1, textAlign: "center", fontSize: Typography.size.xs, color: Colors.textTertiary, fontWeight: Typography.weight.medium, paddingVertical: 4 },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: "14.2857%", alignItems: "center", paddingVertical: 3 },
  dayCircle: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  selectedCircle: { backgroundColor: Colors.primary },
  todayCircle: { borderWidth: 1, borderColor: Colors.primary },
  dayText: { fontSize: Typography.size.sm, color: Colors.textPrimary },
  todayText: { color: Colors.primary, fontWeight: Typography.weight.bold },
  selectedText: { color: "#fff", fontWeight: Typography.weight.semibold },
});

function TimePicker({ value, onChange }: { value: Date; onChange: (d: Date) => void }) {
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
        <TouchableOpacity onPress={() => adjustHour(-1)} style={dpStyles.timeArrow}>
          <Ionicons name="chevron-up" size={30} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={dpStyles.timeValue}>{String(hour12).padStart(2, "0")}</Text>
        <TouchableOpacity onPress={() => adjustHour(1)} style={dpStyles.timeArrow}>
          <Ionicons name="chevron-down" size={30} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>
      <Text style={dpStyles.colon}>:</Text>
      <View style={dpStyles.timeUnit}>
        <TouchableOpacity onPress={() => adjustMinute(-5)} style={dpStyles.timeArrow}>
          <Ionicons name="chevron-up" size={30} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={dpStyles.timeValue}>{minuteStr}</Text>
        <TouchableOpacity onPress={() => adjustMinute(5)} style={dpStyles.timeArrow}>
          <Ionicons name="chevron-down" size={30} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>
      <TouchableOpacity style={dpStyles.ampmBtn} onPress={toggleAMPM}>
        <Text style={dpStyles.ampmTxt}>{ampm}</Text>
      </TouchableOpacity>
    </View>
  );
}

export function DatePickerSheet({
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
      <TouchableOpacity style={[StyleSheet.absoluteFill, dpStyles.backdrop]} onPress={onDismiss} activeOpacity={1} />
      <View style={dpStyles.sheet}>
        <View style={dpStyles.header}>
          <Text style={dpStyles.title}>{title}</Text>
          <TouchableOpacity onPress={() => { onConfirm(local); onDismiss(); }} style={dpStyles.doneBtn}>
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
  sheet: { backgroundColor: Colors.surfaceElevated, borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl, paddingBottom: Spacing.xl },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  title: { fontSize: Typography.size.base, fontWeight: Typography.weight.semibold, color: Colors.textPrimary },
  doneBtn: { padding: 4 },
  doneTxt: { fontSize: Typography.size.base, fontWeight: Typography.weight.semibold, color: Colors.primary },
  timeRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: Spacing.xl, gap: Spacing.md },
  timeUnit: { alignItems: "center", width: 72 },
  timeArrow: { padding: Spacing.sm },
  timeValue: { fontSize: 42, fontWeight: Typography.weight.bold, color: Colors.textPrimary, width: 72, textAlign: "center" },
  colon: { fontSize: 42, fontWeight: Typography.weight.bold, color: Colors.textTertiary, marginBottom: 4 },
  ampmBtn: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, marginLeft: Spacing.sm, alignSelf: "center" },
  ampmTxt: { fontSize: Typography.size.base, fontWeight: Typography.weight.semibold, color: Colors.primary },
});
