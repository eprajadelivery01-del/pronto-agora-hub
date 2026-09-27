import { z } from "zod";

/**
 * Shared utility to determine whether a store is currently open based on its
 * weekly schedule with support for MULTIPLE PERIODS PER DAY (e.g. 07:00-14:00 and 17:00-23:00).
 * Validates inputs, degrades gracefully when the schedule is missing/malformed,
 * and maintains 100% backward compatibility with single-period schedules.
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

export const WEEKDAY_FULL_NAMES: Record<WeekDay, string> = {
  Dom: "Domingo",
  Seg: "Segunda-feira",
  Ter: "Terça-feira",
  Qua: "Quarta-feira",
  Qui: "Quinta-feira",
  Sex: "Sexta-feira",
  Sab: "Sábado",
};

export type TimePeriod = {
  start: string;
  end: string;
};

export type ScheduleEntry = {
  day: WeekDay;
  active: boolean;
  start: string;
  end: string;
  periods: TimePeriod[];
};

export type BusinessHoursInput =
  | string
  | any[]
  | Record<string, any>
  | null
  | undefined;

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

function normalizeDayName(d: any): WeekDay | null {
  if (d == null) return null;
  const str = String(d).trim().toLowerCase();
  if (str.startsWith("dom") || str === "sun" || str === "sunday" || str === "0") return "Dom";
  if (str.startsWith("seg") || str === "mon" || str === "monday" || str === "1") return "Seg";
  if (str.startsWith("ter") || str === "tue" || str === "tuesday" || str === "2") return "Ter";
  if (str.startsWith("qua") || str === "wed" || str === "wednesday" || str === "3") return "Qua";
  if (str.startsWith("qui") || str === "thu" || str === "thursday" || str === "4") return "Qui";
  if (str.startsWith("sex") || str === "fri" || str === "friday" || str === "5") return "Sex";
  if (str.startsWith("sab") || str.startsWith("sáb") || str === "sat" || str === "saturday" || str === "6") return "Sab";
  return null;
}

export function toMinutes(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const str = String(value).trim();
  const match = str.match(/^([01]?\d|2[0-3]):([0-5]\d)/);
  if (!match) return fallback;
  const h = Number(match[1]);
  const m = Number(match[2]);
  return h * 60 + m;
}

export function resolveTimezone(explicit?: string | null): string {
  if (explicit && typeof explicit === "string" && explicit.trim()) return explicit;
  return "America/Cuiaba";
}

function getZonedParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timeZone || "America/Cuiaba",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    hourCycle: "h23",
  });
  const parts = formatter.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const weekdayMap: Record<string, WeekDay> = {
    Sun: "Dom",
    Mon: "Seg",
    Tue: "Ter",
    Wed: "Qua",
    Thu: "Qui",
    Fri: "Sex",
    Sat: "Sab",
  };
  let hour = Number(get("hour")) || 0;
  if (hour === 24) hour = 0;
  const minute = Number(get("minute")) || 0;
  return {
    day: weekdayMap[get("weekday")] ?? "Dom",
    minutes: hour * 60 + minute,
  };
}

export function isMinutesInPeriod(currentMinutes: number, start: string, end: string): boolean {
  const startMinutes = toMinutes(start, 0);
  let endMinutes = toMinutes(end, 23 * 60 + 59);

  // Se o fechamento for menor ou igual à abertura (ex: 18:00 às 02:00), atravessa a meia-noite
  if (endMinutes <= startMinutes) {
    return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
  }

  return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
}

/**
 * Normaliza e parseia a grade de horários, garantindo suporte transparente a:
 * 1. Múltiplos períodos por dia (periods: [{ start, end }, ...])
 * 2. Formato legado com 1 período (start, end)
 * 3. Dicionários e wrappers de dias
 */
