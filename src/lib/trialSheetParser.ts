export interface SheetTab {
  name: string;
  gid: string;
  startDate?: Date;
  endDate?: Date;
}

export interface TrialSlot {
  id: string;
  day: string;
  dateStr: string;
  displayDate: string;
  timeRaw: string;
  startTime: string;
  endTime: string;
  track: string;
  format: string;
  notes: string;
  students: string[];
  sheetTabName?: string;
  sheetGid?: string;
}

export const SPREADSHEET_ID = "127e4Xljxfbar_GSpWeV4K_ntgYXEGTIHOKKOx8UNymM";

// Pre-seeded fallback tabs if network htmlview fetch is blocked by CORS
const FALLBACK_TABS: SheetTab[] = [
  { name: "07/09 - 13/09", gid: "1722839979", startDate: new Date(2026, 8, 7), endDate: new Date(2026, 8, 13, 23, 59, 59) },
  { name: "31/08 - 06/09", gid: "1129899460", startDate: new Date(2026, 7, 31), endDate: new Date(2026, 8, 6, 23, 59, 59) },
  { name: "Mẫu V2.0", gid: "454113376" },
  { name: "Tuần Gốc", gid: "1467386010" }
];

/**
 * Parse tab date range, e.g., "07/09 - 13/09" or "31/08 - 06/09"
 */
export function parseTabDateRange(tabName: string, refYear: number = new Date().getFullYear()): { startDate: Date; endDate: Date } | null {
  const match = tabName.match(/(\d{1,2})\/(\d{1,2})\s*-\s*(\d{1,2})\/(\d{1,2})/);
  if (!match) return null;

  const startDay = parseInt(match[1], 10);
  const startMonth = parseInt(match[2], 10) - 1; // 0-indexed
  const endDay = parseInt(match[3], 10);
  const endMonth = parseInt(match[4], 10) - 1;

  // Handle year crossover (e.g. 28/12 - 03/01)
  let startYear = refYear;
  let endYear = refYear;
  if (startMonth === 11 && endMonth === 0) {
    endYear = refYear + 1;
  }

  const startDate = new Date(startYear, startMonth, startDay, 0, 0, 0);
  const endDate = new Date(endYear, endMonth, endDay, 23, 59, 59);

  return { startDate, endDate };
}

/**
 * Fetch all available tabs from the Google Sheet htmlview
 */
