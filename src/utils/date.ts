const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

/** "Mar 15" */
export function formatShortDate(iso: string): string {
  const d = new Date(iso);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/** "Sat, Mar 15" */
export function formatDayDate(iso: string): string {
  const d = new Date(iso);
  return `${DAYS[d.getUTCDay()]}, ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/** "7:00 PM" */
export function formatTime(iso: string): string {
  const d = new Date(iso);
  let hours = d.getUTCHours();
  const minutes = d.getUTCMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  const mins = minutes === 0 ? '00' : minutes < 10 ? `0${minutes}` : `${minutes}`;
  return `${hours}:${mins} ${ampm}`;
}

/** "7:00 – 10:00 PM" or "11:00 AM – 1:00 PM" */
export function formatTimeRange(startIso: string, endIso: string): string {
  const s = new Date(startIso);
  const e = new Date(endIso);

  const sHours = s.getUTCHours();
  const eHours = e.getUTCHours();
  const sMins = s.getUTCMinutes();
  const eMins = e.getUTCMinutes();
  const sAmpm = sHours >= 12 ? 'PM' : 'AM';
  const eAmpm = eHours >= 12 ? 'PM' : 'AM';
  const sh = sHours % 12 || 12;
  const eh = eHours % 12 || 12;
  const sm = sMins === 0 ? '00' : sMins < 10 ? `0${sMins}` : `${sMins}`;
  const em = eMins === 0 ? '00' : eMins < 10 ? `0${eMins}` : `${eMins}`;

  if (sAmpm === eAmpm) {
    return `${sh}:${sm} – ${eh}:${em} ${eAmpm}`;
  }
  return `${sh}:${sm} ${sAmpm} – ${eh}:${em} ${eAmpm}`;
}

/** "Sat, Mar 15 · 7:00 PM" */
export function formatEventDateTime(iso: string): string {
  return `${formatDayDate(iso)} · ${formatTime(iso)}`;
}

/** "Every Thursday" | "Monthly · 2nd Sat" | null */
export function formatRecurrenceLabel(rule: string | null): string | null {
  if (!rule) return null;

  const parts: Record<string, string> = {};
  rule.split(';').forEach(part => {
    const [key, val] = part.split('=');
    if (key && val) parts[key] = val;
  });

  const freq = parts['FREQ'];
  const byday = parts['BYDAY'];

  if (freq === 'WEEKLY' && byday) {
    const dayMap: Record<string, string> = {
      MO: 'Monday', TU: 'Tuesday', WE: 'Wednesday', TH: 'Thursday',
      FR: 'Friday', SA: 'Saturday', SU: 'Sunday',
    };
    return `Every ${dayMap[byday] ?? byday}`;
  }

  if (freq === 'MONTHLY' && byday) {
    const match = byday.match(/^(\d)([A-Z]{2})$/);
    if (match) {
      const [, num, day] = match;
      const ordinals: Record<string, string> = { '1': '1st', '2': '2nd', '3': '3rd', '4': '4th' };
      const dayShort: Record<string, string> = {
        MO: 'Mon', TU: 'Tue', WE: 'Wed', TH: 'Thu',
        FR: 'Fri', SA: 'Sat', SU: 'Sun',
      };
      return `Monthly · ${ordinals[num] ?? num} ${dayShort[day] ?? day}`;
    }
    return 'Monthly';
  }

  if (freq === 'DAILY') return 'Daily';
  return null;
}

/** "2h ago" | "just now" | "3d ago" etc. */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const diff = Math.floor((now.getTime() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return formatShortDate(iso);
}

/** "Happening now" | "Today" | "Tomorrow" | "In 3 days" | "Mar 15" */
export function formatRelativeDate(startIso: string, endIso?: string, now: Date = new Date()): string {
  const start = new Date(startIso);

  if (endIso) {
    const end = new Date(endIso);
    if (now >= start && now <= end) return 'Happening now';
  }

  const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const startUTC = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  const diffDays = Math.round((startUTC - todayUTC) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays > 1 && diffDays <= 7) return `In ${diffDays} days`;
  return formatShortDate(startIso);
}