export function parseBusinessHours(input: BusinessHoursInput): ScheduleEntry[] | null {
  if (!input) return null;
  let raw: any = input;
  if (typeof input === "string") {
    try {
      raw = JSON.parse(input);
    } catch {
      return null;
    }
  }

  if (!raw) return null;

  if (!Array.isArray(raw) && typeof raw === "object") {
    if (Array.isArray(raw.days)) raw = raw.days;
    else if (Array.isArray(raw.workingDays)) raw = raw.workingDays;
    else if (Array.isArray(raw.hours)) raw = raw.hours;
    else {
      const entries: ScheduleEntry[] = [];
      Object.keys(raw).forEach((key) => {
        const normDay = normalizeDayName(key);
        if (normDay) {
          const item = raw[key];
          let periods: TimePeriod[] = [];
          if (Array.isArray(item?.periods)) {
            periods = item.periods.map((p: any) => ({
              start: p.start || p.open || "00:00",
              end: p.end || p.close || "23:59",
            }));
          } else if (item?.start && item?.end) {
            periods = [{ start: item.start, end: item.end }];
          } else if (item?.open && item?.close) {
            periods = [{ start: item.open, end: item.close }];
          }
          const s = periods[0]?.start || "00:00";
          const e = periods[periods.length - 1]?.end || "23:59";
          entries.push({
            day: normDay,
            active: item?.active !== false && item?.isOpen !== false && item?.is_open !== false,
            start: s,
            end: e,
            periods: periods.length > 0 ? periods : [{ start: s, end: e }],
          });
        }
      });
      if (entries.length > 0) return entries;
      return null;
    }
  }

  if (!Array.isArray(raw)) return null;

  const result: ScheduleEntry[] = [];
  for (const item of raw) {
    if (typeof item === "object" && item !== null) {
      const normDay = normalizeDayName(item.day || item.weekday || item.name);
      if (normDay) {
        let periods: TimePeriod[] = [];
        if (Array.isArray(item.periods) && item.periods.length > 0) {
          periods = item.periods
            .map((p: any) => ({
              start: p.start || p.open || p.opening || "00:00",
              end: p.end || p.close || p.closing || "23:59",
            }))
            .filter((p: TimePeriod) => Boolean(p.start && p.end));
        }

        const legStart = item.start || item.open || item.opening_time || item.from;
        const legEnd = item.end || item.close || item.closing_time || item.to;

        if (periods.length === 0 && legStart && legEnd) {
          periods = [{ start: legStart, end: legEnd }];
        }

        const start = periods[0]?.start || legStart || "00:00";
        const end = periods[periods.length - 1]?.end || legEnd || "23:59";

        result.push({
          day: normDay,
          active: item.active !== false && item.isOpen !== false && item.is_open !== false,
          start,
          end,
          periods: periods.length > 0 ? periods : [{ start, end }],
        });
      }
    }
  }

  return result.length > 0 ? result : null;
}

/**
 * Retorna true se a loja estiver dentro de QUALQUER período configurado para o momento atual.
 */
