/**
 * MindX Course Dictionary & Session Milestone Calculation
 * Calculates Checkpoint 1, Checkpoint 2, and Demo sessions directly from LMS class & session data.
 */

export const COURSE_DICTIONARY: Record<string, { code: string; name: string; category: "coding" | "robotics" | "art" }> = {
  // CODING
  SB: { code: "SB", name: "Scratch Creator Basic", category: "coding" },
  SA: { code: "SA", name: "Scratch Creator Advanced", category: "coding" },
  SI: { code: "SI", name: "Scratch Creator Intensive", category: "coding" },
  GB: { code: "GB", name: "Game Creator Basic", category: "coding" },
  GA: { code: "GA", name: "Game Creator Advanced", category: "coding" },
  GI: { code: "GI", name: "Game Creator Intensive", category: "coding" },
  PTB: { code: "PTB", name: "App Producer Basic", category: "coding" },
  PTA: { code: "PTA", name: "App Producer Advanced", category: "coding" },
  PTI: { code: "PTI", name: "App Producer Intensive", category: "coding" },
  JSB: { code: "JSB", name: "Web Developer Basic", category: "coding" },
  JSA: { code: "JSA", name: "Web Developer Advanced", category: "coding" },
  JSI: { code: "JSI", name: "Web Developer Intensive", category: "coding" },
  CSB: { code: "CSB", name: "Computer Scientist Basic", category: "coding" },
  CSA: { code: "CSA", name: "Computer Scientist Advanced", category: "coding" },
  CSI: { code: "CSI", name: "Computer Scientist Intensive", category: "coding" },
  NG: { code: "NG", name: "Next Gen", category: "coding" },

  // ROBOTICS
  KIROB: { code: "KIROB", name: "Robotics 4+ (Vex 123)", category: "robotics" },
  PREB: { code: "PREB", name: "Pre Basic", category: "robotics" },
  PREA: { code: "PREA", name: "Pre Advanced", category: "robotics" },
  PREI: { code: "PREI", name: "Pre Intensive", category: "robotics" },
  ARMB: { code: "ARMB", name: "Arm Basic", category: "robotics" },
  ARMA: { code: "ARMA", name: "Arm Advanced", category: "robotics" },
  ARMI: { code: "ARMI", name: "Arm Intensive", category: "robotics" },
  SEMIB: { code: "SEMIB", name: "Semi Basic", category: "robotics" },
  SEMIA: { code: "SEMIA", name: "Semi Advanced", category: "robotics" },
  SEMII: { code: "SEMII", name: "Semi Intensive", category: "robotics" },
  AUTOA: { code: "AUTOA", name: "Auto Advanced", category: "robotics" },

  // ART
  KAB: { code: "KAB", name: "Kids Art Basic", category: "art" },
  KAA: { code: "KAA", name: "Kids Art Advanced", category: "art" },
  KAI: { code: "KAI", name: "Kids Art Intensive", category: "art" },
  VAB: { code: "VAB", name: "Visual Art Basic", category: "art" },
  VAA: { code: "VAA", name: "Visual Art Advanced", category: "art" },
  VAI: { code: "VAI", name: "Visual Art Intensive", category: "art" },
  VCB: { code: "VCB", name: "Visual Creation Basic", category: "art" },
  VCA: { code: "VCA", name: "Visual Creation Advanced", category: "art" },
  VCI: { code: "VCI", name: "Visual Creation Intensive", category: "art" },
  GDB: { code: "GDB", name: "Graphic Design Basic", category: "art" },
  GDA: { code: "GDA", name: "Graphic Design Advanced", category: "art" },
  GDI: { code: "GDI", name: "Graphic Design Intensive", category: "art" },
  MDB: { code: "MDB", name: "Multimedia Design Basic", category: "art" },
  MDA: { code: "MDA", name: "Multimedia Design Advanced", category: "art" },
  MDI: { code: "MDI", name: "Multimedia Design Intensive", category: "art" },
  DAB: { code: "DAB", name: "Digital Animation Basic", category: "art" },
  DAA: { code: "DAA", name: "Digital Animation Advanced", category: "art" },
  DAI: { code: "DAI", name: "Digital Animation Intensive", category: "art" },
  IDB: { code: "IDB", name: "Interaction Design Basic", category: "art" },
  IDA: { code: "IDA", name: "Interaction Design Advanced", category: "art" },
  IDI: { code: "IDI", name: "Interaction Design Intensive", category: "art" },
};

