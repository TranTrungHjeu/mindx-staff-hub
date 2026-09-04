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
  center: string;
  totalHours: number;
  totalSessions: number;
  roles: Record<string, number>;
  sessions: SessionLog[];
}

export interface PayrollParsedResult {
  filename: string;
  summary: {
    totalTeachers: number;
    totalHours: number;
    totalSessions: number;
    centers: string[];
    roles: string[];
  };
  teachers: TeacherPayrollSummary[];
}

function parseDuration(val: any): number {
  if (typeof val === "number") {
    if (val > 24) return 0;
    return Math.round(val * 10) / 10;
  }
  const n = parseFloat(val);
  return isNaN(n) || n > 24 ? 0 : Math.round(n * 10) / 10;
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

    const duration = parseDuration(
      row["Slot duration"] || row["Duration"] || row["Số giờ"] || row["Thời lượng"]
    );

    const type = (
      row["Type"] ||
      row["Loại"] ||
      "CLASS"
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
        center,
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
      center,
      isChecked,
    });
  });

  const teachersList = Object.values(teacherMap).map((t) => ({
    ...t,
    totalHours: Math.round(t.totalHours * 10) / 10,
  }));

  teachersList.sort((a, b) => b.totalHours - a.totalHours);

  return {
    filename: fileName,
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
