import { z } from "zod";

/**
 * Shared utility to determine whether a store is currently open based on its
 * weekly schedule. Validates inputs (days + HH:mm times) with zod and degrades
 * gracefully when the schedule is missing/malformed so callers can fall back
 * to the manual `is_open` flag.
 */

export type WeekDay = "Dom" | "Seg" | "Ter" | "Qua" | "Qui" | "Sex" | "Sab";

export const WEEK_DAYS: readonly WeekDay[] = [
  "Dom",
  "Seg",
  "Ter",
  "Qua",
  "Qui",
  "Sex",
  "Sab",
] as const;

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

const scheduleEntrySchema = z.object({
  day: z.enum(["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"]),
  active: z.boolean().optional().default(true),
  start: z.string().regex(timeRegex, "Horário inválido (HH:mm)").optional(),
  end: z.string().regex(timeRegex, "Horário inválido (HH:mm)").optional(),
});

export type ScheduleEntry = z.infer<typeof scheduleEntrySchema>;

const scheduleSchema = z.array(scheduleEntrySchema);

export type BusinessHoursInput =
  | string
  | ScheduleEntry[]
  | null
  | undefined;

function toMinutes(value: string | undefined, fallback: number): number {
  if (!value || !timeRegex.test(value)) return fallback;
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Returns the IANA timezone the schedule should be evaluated in.
 * Order: explicit override → browser/user timezone → São Paulo fallback.
 */
export function resolveTimezone(explicit?: string | null): string {
  if (explicit && typeof explicit === "string") return explicit;
  return "America/Cuiaba";
}

/**
 * Extracts weekday/hour/minute in the given timezone using Intl, so the
 * comparison never relies on the browser's local offset. This keeps Home and
 * StoreDetail in sync regardless of where the user (or server) is located.
 */
function getZonedParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    hourCycle: "h23",
  });
  const parts = formatter.formatToParts(date);
  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "";
  const weekdayMap: Record<string, WeekDay> = {
    Sun: "Dom",
    Mon: "Seg",
    Tue: "Ter",
    Wed: "Qua",
    Thu: "Qui",
    Fri: "Sex",
    Sat: "Sab",
  };
  const hour = Number(get("hour")) || 0;
  const minute = Number(get("minute")) || 0;
  return {
    day: weekdayMap[get("weekday")] ?? "Dom",
    minutes: hour * 60 + minute,
  };
}

/**
 * Parses and validates a business-hours payload. Accepts either a JSON string
 * or an already-parsed array. Returns `null` when the payload is absent or
 * cannot be safely interpreted.
 */
export function parseBusinessHours(
  input: BusinessHoursInput
): ScheduleEntry[] | null {
  if (input == null) return null;
  try {
    const raw =
      typeof input === "string"
        ? input.trim().startsWith("[")
          ? JSON.parse(input)
          : null
        : input;
    if (!raw) return null;
    const result = scheduleSchema.safeParse(raw);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

/**
 * Returns true when the current time falls inside the configured schedule for
 * today. When the schedule is missing/invalid, returns `true` so the caller's
 * manual `is_open` flag remains the source of truth.
 */
export function isStoreOpenBySchedule(
  input: BusinessHoursInput,
  now: Date = new Date(),
  timeZone?: string | null
): boolean {
  const schedule = parseBusinessHours(input);
  if (!schedule) return false; // Se o cronograma estiver quebrado, assume fechada por segurança
  const tz = resolveTimezone(timeZone);
  const { day, minutes: currentMinutes } = getZonedParts(now, tz);
  const entry = schedule.find((d) => d.day === day);
  if (!entry || entry.active === false) return false;
  const startMinutes = toMinutes(entry.start, 0);
  const endMinutes = toMinutes(entry.end, 23 * 60 + 59);

  return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
}

/**
 * Shared helpers so every screen renders the same status/prep-time copy.
 */
export type StoreStatusInput = {
  is_open?: boolean | null;
  active?: boolean | null;
  business_hours?: BusinessHoursInput;
  timezone?: string | null;
};

export function isStoreOpenNow(company: StoreStatusInput): boolean {
  return (
    company.is_open === true &&
    company.active !== false &&
    isStoreOpenBySchedule(company.business_hours, new Date(), company.timezone)
  );
}

export function getStoreStatusLabel(company: StoreStatusInput): string {
  return isStoreOpenNow(company) ? "Aberta agora" : "Fechada";
}

export function getPrepTimeLabel(company: {
  prep_time_min?: number | null;
  prep_time_max?: number | null;
}): string {
  const min = company.prep_time_min ?? 25;
  const max = company.prep_time_max ?? 45;
  return `${min}-${max} min`;
}