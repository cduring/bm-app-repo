const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

/** "Sat, Mar 15" */
export function formatDayDate(iso: string): string {
  const d = new Date(iso);
  return `${DAYS[d.getUTCDay()]}, ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
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

/** "2h ago" | "just now" | "3d ago" etc. */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const diff = Math.floor((now.getTime() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  const d = new Date(iso);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/** Returns { month: "MAR", day: 15, weekday: "SAT" } for use in date pill components */
export function formatDateComponents(iso: string) {
  const MONTHS_UPPER = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  const DAYS_UPPER = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
  const d = new Date(iso);
  return {
    month: MONTHS_UPPER[d.getUTCMonth()],
    day: d.getUTCDate(),
    weekday: DAYS_UPPER[d.getUTCDay()],
  };
}