export async function fetchSheetTabs(spreadsheetId: string = SPREADSHEET_ID): Promise<SheetTab[]> {
  const targetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/htmlview`;
  const proxies = [
    targetUrl,
    `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`,
    `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`
  ];

  for (const url of proxies) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const html = await res.text();

      const itemMatches = [...html.matchAll(/items\.push\(\{name:\s*"([^"]+)",\s*pageUrl:[^,]+,\s*gid:\s*"([^"]+)"/g)];
      if (itemMatches.length > 0) {
        const tabs: SheetTab[] = [];
        const currentYear = new Date().getFullYear();

        itemMatches.forEach((m) => {
          const tabName = m[1].replace(/\\/g, "").trim();
          const gid = m[2].trim();
          const dates = parseTabDateRange(tabName, currentYear);

          tabs.push({
            name: tabName,
            gid,
            startDate: dates?.startDate,
            endDate: dates?.endDate
          });
        });

        if (tabs.length > 0) return tabs;
      }
    } catch {
      // Try next proxy
    }
  }

  return FALLBACK_TABS;
}

/**
 * Find the tab matching the given selected date
 */
export function findMatchingTabForDate(selectedDate: Date, tabs: SheetTab[]): SheetTab | null {
  const time = selectedDate.getTime();

  for (const tab of tabs) {
    if (tab.startDate && tab.endDate) {
      if (time >= tab.startDate.getTime() && time <= tab.endDate.getTime()) {
        return tab;
      }
    }
  }

  // Fallback: check if tab name contains matching DD/MM
  const dStr = String(selectedDate.getDate()).padStart(2, "0");
  const mStr = String(selectedDate.getMonth() + 1).padStart(2, "0");
  const dm = `${dStr}/${mStr}`;

  for (const tab of tabs) {
    if (tab.name.includes(dm)) return tab;
  }

  return null;
}

/**
 * Helper CSV line splitter supporting quoted strings
 */
function parseCSVLine(text: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (inQuotes && text[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === "," && !inQuotes) {
      result.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  result.push(cur);
  return result;
}

/**
 * Convert time string like "17H", "9H", "18:00", "18H30" to HH:MM start and end time
 */
export function normalizeTrialTime(timeRaw: string): { startTime: string; endTime: string } {
  if (!timeRaw) return { startTime: "18:00", endTime: "19:30" };
  const clean = timeRaw.trim().toUpperCase();

  const hMatch = clean.match(/^(\d{1,2})\s*H\s*(\d{2})?$/);
  if (hMatch) {
    const hours = parseInt(hMatch[1], 10);
    const mins = hMatch[2] ? parseInt(hMatch[2], 10) : 0;
    const startHourStr = String(hours).padStart(2, "0");
    const startMinStr = String(mins).padStart(2, "0");

    const endMinutesTotal = hours * 60 + mins + 90; // Default 1.5h trial duration
    const endH = Math.floor(endMinutesTotal / 60);
    const endM = endMinutesTotal % 60;
    const endHourStr = String(endH).padStart(2, "0");
    const endMinStr = String(endM).padStart(2, "0");

    return {
      startTime: `${startHourStr}:${startMinStr}`,
      endTime: `${endHourStr}:${endMinStr}`
    };
  }

  const colonMatch = clean.match(/^(\d{1,2}):(\d{2})$/);
  if (colonMatch) {
    const hours = parseInt(colonMatch[1], 10);
    const mins = parseInt(colonMatch[2], 10);
    const startHourStr = String(hours).padStart(2, "0");
    const startMinStr = String(mins).padStart(2, "0");

    const endMinutesTotal = hours * 60 + mins + 90;
    const endH = Math.floor(endMinutesTotal / 60);
    const endM = endMinutesTotal % 60;
    const endHourStr = String(endH).padStart(2, "0");
    const endMinStr = String(endM).padStart(2, "0");

    return {
      startTime: `${startHourStr}:${startMinStr}`,
      endTime: `${endHourStr}:${endMinStr}`
    };
  }

  return { startTime: "18:00", endTime: "19:30" };
}

/**
 * Format "07/09/26" or "07/09/2026" to "YYYY-MM-DD"
 */
function parseDateHeader(dateHeaderStr: string): string | null {
  if (!dateHeaderStr) return null;
  const parts = dateHeaderStr.split("/");
  if (parts.length === 3) {
    const d = parts[0].padStart(2, "0");
    const m = parts[1].padStart(2, "0");
    let y = parts[2];
    if (y.length === 2) y = "20" + y;
    return `${y}-${m}-${d}`;
  }
  return null;
}

/**
 * Format "2026-09-11" to "11/09/2026"
 */
function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

/**
 * Fetch CSV data for a specific GID and parse into TrialSlot array
 */
export async function fetchAndParseTrialSlots(
  gid: string,
  spreadsheetId: string = SPREADSHEET_ID,
  sheetTabName?: string
): Promise<TrialSlot[]> {
  const gvizUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&gid=${gid}`;
  const exportUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`;

  let rawCsv = "";

  try {
    const res = await fetch(gvizUrl);
    if (res.ok) {
      rawCsv = await res.text();
    }
  } catch {
    // Try export URL fallback
  }

  if (!rawCsv) {
    try {
      const res = await fetch(exportUrl);
      if (res.ok) {
        rawCsv = await res.text();
      }
    } catch {
      // Fallback
    }
  }

  if (!rawCsv) return [];

  const lines = rawCsv.split("\n").map((l) => l.trim()).filter(Boolean);

  let currentDay = "";
  let currentDateStr = "";

  const slots: TrialSlot[] = [];

  for (let i = 0; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    const dayCol = cols[0] ? cols[0].trim().toUpperCase() : "";
    const dateCol = cols[1] ? cols[1].trim() : "";

    if (["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"].includes(dayCol)) {
      currentDay = dayCol;
      if (dateCol) {
        const parsedD = parseDateHeader(dateCol);
        if (parsedD) currentDateStr = parsedD;
      }
    }

    const timeCol = cols[2] ? cols[2].trim() : "";
    const trackCol = cols[3] ? cols[3].trim() : "";
    const expCol = cols[4] ? cols[4].trim() : "";
    const noteCol = cols[5] ? cols[5].trim() : "";

    // Ignore header rows
    if (
      timeCol.toLowerCase().includes("ca trực") ||
      trackCol.toLowerCase().includes("bộ môn") ||
      expCol.toLowerCase().includes("hình thức")
    ) {
      continue;
    }

    if (timeCol || trackCol || expCol) {
      const students: string[] = [];
      if (cols[6] && cols[6].trim()) students.push(cols[6].trim());
      if (cols[8] && cols[8].trim()) students.push(cols[8].trim());
      if (cols[10] && cols[10].trim()) students.push(cols[10].trim());

      const { startTime, endTime } = normalizeTrialTime(timeCol);

      slots.push({
        id: `trial_${gid}_${currentDateStr}_${timeCol}_${trackCol}_${i}`,
        day: currentDay,
        dateStr: currentDateStr,
        displayDate: formatDisplayDate(currentDateStr),
        timeRaw: timeCol,
        startTime,
        endTime,
        track: trackCol || "KIDS / TEENS",
        format: expCol || "OFFLINE",
        notes: noteCol,
        students,
        sheetTabName,
        sheetGid: gid
      });
    }
  }

  return slots;
}
