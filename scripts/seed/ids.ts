const PROFILE_ID_BASE = 1000;
const EVENT_ID_BASE = 2000;

export function profileIdFromMock(mockId: string): number {
  return PROFILE_ID_BASE + parseInt(mockId.slice(1), 10);
}

export function eventIdFromMock(mockId: string): number {
  return EVENT_ID_BASE + parseInt(mockId.slice(2), 10);
}

export const MOCK_PROFILE_ID_RANGE = { min: PROFILE_ID_BASE + 1, max: PROFILE_ID_BASE + 999 };
export const MOCK_EVENT_ID_RANGE = { min: EVENT_ID_BASE + 1, max: EVENT_ID_BASE + 999 };

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