export function extractCourseCode(className: string): string {
  if (!className) return "";
  const upperName = className.toUpperCase();
  const keys = Object.keys(COURSE_DICTIONARY).sort((a, b) => b.length - a.length);

  for (const key of keys) {
    if (upperName.includes(key)) {
      const regex = new RegExp(`(^|[-_ .])${key}([-_ .\\d]|$)`);
      if (regex.test(upperName)) {
        return key;
      }
    }
  }
  return "";
}

export function getCourseCategory(className: string): "coding" | "robotics" | "art" | "unknown" {
  const code = extractCourseCode(className) || className.toUpperCase();
  if (COURSE_DICTIONARY[code]) {
    return COURSE_DICTIONARY[code].category;
  }
  const upperName = className.toUpperCase();
  if (upperName.includes("XART")) return "art";
  if (upperName.includes("RBT") || upperName.includes("ROB")) return "robotics";
  if (upperName.includes("NEXT GEN") || upperName.includes("NEXTGEN")) return "coding";
  return "unknown";
}

export function getCourseMilestones(className: string): { checkpoint1: number; checkpoint2: number; demo: number } {
  const category = getCourseCategory(className);
  if (category === "robotics") {
    return { checkpoint1: 4, checkpoint2: 8, demo: 14 };
  }
  return { checkpoint1: 5, checkpoint2: 9, demo: 14 };
}

export function extractSessionIndex(title = "", description = ""): number | null {
  const fullText = `${title} ${description}`.toLowerCase();

  const matchBuoi = fullText.match(/(?:buổi|buoi|b|session)\s*(\d+)/i);
  if (matchBuoi && matchBuoi[1]) {
    return parseInt(matchBuoi[1], 10);
  }

  const matchSlash = fullText.match(/(\d+)\s*\/\s*\d+/);
  if (matchSlash && matchSlash[1]) {
    return parseInt(matchSlash[1], 10);
  }

  return null;
}

export function getSessionExamType(
  className: string,
  title = "",
  description = "",
  directSessionIndex?: number,
  totalSessions = 14
): "checkpoint1" | "checkpoint2" | "demo" | null {
  const sessionIndex = directSessionIndex ?? extractSessionIndex(title, description);

  if (sessionIndex !== null && sessionIndex !== undefined) {
    if (sessionIndex === totalSessions) {
      return "demo";
    }

    if (totalSessions >= 18) {
      if (sessionIndex === 6) return "checkpoint1";
      if (sessionIndex === 12) return "checkpoint2";
    } else {
      const milestones = getCourseMilestones(className);
      if (sessionIndex === milestones.checkpoint1) return "checkpoint1";
      if (sessionIndex === milestones.checkpoint2) return "checkpoint2";
      if (sessionIndex === milestones.demo) return "demo";
    }

    return null;
  }

  const fullText = `${title} ${description}`.toLowerCase();
  if (fullText.includes("checkpoint 1") || fullText.includes("cp1") || fullText.includes("checkpoint1")) {
    return "checkpoint1";
  }
  if (fullText.includes("checkpoint 2") || fullText.includes("cp2") || fullText.includes("checkpoint2")) {
    return "checkpoint2";
  }
  if (fullText.includes("demo") || fullText.includes("cuối khóa") || fullText.includes("cuoi khoa")) {
    return "demo";
  }

  return null;
}

export function resolveDirectTeacherRole(teacherRole?: string): string {
  if (teacherRole && teacherRole.trim() !== "") {
    const upper = teacherRole.toUpperCase().trim();
    if (upper === "LEC" || upper === "LECTURER" || upper === "MAIN_TEACHER" || upper === "GIẢNG VIÊN") return "LEC";
    if (upper === "TA" || upper === "TEACHING_ASSISTANT" || upper === "TRỢ GIẢNG") return "TA";
    if (upper.includes("EXAM") || upper.includes("GK") || upper.includes("JUDGE") || upper === "GIÁM KHẢO") return "GK";
    if (upper.includes("SUB") || upper.includes("COVER") || upper === "DẠY THAY" || upper === "DT") return "DT";
    return upper;
  }
  return "";
}
