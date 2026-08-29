import { format, isValid, parseISO } from "date-fns";
import { vi } from "date-fns/locale";

const VN_OFFSET_MS = 7 * 60 * 60 * 1000; // UTC+7 in milliseconds

function toDate(value?: string | Date | null) {
  if (!value) return null;

  if (value instanceof Date) {
    return isValid(value) ? value : null;
  }

  const parsed = parseISO(value);
  if (isValid(parsed)) return parsed;

  const fallback = new Date(value);
  return isValid(fallback) ? fallback : null;
}

export function formatDate(
  value?: string | Date | null,
  pattern = "dd/MM/yyyy"
) {
  const date = toDate(value);
  if (!date) return "N/A";

  return format(date, pattern, { locale: vi });
}

export function formatDateTime(
  value?: string | Date | null,
  pattern = "dd/MM/yyyy HH:mm"
) {
  const date = toDate(value);
  if (!date) return "N/A";

  return format(date, pattern, { locale: vi });
}

export function formatTime(value?: string | Date | null) {
  if (!value) return "N/A";

  if (typeof value === "string") {
    const str = value.trim();

    if (str.includes("T")) {
      const d = new Date(str);
      if (isNaN(d.getTime())) return "N/A";
      const vnDate = new Date(d.getTime() + VN_OFFSET_MS);
      return `${String(vnDate.getUTCHours()).padStart(2, "0")}:${String(vnDate.getUTCMinutes()).padStart(2, "0")}`;
    }

    if (/^\d{2}:\d{2}/.test(str)) return str.substring(0, 5);
    const parts = str.split(":");
    if (parts.length >= 2) {
      const h = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      if (!isNaN(h) && !isNaN(m))
        return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    }
    return "N/A";
  }

  const d = value as Date;
  if (isNaN(d.getTime())) return "N/A";
  const vnDate = new Date(d.getTime() + VN_OFFSET_MS);
  return `${String(vnDate.getUTCHours()).padStart(2, "0")}:${String(vnDate.getUTCMinutes()).padStart(2, "0")}`;
}

export function formatVietnameseDate(
  value?: string | Date | null,
  pattern = "EEEE, 'ngày' d 'tháng' M 'năm' yyyy"
) {
  const date = toDate(value);
  if (!date) return "N/A";

  return format(date, pattern, { locale: vi });
}

export function extractHHMM(
  timeVal: string | null | undefined
): { hours: number; minutes: number } | null {
  if (!timeVal) return null;
  const str = String(timeVal).trim();

  if (str.includes("T")) {
    const d = new Date(str);
    if (isNaN(d.getTime())) return null;
    const vnDate = new Date(d.getTime() + VN_OFFSET_MS);
    return { hours: vnDate.getUTCHours(), minutes: vnDate.getUTCMinutes() };
  }

  const parts = str.split(":");
  if (parts.length >= 2) {
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (!isNaN(h) && !isNaN(m)) return { hours: h, minutes: m };
  }
  return null;
}

export function extractDatePart(value: string | null | undefined): string {
  if (!value) return "";
  const str = String(value).trim();
  if (str.includes("T")) return str.substring(0, 10);
  return str.substring(0, 10);
}
