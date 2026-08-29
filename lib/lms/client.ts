import axios from "axios";
import { LMS_CONFIG } from "./config";
import { getValidLmsToken } from "../session";
import { GET_TEACHERS } from "./queries";
import { extractDatePart, extractHHMM } from "../date";
import { extractSessionIndex, resolveDirectTeacherRole } from "../courseConfig";

export class LmsClient {
  static async gqlRequest(operationName: string, query: string, variables: any = {}) {
    const token = await getValidLmsToken();
    const headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Origin: LMS_CONFIG.origin,
      Referer: LMS_CONFIG.referer,
    };

    const response = await axios.post(
      `${LMS_CONFIG.gatewayUrl}graphql`,
      { operationName, query, variables },
      { headers, timeout: 30000 }
    );

    if (response.data?.errors) {
      console.warn("[LmsClient] GraphQL Errors:", response.data.errors);
    }
    return response.data;
  }

  static async getTeachers(centreIds: string[], pageIndex = 0, itemsPerPage = 150) {
    const res = await this.gqlRequest("GetTeachers", GET_TEACHERS, {
      search: "",
      pageIndex,
      itemsPerPage,
      orderBy: "createdAt_desc",
      centers: centreIds,
    });

    if (res?.errors && !res?.data?.teachers) {
      throw new Error(res.errors[0]?.message || "GraphQL query error");
    }

    return res?.data?.teachers?.data || [];
  }

  static async getClassSlotsBatch(classIds: string[]): Promise<Record<string, {
    numberOfSessions: number;
    teachers: { teacher: { id: string; fullName: string; code: string }; role: { id: string; name: string; shortName: string } }[];
    slots: {
      _id: string;
      date: string;
      startTime: string;
      index: number;
      teachers: { teacher: { id: string; fullName: string; code: string }; role: { id: string; name: string; shortName: string } }[];
    }[];
  }>> {
    if (!classIds || classIds.length === 0) return {};
    const uniqueIds = Array.from(new Set(classIds.filter(Boolean)));
    if (uniqueIds.length === 0) return {};

    const subQueries = uniqueIds
      .map((id, idx) => `
        c_${idx}: classesById(id: "${id}") {
          id
          name
          numberOfSessions
          teachers {
            teacher { id fullName code }
            role { id name shortName description }
          }
          slots {
            _id
            date
            startTime
            index
            teachers {
              teacher { id fullName code }
              role { id name shortName description }
            }
          }
        }
      `)
      .join("\n");

    const query = `query getMultipleClassesSlots { ${subQueries} }`;
    const res = await this.gqlRequest("getMultipleClassesSlots", query);
    const data = res?.data || {};

    const map: Record<string, any> = {};
    Object.keys(data).forEach((key) => {
      const cls = data[key];
      if (cls && cls.id) {
        const rawSlots = (cls.slots || []).map((s: any, idx: number) => ({
          _id: s._id || "",
          date: s.date || "",
          startTime: s.startTime || s.date || "",
          index: typeof s.index === "number" ? s.index : idx,
          teachers: s.teachers || [],
        }));

        map[cls.id] = {
          numberOfSessions: cls.numberOfSessions || 14,
          teachers: cls.teachers || [],
          slots: rawSlots,
        };
      }
    });

    return map;
  }

  /**
   * 7-Level Session Index Resolver with Module Normalization (1..14)
   */
  private static resolveSessionIndex(sch: any, slots: any[], moduleLength = 14): { index: number; matchedSlot: any | null } {
    let rawIndex: number | null = null;
    let matchedSlot: any = null;

    if (slots && slots.length > 0) {
      // Level 1: Match by Slot _id
      matchedSlot = slots.find((s) => s._id === sch.id);
      if (matchedSlot) rawIndex = matchedSlot.index + 1;

      // Level 2: Match by exact startTime ISO string
      if (!matchedSlot && sch.startTime) {
        matchedSlot = slots.find((s) => s.startTime === sch.startTime);
        if (matchedSlot) rawIndex = matchedSlot.index + 1;
      }

      // Level 3: Match by parsed timestamp (ms within 1 minute)
      if (!matchedSlot && sch.startTime) {
        const schTimeMs = new Date(sch.startTime || sch.date).getTime();
        if (!isNaN(schTimeMs)) {
          matchedSlot = slots.find((s) => {
            const sTimeMs = new Date(s.startTime || s.date).getTime();
            return !isNaN(sTimeMs) && Math.abs(sTimeMs - schTimeMs) < 60000;
          });
          if (matchedSlot) rawIndex = matchedSlot.index + 1;
        }
      }

      // Level 4: Match by Date + Time (HH:mm)
      if (!matchedSlot) {
        const schDateStr = extractDatePart(sch.startTime || sch.date);
        const schHHMM = extractHHMM(sch.startTime);
        if (schDateStr && schHHMM) {
          matchedSlot = slots.find((s) => {
            const sDateStr = extractDatePart(s.startTime || s.date);
            const sHHMM = extractHHMM(s.startTime || s.date);
            return (
              sDateStr === schDateStr &&
              sHHMM &&
              sHHMM.hours === schHHMM.hours &&
              sHHMM.minutes === schHHMM.minutes
            );
          });
          if (matchedSlot) rawIndex = matchedSlot.index + 1;
        }
      }

      // Level 5: Match by Date only (same day)
      if (!matchedSlot) {
        const schDateStr = extractDatePart(sch.startTime || sch.date);
        if (schDateStr) {
          matchedSlot = slots.find((s) => {
            const sDateStr = extractDatePart(s.startTime || s.date);
            return sDateStr === schDateStr;
          });
          if (matchedSlot) rawIndex = matchedSlot.index + 1;
        }
      }

      // Level 6: Nearest slot by time proximity
      if (!matchedSlot) {
        const schTimeMs = new Date(sch.startTime || sch.date).getTime();
        if (!isNaN(schTimeMs)) {
          const sortedSlots = [...slots].sort((a, b) => {
            const tA = new Date(a.startTime || a.date).getTime();
            const tB = new Date(b.startTime || b.date).getTime();
            return tA - tB;
          });

          let minDiff = Infinity;
          sortedSlots.forEach((s) => {
            const sMs = new Date(s.startTime || s.date).getTime();
            if (!isNaN(sMs)) {
              const diff = Math.abs(sMs - schTimeMs);
              if (diff < minDiff) {
                minDiff = diff;
                matchedSlot = s;
                rawIndex = s.index + 1;
              }
            }
          });
        }
      }
    }

    // Level 7: Title/Description regex
    if (!rawIndex) {
      rawIndex = extractSessionIndex(sch.title, sch.description) || 1;
    }

    const len = moduleLength > 0 ? moduleLength : 14;
    const normalizedIndex = ((rawIndex - 1) % len) + 1;

    return { index: normalizedIndex, matchedSlot };
  }

  /**
   * Tier-1 Only Teacher Role Resolver (Slot Level Only)
   * Only returns a role if explicitly assigned to this teacher on this specific slot in LMS GraphQL.
   */
  private static resolveTeacherRole(sch: any, matchedSlot: any): string {
    if (matchedSlot && Array.isArray(matchedSlot.teachers) && matchedSlot.teachers.length > 0) {
      const assigned = matchedSlot.teachers.find(
        (t: any) => t.teacher?.id === sch.teacherId || t.teacher?._id === sch.teacherId
      );
      if (assigned && assigned.role) {
        const roleRaw = assigned.role.shortName || assigned.role.name || "";
        return resolveDirectTeacherRole(roleRaw);
      } else if (matchedSlot.teachers.length === 1 && matchedSlot.teachers[0].role) {
        const roleRaw = matchedSlot.teachers[0].role.shortName || matchedSlot.teachers[0].role.name || "";
        return resolveDirectTeacherRole(roleRaw);
      }
    }
    return ""; // No role badge if not assigned on slot level
  }

  static async getTeacherSchedules(
    teacherIds: string[],
    dateGte: string,
    dateLte: string
  ) {
    if (!teacherIds || teacherIds.length === 0) return [];

    const allResults: any[] = [];
    const batchSize = 20;

    for (let i = 0; i < teacherIds.length; i += batchSize) {
      const chunk = teacherIds.slice(i, i + batchSize);

      const queries = chunk
        .map((id) => {
          const safeId = id.toString().replace(/[^a-zA-Z0-9]/g, "");
          return `
            t_${safeId}: findTeacherSchedule(payload: {
              date_gte: $dateGte,
              date_lte: $dateLte,
              type_in: $type,
              teacherId_eq: "${id}"
            }) {
              data {
                id
                teacherId
                title
                description
                date
                startTime
                endTime
                type
                classSite {
                  class { id name }
                  centre { id name }
                }
                officeHour {
                  type
                  centre { id name }
                }
              }
            }
          `;
        })
        .join("\n");

      const query = `
        query findMultipleTeacherSchedules($dateGte: String!, $dateLte: String!, $type: [String]) {
          ${queries}
        }
      `;

      const variables = {
        dateGte,
        dateLte,
        type: ["CLASS_SESSION", "OFFICE_HOURS"],
      };

      const res = await this.gqlRequest(
        "findMultipleTeacherSchedules",
        query,
        variables
      );

      const data = res?.data || {};
      Object.keys(data).forEach((key) => {
        if (!Array.isArray(data[key]?.data)) return;
        const list = data[key].data;
        const actualTeacherId = key.replace(/^t_/, "");

        list.forEach((sch: any) => {
          sch.teacherId = sch.teacherId || actualTeacherId;
        });

        allResults.push(...list);
      });
    }

    // Enrich class schedules with 7-level session index & Tier-1 ONLY teacher role resolution
    const classIds = allResults
      .map((sch) => sch.classSite?.class?.id)
      .filter(Boolean);

    if (classIds.length > 0) {
      try {
        const classMap = await this.getClassSlotsBatch(classIds);

        allResults.forEach((sch) => {
          if (sch.type !== "CLASS_SESSION") return;

          const classId = sch.classSite?.class?.id;
          const classInfo = classId ? classMap[classId] : null;

          if (classInfo) {
            const moduleLength = classInfo.numberOfSessions || 14;
            sch.totalSessions = moduleLength;

            const { index, matchedSlot } = this.resolveSessionIndex(sch, classInfo.slots, moduleLength);
            sch.sessionIndex = index;
            sch.teacherRole = this.resolveTeacherRole(sch, matchedSlot);
          } else {
            const titleIdx = extractSessionIndex(sch.title, sch.description) || 1;
            sch.sessionIndex = ((titleIdx - 1) % 14) + 1;
            sch.totalSessions = 14;
            sch.teacherRole = "";
          }
        });
      } catch (err) {
        console.warn("[LmsClient] Failed to enrich class slot index:", err);
        allResults.forEach((sch) => {
          if (sch.type === "CLASS_SESSION") {
            const titleIdx = extractSessionIndex(sch.title, sch.description) || 1;
            sch.sessionIndex = ((titleIdx - 1) % 14) + 1;
            sch.totalSessions = 14;
            sch.teacherRole = "";
          }
        });
      }
    } else {
      allResults.forEach((sch) => {
        if (sch.type === "CLASS_SESSION") {
          const titleIdx = extractSessionIndex(sch.title, sch.description) || 1;
          sch.sessionIndex = ((titleIdx - 1) % 14) + 1;
          sch.totalSessions = 14;
          sch.teacherRole = "";
        }
      });
    }

    return allResults;
  }
}
