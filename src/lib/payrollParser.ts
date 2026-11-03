import * as XLSX from "xlsx";

export interface SessionLog {
  id: string;
  date: string;
  type: string;
  className: string;
  course: string;
  role: string;
  duration: number;
  studentCount: number;
  note: string;
  center: string;
  isChecked: boolean;
}

export interface TeacherPayrollSummary {
  id: string;
  name: string;
  email: string;
  username: string;
  center: string; // Cơ sở chính (Primary / Dominant BU)
  centers: string[]; // Danh sách tất cả các cơ sở GV có ca dạy trong kỳ
  centerHours: Record<string, number>; // Số giờ dạy phân bổ theo từng cơ sở
  centerSessions: Record<string, number>; // Số ca dạy phân bổ theo từng cơ sở
  totalHours: number;
  totalSessions: number;
  roles: Record<string, number>;
  sessions: SessionLog[];
}

export interface PayrollParsedResult {
  filename: string;
  detectedMonth?: string;
  summary: {
    totalTeachers: number;
    totalHours: number;
    totalSessions: number;
    centers: string[];
    roles: string[];
  };
  teachers: TeacherPayrollSummary[];
}

function decodeExcelDateDotMonth(serial: number): number | null {
  const utcDays = Math.floor(serial) - 25569;
  const d = new Date(utcDays * 86400 * 1000);
  const day = d.getUTCDate();
  const month = d.getUTCMonth() + 1;
  // If month is 5 (representing .5, e.g. 1.5, 2.5), return day + 0.5
  if (month === 5 && day >= 1 && day <= 12) {
    return day + 0.5;
  }
  return null;
}

export function parseDuration(val: any, className = "", course = ""): number {
  if (val === null || val === undefined || val === "") {
    const courseUpper = course.toUpperCase();
    const classUpper = className.toUpperCase();
    if (
      courseUpper.includes("4+") ||
      courseUpper.includes("ROB4") ||
      courseUpper.includes("ART4") ||
      classUpper.includes("ROB4") ||
      classUpper.includes("KIND")
    ) {
      return 1.5;
    }
    return 0;
  }

  if (typeof val === "number") {
    if (val > 0 && val <= 24) {
      return Math.round(val * 10) / 10;
    }
    // Direct matches for common Excel serial dates formatted as d.m
    if (val === 46143) return 1.5; // 01/05/2026 -> 1.5h
    if (val === 46144) return 2.5; // 02/05/2026 -> 2.5h
    if (val >= 35000 && val <= 65000) {
      const decoded = decodeExcelDateDotMonth(val);
      if (decoded !== null) return decoded;
    }
    // Handle floating numbers where export stripped decimal point (e.g. 19833333333333300 -> 1.983 -> 2.0h)
    if (val > 1e14) {
      const s = String(val);
      const normalized = parseFloat(s[0] + "." + s.slice(1));
      if (!isNaN(normalized) && normalized > 0 && normalized <= 24) {
        return Math.round(normalized * 10) / 10;
      }
    }
    return 0;
  }

  const str = String(val).trim().replace(",", ".");

  // Handle formats like "1:30"
  if (str.includes(":")) {
    const parts = str.split(":");
    const h = parseFloat(parts[0]) || 0;
    const m = parseFloat(parts[1]) || 0;
    const total = h + m / 60;
    return total > 0 && total <= 24 ? Math.round(total * 10) / 10 : 0;
  }

  // Handle formats like "1h30" or "1h30p"
  if (/^\d+(\.\d+)?h\d*$/i.test(str)) {
    const parts = str.toLowerCase().split("h");
    const h = parseFloat(parts[0]) || 0;
    const m = parseFloat(parts[1]) || 0;
    const total = h + m / 60;
    return total > 0 && total <= 24 ? Math.round(total * 10) / 10 : 0;
  }

  const n = parseFloat(str);
  if (isNaN(n)) {
    const courseUpper = course.toUpperCase();
    const classUpper = className.toUpperCase();
    if (
      courseUpper.includes("4+") ||
      courseUpper.includes("ROB4") ||
      courseUpper.includes("ART4") ||
      classUpper.includes("ROB4") ||
      classUpper.includes("KIND")
    ) {
      return 1.5;
    }
    return 0;
  }

  if (n > 0 && n <= 24) return Math.round(n * 10) / 10;
  if (n === 46143) return 1.5;
  if (n === 46144) return 2.5;
  if (n >= 35000 && n <= 65000) {
    const decoded = decodeExcelDateDotMonth(n);
    if (decoded !== null) return decoded;
  }
  if (n > 1e14) {
    const s = String(n);
    const normalized = parseFloat(s[0] + "." + s.slice(1));
    if (!isNaN(normalized) && normalized > 0 && normalized <= 24) {
      return Math.round(normalized * 10) / 10;
    }
  }

  return 0;
}