export function isStoreOpenBySchedule(
  input: BusinessHoursInput,
  now: Date = new Date(),
  timeZone?: string | null
): boolean {
  const schedule = parseBusinessHours(input);
  if (!schedule || schedule.length === 0) return true; // Sem horário cadastrado → confia no campo manual is_open do banco

  const tz = resolveTimezone(timeZone);
  let day: WeekDay;
  let currentMinutes: number;

  try {
    const zoned = getZonedParts(now, tz);
    day = zoned.day;
    currentMinutes = zoned.minutes;
  } catch (e) {
    const dayIndex = now.getDay();
    day = WEEK_DAYS[dayIndex];
    currentMinutes = now.getHours() * 60 + now.getMinutes();
  }

  // 1. Períodos do dia atual
  const entry = schedule.find((d) => d.day === day);
  if (entry && entry.active !== false) {
    const periods = entry.periods && entry.periods.length > 0
      ? entry.periods
      : [{ start: entry.start, end: entry.end }];

    for (const p of periods) {
      if (isMinutesInPeriod(currentMinutes, p.start, p.end)) {
        return true;
      }
    }
  }

  // 2. Virada da madrugada vinda do dia anterior (ex: ontem fechava às 02:00 e agora são 01:15)
  const currentDayIndex = WEEK_DAYS.indexOf(day);
  const prevDayIndex = (currentDayIndex - 1 + 7) % 7;
  const prevDay = WEEK_DAYS[prevDayIndex];
  const prevEntry = schedule.find((d) => d.day === prevDay);

  if (prevEntry && prevEntry.active !== false) {
    const prevPeriods = prevEntry.periods && prevEntry.periods.length > 0
      ? prevEntry.periods
      : [{ start: prevEntry.start, end: prevEntry.end }];

    for (const p of prevPeriods) {
      const pStart = toMinutes(p.start, 0);
      const pEnd = toMinutes(p.end, 23 * 60 + 59);
      if (pEnd <= pStart && currentMinutes <= pEnd) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Retorna mensagem do próximo horário de abertura (ex: "Abre hoje às 17:00" ou "Abre amanhã às 07:00")
 */
export function getNextOpenTimeInfo(
  input: BusinessHoursInput,
  now: Date = new Date(),
  timeZone?: string | null
): string | null {
  const schedule = parseBusinessHours(input);
  if (!schedule || schedule.length === 0) return null;

  const tz = resolveTimezone(timeZone);
  let day: WeekDay;
  let currentMinutes: number;

  try {
    const zoned = getZonedParts(now, tz);
    day = zoned.day;
    currentMinutes = zoned.minutes;
  } catch (e) {
    const dayIndex = now.getDay();
    day = WEEK_DAYS[dayIndex];
    currentMinutes = now.getHours() * 60 + now.getMinutes();
  }

  const currentDayIndex = WEEK_DAYS.indexOf(day);

  // 1. Próximos turnos de hoje
  const todayEntry = schedule.find((d) => d.day === day);
  if (todayEntry && todayEntry.active !== false) {
    const periods = todayEntry.periods || [{ start: todayEntry.start, end: todayEntry.end }];
    const futurePeriods = periods
      .filter((p) => toMinutes(p.start, 0) > currentMinutes)
      .sort((a, b) => toMinutes(a.start, 0) - toMinutes(b.start, 0));

    if (futurePeriods.length > 0) {
      return `Abre hoje às ${futurePeriods[0].start}`;
    }
  }

  // 2. Próximos dias
  for (let i = 1; i <= 7; i++) {
    const nextDayIndex = (currentDayIndex + i) % 7;
    const nextDay = WEEK_DAYS[nextDayIndex];
    const nextEntry = schedule.find((d) => d.day === nextDay);

    if (nextEntry && nextEntry.active !== false) {
      const periods = nextEntry.periods || [{ start: nextEntry.start, end: nextEntry.end }];
      const sortedPeriods = [...periods].sort((a, b) => toMinutes(a.start, 0) - toMinutes(b.start, 0));
      if (sortedPeriods.length > 0) {
        if (i === 1) {
          return `Abre amanhã às ${sortedPeriods[0].start}`;
        }
        return `Abre ${WEEKDAY_FULL_NAMES[nextDay]} às ${sortedPeriods[0].start}`;
      }
    }
  }

  return null;
}

export function formatPeriodsLabel(periods?: TimePeriod[] | null): string {
  if (!periods || periods.length === 0) return "Fechado";
  return periods.map((p) => `${p.start} às ${p.end}`).join(" | ");
}

export type StoreStatusInput = {
  is_open?: boolean | null;
  active?: boolean | null;
  is_active?: boolean | null;
  business_hours?: BusinessHoursInput;
  timezone?: string | null;
};

export function isStoreOpenNow(company: StoreStatusInput): boolean {
  if (!company) return false;
  const isActive = company.active !== false && (company as any).is_active !== false;
  if (!isActive) return false;
  if (company.is_open === false) return false;
  return isStoreOpenBySchedule(company.business_hours, new Date(), company.timezone);
}

export function getStoreStatusLabel(company: StoreStatusInput): string {
  if (!company) return "Fechada";
  if (isStoreOpenNow(company)) return "Aberta agora";
  const nextInfo = getNextOpenTimeInfo(company.business_hours, new Date(), company.timezone);
  return nextInfo ? `Fechada (${nextInfo})` : "Fechada";
}

export function getPrepTimeLabel(company: {
  prep_time_min?: number | null;
  prep_time_max?: number | null;
  prep_time?: number | null;
}): string {
  const min = company.prep_time_min ?? company.prep_time ?? 25;
  const max = company.prep_time_max ?? company.prep_time ?? 45;
  return `${min}-${max} min`;
}