function parseCheckedStatus(val: any): boolean {
  if (val === true || val === 1) return true;
  if (!val) return false;
  const str = val.toString().trim().toLowerCase();
  return (
    str === "true" ||
    str === "1" ||
    str === "checked" ||
    str === "x" ||
    str === "v" ||
    str === "yes" ||
    str === "y" ||
    str.includes("đã") ||
    str.includes("đối soát") ||
    str.includes("kiểm") ||
    str.includes("duyệt")
  );
}

export function formatDateString(val: any): string {
  if (val === null || val === undefined || val === "") return "N/A";
  if (val instanceof Date) {
    return formatJsDate(val);
  }

  const str = String(val).trim();
  if (!str) return "N/A";

  // Check if string contains JS Date toString format (e.g. Sat Aug 01 2026 16:00:00 GMT+0700) or ISO format
  if (
    str.includes("GMT") ||
    str.includes("Indochina") ||
    str.includes("Time") ||
    str.includes("T") ||
    /^[A-Za-z]{3}\s[A-Za-z]{3}\s\d{2}/.test(str)
  ) {
    const parsedDate = new Date(str);
    if (!isNaN(parsedDate.getTime())) {
      return formatJsDate(parsedDate);
    }
  }

  return str;
}

function formatJsDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const day = pad(d.getDate());
  const month = pad(d.getMonth() + 1);
  const year = d.getFullYear();
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());

  if (hours === "00" && minutes === "00") {
    return `${day}/${month}/${year}`;
  }
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

export function getSessionCategory(s: SessionLog): string {
  const roleUpper = (s.role || "").toUpperCase().trim();
  const typeUpper = (s.type || "").toUpperCase().trim();
  const classLower = (s.className || "").toLowerCase();
  const noteLower = (s.note || "").toLowerCase();
  const courseLower = (s.course || "").toLowerCase();

  if (
    s.duration >= 3 ||
    roleUpper === "TRIAL" ||
    typeUpper.includes("TRIAL") ||
    classLower.includes("trial") ||
    classLower.includes("học thử") ||
    classLower.includes("dạy thử") ||
    classLower.includes("trải nghiệm") ||
    courseLower.includes("trial") ||
    noteLower.includes("trial")
  ) {
    return "Trial";
  }

  if (
    roleUpper === "MAKEUP" ||
    typeUpper.includes("MAKEUP") ||
    classLower.includes("makeup") ||
    classLower.includes("học bù") ||
    classLower.includes("dạy bù") ||
    noteLower.includes("bù")
  ) {
    return "Makeup";
  }

  if (
    roleUpper === "SUPPLY" ||
    roleUpper === "DT" ||
    roleUpper.includes("THAY") ||
    typeUpper.includes("SUPPLY")
  ) {
    return "Supply";
  }

  if (
    roleUpper === "JUDGE" ||
    roleUpper === "GK" ||
    roleUpper.includes("GIÁM")
  ) {
    return "Judge";
  }

  if (
    roleUpper === "TA" ||
    roleUpper.includes("TG") ||
    roleUpper.includes("TRỢ GIẢNG")
  ) {
    return "TA";
  }

  if (
    roleUpper === "LEC" ||
    roleUpper.includes("GV") ||
    roleUpper.includes("GIẢNG VIÊN")
  ) {
    return "LEC";
  }

  if (
    roleUpper === "FIXED" ||
    typeUpper.includes("FIXED") ||
    classLower.includes("fixed")
  ) {
    return "Fixed";
  }

  return s.role || "Fixed";
}

export async function parsePayrollData(
  input: ArrayBuffer | File | string,
  fileName = "Bang_Cong.xlsx"
): Promise<PayrollParsedResult> {
  let arrayBuffer: ArrayBuffer | undefined;

  if (typeof input === "string") {
    if (input.startsWith("data:")) {
      try {
        const base64Parts = input.split(",");
        const base64Data = base64Parts[1] || base64Parts[0];
        const binaryString = atob(base64Data);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        arrayBuffer = bytes.buffer;
      } catch (e) {
        console.error("Failed to decode base64 dataUrl:", e);
      }
    } else {
      try {
        const res = await fetch(input);
        if (res.ok) {
          const contentType = res.headers.get("content-type") || "";
          if (!contentType.includes("text/html")) {
            arrayBuffer = await res.arrayBuffer();
          }
        }
      } catch (e) {
        console.error("Failed to fetch file URL:", e);
      }
    }
  } else if (input instanceof File) {
    fileName = input.name;
    arrayBuffer = await input.arrayBuffer();
  } else if (input instanceof ArrayBuffer) {
    arrayBuffer = input;
  } else if (input && typeof input === "object" && "byteLength" in input) {
    arrayBuffer = input as unknown as ArrayBuffer;
  }

  if (!arrayBuffer || !(arrayBuffer instanceof ArrayBuffer) || arrayBuffer.byteLength < 50) {
    return {
      filename: fileName,
      summary: { totalTeachers: 0, totalHours: 0, totalSessions: 0, centers: [], roles: [] },
      teachers: [],
    };
  }

  // Detect HTML 404 fallback content
  try {
    const headerText = new TextDecoder().decode(new Uint8Array(arrayBuffer.slice(0, 60))).toLowerCase();
    if (headerText.includes("<!doctype") || headerText.includes("<html")) {
      return {
        filename: fileName,
        summary: { totalTeachers: 0, totalHours: 0, totalSessions: 0, centers: [], roles: [] },
        teachers: [],
      };
    }
  } catch (e) {
    // Ignore decode error
  }

  try {
    const workbook = XLSX.read(arrayBuffer, { type: "array" });
    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      return {
        filename: fileName,
        summary: { totalTeachers: 0, totalHours: 0, totalSessions: 0, centers: [], roles: [] },
        teachers: [],
      };
    }

    const firstSheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[firstSheetName];
    const rawRows: any[] = XLSX.utils.sheet_to_json(sheet);

  const teacherMap: Record<string, TeacherPayrollSummary> = {};
  const centerSet = new Set<string>();
  const roleSet = new Set<string>();

  let grandTotalHours = 0;
  let grandTotalSessions = 0;

  rawRows.forEach((row, idx) => {
    const name = (
      row["Teacher name"] ||
      row["Teacher Name"] ||
      row["Full Name"] ||
      row["Full name"] ||
      row["Tên GV"] ||
      row["Họ và tên"] ||
      row["Giảng viên"] ||
      "Giảng viên chưa tên"
    )
      .toString()
      .trim();

    const email = (
      row["Work email"] ||
      row["Work Email"] ||
      row["Personal email"] ||
      row["Email"] ||
      row["Email GV"] ||
      ""
    )
      .toString()
      .trim();

    const username = (
      row["Username"] ||
      row["User Name"] ||
      row["Mã GV"] ||
      row["Mã nhân sự"] ||
      row["Staff Code"] ||
      ""
    )
      .toString()
      .trim();

    const center = (
      row["Centre shortname"] ||
      row["Class Site Centre"] ||
      row["Centre"] ||
      row["Center"] ||
      row["Cơ sở"] ||
      "Cơ sở khác"
    )
      .toString()
      .trim();

    const role = (
      row["Class role/Office hour type"] ||
      row["Class role"] ||
      row["Role"] ||
      row["Vai trò"] ||
      "Khác"
    )
      .toString()
      .trim();

    const className = (
      row["Class name"] ||
      row["Class Name"] ||
      row["Lớp"] ||
      row["Course"] ||
      "Chưa đặt tên"
    )
      .toString()
      .trim();

    const course = (
      row["Course"] ||
      row["Course Name"] ||
      row["Khóa học"] ||
      row["Môn học"] ||
      ""
    )
      .toString()
      .trim();

    const duration = parseDuration(
      row["Slot duration"] || row["Duration"] || row["Số giờ"] || row["Thời lượng"],
      className,
      course
    );

    const type = (
      row["Type"] ||
      row["Loại"] ||
      "CLASS"
    )
      .toString()
      .trim();

    const slotTimeRaw =
      row["Slot time"] ||
      row["Time"] ||
      row["Thời gian"] ||
      row["Ngày dạy"] ||
      "";
    const slotTime = formatDateString(slotTimeRaw);

    const studentCount = Number(row["Student count"] || row["Sĩ số"] || 0) || 0;
    const note = (
      row["Note"] ||
      row["Manager Note"] ||
      row["Ghi chú"] ||
      ""
    )
      .toString()
      .trim();

    const isChecked = parseCheckedStatus(
      row["Checked"] ||
      row["Check"] ||
      row["Is Checked"] ||
      row["Is checked"] ||
      row["Status"] ||
      row["Trạng thái"] ||
      row["Đối soát"] ||
      row["Check/Uncheck"] ||
      row["Check / Uncheck"] ||
      row["Duyệt"] ||
      row["Xác nhận"]
    );

    if (center) centerSet.add(center);
    if (role) roleSet.add(role);

    grandTotalHours += duration;
    grandTotalSessions += 1;

    const teacherKey = email || username || name;

    if (!teacherMap[teacherKey]) {
      teacherMap[teacherKey] = {
        id: `t_${idx}_${Math.random().toString(36).substring(2, 7)}`,
        name,
        email,
        username,
        center: center || "Cơ sở khác",
        centers: [],
        centerHours: {},
        centerSessions: {},
        totalHours: 0,
        totalSessions: 0,
        roles: {},
        sessions: [],
      };
    }

    const t = teacherMap[teacherKey];
    t.totalHours += duration;
    t.totalSessions += 1;
    t.roles[role] = (t.roles[role] || 0) + duration;

    // Track per-center statistics
    const sessionCenter = center || "Cơ sở khác";
    t.centerHours[sessionCenter] = Math.round(((t.centerHours[sessionCenter] || 0) + duration) * 10) / 10;
    t.centerSessions[sessionCenter] = (t.centerSessions[sessionCenter] || 0) + 1;

    t.sessions.push({
      id: `s_${idx}`,
      date: slotTime,
      type,
      className,
      course,
      role,
      duration,
      studentCount,
      note,
      center: sessionCenter,
      isChecked,
    });
  });

  const defaultHubCenter =
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_DEFAULT_CENTER_NAME) || "230ĐLBD";

  const teachersList = Object.values(teacherMap).map((t) => {
    const centersArr = Object.keys(t.centerHours);
    t.centers = centersArr;

    // Smart Primary Center Inference:
    // Rule 1: Priority for configured Hub Center (e.g. 230ĐLBD) if teacher has active sessions there
    const hubHours = t.centerHours[defaultHubCenter] || 0;
    let primaryCenter = t.center;

    if (hubHours >= 8) {
      primaryCenter = defaultHubCenter;
    } else {
      // Rule 2: Prefer Offline centers over Online centers (since Online is usually cross-coverage)
      const offlineCenters = centersArr.filter(
        (c) => !c.toLowerCase().includes("online") && !c.toLowerCase().includes("onl")
      );
      const candidateCenters = offlineCenters.length > 0 ? offlineCenters : centersArr;

      let maxHours = -1;
      let dominantCenter = candidateCenters[0] || t.center;

      candidateCenters.forEach((c) => {
        const h = t.centerHours[c] || 0;
        if (h > maxHours) {
          maxHours = h;
          dominantCenter = c;
        }
      });

      // If hub center is among top offline centers, still prioritize it
      if (hubHours > 0 && hubHours >= maxHours * 0.4) {
        primaryCenter = defaultHubCenter;
      } else {
        primaryCenter = dominantCenter;
      }
    }

    return {
      ...t,
      center: primaryCenter,
      totalHours: Math.round(t.totalHours * 10) / 10,
    };
  });

  teachersList.sort((a, b) => b.totalHours - a.totalHours);

  // Detect dominant month from session dates
  const monthCounts: Record<string, number> = {};
  Object.values(teacherMap).forEach((t) => {
    t.sessions.forEach((s) => {
      if (s.date) {
        const match = s.date.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        if (match) {
          const m = Number(match[2]);
          const y = Number(match[3]);
          if (m >= 1 && m <= 12 && y >= 2020 && y <= 2035) {
            const key = `Tháng ${m}/${y}`;
            monthCounts[key] = (monthCounts[key] || 0) + 1;
          }
        }
      }
    });
  });

  let detectedMonth = "";
  let maxCount = 0;
  Object.entries(monthCounts).forEach(([mKey, count]) => {
    if (count > maxCount) {
      maxCount = count;
      detectedMonth = mKey;
    }
  });

  return {
    filename: fileName,
    detectedMonth: detectedMonth || undefined,
    summary: {
      totalTeachers: teachersList.length,
      totalHours: Math.round(grandTotalHours * 10) / 10,
      totalSessions: grandTotalSessions,
      centers: Array.from(centerSet).sort(),
      roles: Array.from(roleSet).sort(),
    },
    teachers: teachersList,
  };
  } catch (err) {
    return {
      filename: fileName,
      summary: { totalTeachers: 0, totalHours: 0, totalSessions: 0, centers: [], roles: [] },
      teachers: [],
    };
  }
}
