import { useState, useEffect, useMemo } from "react";
import {
  Calendar,
  Clock,
  UserCheck,
  Building2,
  Filter,
  CheckCircle2,
  AlertCircle,
  Repeat,
  FlaskConical,
  Award,
  ChevronRight,
  ChevronLeft,
  Search,
  Check,
  Sparkles,
  MapPin,
  ListOrdered,
  BookOpen,
  ChevronDown,
  XCircle,
  History,
  Trash2,
  AlertTriangle,
  ExternalLink,
  RefreshCw,
  FileSpreadsheet,
  Users,
  Info,
  Table,
  Columns,
  X,
  Layers,
} from "lucide-react";
import {
  SheetTab,
  TrialSlot,
  fetchSheetTabs,
  findMatchingTabForDate,
  fetchAndParseTrialSlots,
  SPREADSHEET_ID,
} from "@/lib/trialSheetParser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format, startOfWeek, endOfWeek, addDays, isSameDay, addWeeks, subWeeks } from "date-fns";
import { extractHHMM, extractDatePart, formatTime } from "@/lib/date";
import { LmsClient } from "@/lib/lms/client";
import {
  BookingRecord,
  BookingType,
  getLocalBookings,
  saveBookingRecord,
  cancelBookingRecord,
  deleteBookingRecord,
  clearCancelledBookings,
} from "@/lib/bookingStorage";
import { DatePickerDropdown } from "@/components/ui/custom-date-picker";

// Helper to compare if two trial tracks match (e.g. GB, Game Basic, WEB, CS)
export function areTracksMatching(t1: string, t2: string): boolean {
  if (!t1 || !t2) return false;
  const c1 = t1.trim().toLowerCase();
  const c2 = t2.trim().toLowerCase();
  if (c1 === c2) return true;
  if ((c1.includes("gb") || c1.includes("game")) && (c2.includes("gb") || c2.includes("game"))) return true;
  if ((c1.includes("web") || c1.includes("html")) && (c2.includes("web") || c2.includes("html"))) return true;
  if ((c1.includes("python") || c1.includes("py")) && (c2.includes("python") || c2.includes("py"))) return true;
  return false;
}

// Convert "17:30" or "17H30" or "18:00" to minutes from midnight
export function parseHHMMToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const clean = timeStr.replace("H", ":");
  const parts = clean.split(":");
  if (parts.length < 2) return 0;
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
}

// Helper to find all matching consecutive 1-hour slots of the same track on the same day forming a 3h shift
export function getShiftGroupSlots(targetSlot: TrialSlot, allSlots: TrialSlot[]): TrialSlot[] {
  if (!targetSlot || !allSlots || allSlots.length === 0) return [targetSlot];

  const matchingSlots = allSlots.filter(
    (s) => s.dateStr === targetSlot.dateStr && areTracksMatching(s.track, targetSlot.track)
  );

  if (matchingSlots.length <= 1) return [targetSlot];

  matchingSlots.sort((a, b) => parseHHMMToMinutes(a.startTime) - parseHHMMToMinutes(b.startTime));

  const targetMinutes = parseHHMMToMinutes(targetSlot.startTime);
  const group = matchingSlots.filter((s) => {
    const sMin = parseHHMMToMinutes(s.startTime);
    return Math.abs(sMin - targetMinutes) <= 180; // Within 3-hour shift window
  });

  return group.length > 0 ? group : [targetSlot];
}

export type ActiveSubTab = BookingType | "history";

export interface ActionConfirmState {
  isOpen: boolean;
  type: "CANCEL_BOOKING" | "DELETE_BOOKING" | "CLEAR_CANCELLED";
  bookingId?: string;
  recordTitle?: string;
}

interface Schedule {
  id: string;
  teacherId: string;
  teacherName?: string;
  teacherCode?: string;
  title: string;
  description: string;
  date: string;
  startTime: string;
  endTime: string;
  type: string;
  teacherRole?: string;
  sessionIndex?: number;
  totalSessions?: number;
  classStatus?: string;
  classSite?: {
    class?: { id?: string; name: string; numberOfSessions?: number };
    centre?: { id?: string; name: string };
  };
  officeHour?: {
    type: string;
    centre?: { id?: string; name: string };
  };
}

interface Teacher {
  id: string;
  fullName: string;
  code: string;
}

const DEFAULT_CENTRE_ID = import.meta.env.VITE_DEFAULT_CENTRE_IDS || "6443460f94300678908f7974";
const TARGET_CENTRE_NAME = "230ĐLBD — Thủ Dầu Một";

export function TeacherBookingView() {
  const [activeSubTab, setActiveSubTab] = useState<ActiveSubTab>("substitute");

  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [teachersList, setTeachersList] = useState<Teacher[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [searchTeacher, setSearchTeacher] = useState("");
  const [bookingHistory, setBookingHistory] = useState<BookingRecord[]>([]);

  // History Tab Filters
  const [historySearch, setHistorySearch] = useState("");
  const [historyStatusFilter, setHistoryStatusFilter] = useState<"ALL" | "CONFIRMED" | "CANCELLED">("ALL");

  // Selected Target Shift for Booking
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);
  const [searchClass, setSearchClass] = useState("");

  // Manual Trial Booking Inputs
  const [trialTimeStart, setTrialTimeStart] = useState("18:00");
  const [trialTimeEnd, setTrialTimeEnd] = useState("19:30");
  const [trialTrack, setTrialTrack] = useState("KIDS / TEENS");

  // Google Sheets Trial Booking State
  const [sheetTabs, setSheetTabs] = useState<SheetTab[]>([]);
  const [selectedSheetGid, setSelectedSheetGid] = useState<string | null>(null);
  const [trialSlots, setTrialSlots] = useState<TrialSlot[]>([]);
  const [selectedTrialSlot, setSelectedTrialSlot] = useState<TrialSlot | null>(null);
  const [isFetchingSheet, setIsFetchingSheet] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [rowAssignedTeacher, setRowAssignedTeacher] = useState<Record<string, string>>({});
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Load Sheet Tabs on mount or when switching to trial subtab
  useEffect(() => {
    let isMounted = true;
    async function loadTabs() {
      try {
        const tabs = await fetchSheetTabs();
        if (!isMounted) return;
        setSheetTabs(tabs);

        // Auto match tab for current selectedDate
        const matched = findMatchingTabForDate(selectedDate, tabs);
        if (matched) {
          setSelectedSheetGid(matched.gid);
        } else if (tabs.length > 0) {
          setSelectedSheetGid(tabs[0].gid);
        }
      } catch (err) {
        console.error("Error fetching sheet tabs:", err);
      }
    }

    if (activeSubTab === "trial" && sheetTabs.length === 0) {
      loadTabs();
    }
  }, [activeSubTab, sheetTabs.length]);

  // Auto match sheet tab when selectedDate changes
  useEffect(() => {
    if (sheetTabs.length > 0) {
      const matched = findMatchingTabForDate(selectedDate, sheetTabs);
      if (matched && matched.gid !== selectedSheetGid) {
        setSelectedSheetGid(matched.gid);
      }
    }
  }, [selectedDate, sheetTabs]);

  // Load Trial Slots when selectedSheetGid changes
  const loadTrialSlots = async (gid: string) => {
    setIsFetchingSheet(true);
    setSheetError(null);
    try {
      const currentTab = sheetTabs.find((t) => t.gid === gid);
      const slots = await fetchAndParseTrialSlots(gid, SPREADSHEET_ID, currentTab?.name);
      setTrialSlots(slots);

      if (slots.length > 0) {
        const dateStr = format(selectedDate, "yyyy-MM-dd");
        const matchingSlot = slots.find((s) => s.dateStr === dateStr) || slots[0];
        setSelectedTrialSlot(matchingSlot);
      } else {
        setSelectedTrialSlot(null);
      }
    } catch (err: any) {
      setSheetError(err?.message || "Không thể đọc dữ liệu ca Trial từ Google Sheet.");
    } finally {
      setIsFetchingSheet(false);
    }
  };

  useEffect(() => {
    if (activeSubTab === "trial" && selectedSheetGid) {
      loadTrialSlots(selectedSheetGid);
    }
  }, [activeSubTab, selectedSheetGid]);

  // Confirmation Modal State
  const [bookingCandidate, setBookingCandidate] = useState<Teacher | null>(null);
  const [bookingNotes, setBookingNotes] = useState("");
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  // Teacher Candidate Group Collapse States
  const [isGroup1Collapsed, setIsGroup1Collapsed] = useState(false);
  const [isGroup2Collapsed, setIsGroup2Collapsed] = useState(false);

  // Custom Confirmation Dialog State (No native window.confirm/alert)
  const [actionConfirm, setActionConfirm] = useState<ActionConfirmState | null>(null);

  // Load persistent bookings
  useEffect(() => {
    setBookingHistory(getLocalBookings());
  }, []);

  // Request cancel booking modal
  const requestCancelBooking = (bookingId: string, recordTitle: string) => {
    setActionConfirm({
      isOpen: true,
      type: "CANCEL_BOOKING",
      bookingId,
      recordTitle,
    });
  };

  // Request delete single booking log modal
  const requestDeleteBooking = (bookingId: string, recordTitle: string) => {
    setActionConfirm({
      isOpen: true,
      type: "DELETE_BOOKING",
      bookingId,
      recordTitle,
    });
  };

  // Request clear all cancelled logs modal
  const requestClearCancelled = () => {
    setActionConfirm({
      isOpen: true,
      type: "CLEAR_CANCELLED",
    });
  };

  // Execute confirmed action
  const handleExecuteAction = () => {
    if (!actionConfirm) return;

    if (actionConfirm.type === "CANCEL_BOOKING" && actionConfirm.bookingId) {
      cancelBookingRecord(actionConfirm.bookingId);
    } else if (actionConfirm.type === "DELETE_BOOKING" && actionConfirm.bookingId) {
      deleteBookingRecord(actionConfirm.bookingId);
    } else if (actionConfirm.type === "CLEAR_CANCELLED") {
      clearCancelledBookings();
    }

    setBookingHistory(getLocalBookings());
    setActionConfirm(null);
  };

  // Future week navigation handlers
  const handlePrevWeek = () => {
    setSelectedDate((prev) => subWeeks(prev, 1));
  };

  const handleNextWeek = () => {
    setSelectedDate((prev) => addWeeks(prev, 1));
  };

  const handleTodayWeek = () => {
    setSelectedDate(new Date());
  };

  // Fetch LMS data
  const fetchData = async (date: Date) => {
    setIsLoading(true);
    setError(null);
    try {
      const monday = startOfWeek(date, { weekStartsOn: 1 });
      const sunday = endOfWeek(date, { weekStartsOn: 1 });
      const dateGte = monday.toISOString();
      const dateLte = sunday.toISOString();

      const fetchedTeachers = await LmsClient.getTeachers([DEFAULT_CENTRE_ID]);
      setTeachersList(fetchedTeachers);

      const teacherIds = fetchedTeachers.map((t: any) => t.id);

      const [teacherSchedules, centerSchedules] = await Promise.all([
        teacherIds.length > 0 ? LmsClient.getTeacherSchedules(teacherIds, dateGte, dateLte) : Promise.resolve([]),
        LmsClient.getCenterActiveSchedules(DEFAULT_CENTRE_ID, dateGte, dateLte).catch((err) => {
          console.warn("[TeacherBookingView] Failed to fetch center active schedules:", err);
          return [];
        }),
      ]);

      const map = new Map<string, Schedule>();

      // Add teacher schedules first
      (teacherSchedules || []).forEach((sch: any) => {
        if (sch && sch.id) {
          map.set(sch.id, sch);
        }
      });

      // Add center schedules (including unassigned slots for Buổi 1, etc.)
      (centerSchedules || []).forEach((sch: any) => {
        if (!sch || !sch.id) return;
        const classId = sch.classSite?.class?.id || sch.title;
        const dateStr = sch.startTime ? sch.startTime.split("T")[0] : sch.date;
        const startTime = sch.startTime;

        if (!map.has(sch.id)) {
          const existingForSlot = Array.from(map.values()).some((s) => {
            const sClassId = s.classSite?.class?.id || s.title;
            const sDateStr = s.startTime ? s.startTime.split("T")[0] : s.date;
            return sClassId === classId && sDateStr === dateStr && s.startTime === startTime;
          });

          if (!existingForSlot || sch.teacherRole === "CHƯA_GẮN_GV") {
            map.set(sch.id, sch);
          }
        }
      });

      setSchedules(Array.from(map.values()));
    } catch (err: any) {
      setError(err?.message || "Lỗi tải dữ liệu LMS.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData(selectedDate);
  }, [selectedDate]);

  // Helper date/time parsers
  const getLocalDateStr = (sch: Schedule) => {
    if (sch.startTime && sch.startTime.includes("T")) return extractDatePart(sch.startTime);
    if (sch.date) return extractDatePart(sch.date);
    return "";
  };

  const formatDisplayDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return "";
    const parts = dateStr.split("-");
    if (parts.length === 3 && parts[0].length === 4) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  const getLocalHHMM = (timeStr: string) => {
    const obj = extractHHMM(timeStr);
    if (!obj) return "";
    return `${String(obj.hours).padStart(2, "0")}:${String(obj.minutes).padStart(2, "0")}`;
  };

  const isScheduleAtDefaultCentre = (sch: any): boolean => {
    if (!sch) return false;

    // Check classSite centre ID
    const classCentreId = sch.classSite?.centre?.id;
    if (classCentreId) {
      return classCentreId === DEFAULT_CENTRE_ID;
    }

    // Check officeHour centre ID
    const officeCentreId = sch.officeHour?.centre?.id;
    if (officeCentreId) {
      return officeCentreId === DEFAULT_CENTRE_ID;
    }

    // Check centre name fallback if ID is missing
    const centreName = (
      sch.classSite?.centre?.name ||
      sch.officeHour?.centre?.name ||
      ""
    ).toLowerCase();

    if (centreName) {
      return (
        centreName.includes("230") ||
        centreName.includes("thủ dầu một") ||
        centreName.includes("thu dau mot") ||
        centreName.includes("dlbd")
      );
    }

    return true;
  };

  const isScheduleSuspendedOrCancelled = (sch: any): boolean => {
    if (!sch) return false;

    const classStatus = (sch.classStatus || "").toUpperCase().trim();
    if (
      classStatus === "PAUSED" ||
      classStatus === "STOPPED" ||
      classStatus === "SUSPENDED" ||
      classStatus === "CANCELLED" ||
      classStatus === "DROPPED" ||
      classStatus === "OFF"
    ) {
      return true;
    }

    const combinedText = `${sch.title || ""} ${sch.description || ""}`.toLowerCase();
    return (
      combinedText.includes("tạm ngưng") ||
      combinedText.includes("tam ngung") ||
      combinedText.includes("tạm dừng") ||
      combinedText.includes("tam dung") ||
      combinedText.includes("nghỉ học") ||
      combinedText.includes("nghi hoc") ||
      combinedText.includes("đã hủy") ||
      combinedText.includes("da huy") ||
      combinedText.includes("lớp dừng") ||
      combinedText.includes("lop dung") ||
      combinedText.includes("bão") ||
      combinedText.includes("[hủy]") ||
      combinedText.includes("[nghỉ]") ||
      combinedText.includes("[tạm ngưng]") ||
      combinedText.includes("cancelled") ||
      combinedText.includes("suspended") ||
      combinedText.includes("stopped") ||
      combinedText.includes("paused")
    );
  };

  // Extract Session 14 classes for Sub-tab 3 (Giám Khảo) - excluding suspended/cancelled & non-BU classes
  const session14Schedules = useMemo(() => {
    return schedules.filter((sch) => {
      if (sch.type !== "CLASS_SESSION") return false;
      if (!isScheduleAtDefaultCentre(sch)) return false;
      if (isScheduleSuspendedOrCancelled(sch)) return false;
      const sIdx = sch.sessionIndex || 1;
      const total = sch.totalSessions || 14;
      // Class is at Session 14 or final session
      return sIdx === 14 || (total > 1 && sIdx === total);
    });
  }, [schedules]);

  // Unique Class Schedules list (deduplicated by class session slot and sorted chronologically, excluding suspended/cancelled & non-BU classes)
  const uniqueClassSchedules = useMemo(() => {
    const source = activeSubTab === "examiner"
      ? session14Schedules
      : schedules.filter((s) => s.type === "CLASS_SESSION" && isScheduleAtDefaultCentre(s) && !isScheduleSuspendedOrCancelled(s));
    const map = new Map<string, Schedule>();

    source.forEach((sch) => {
      const classId = sch.classSite?.class?.id || sch.title;
      const dateStr = getLocalDateStr(sch);
      const startTime = getLocalHHMM(sch.startTime);
      const key = `${classId}_${dateStr}_${startTime}`;

      if (!map.has(key)) {
        map.set(key, sch);
      }
    });

    const list = Array.from(map.values());
    list.sort((a, b) => {
      const dateA = getLocalDateStr(a);
      const dateB = getLocalDateStr(b);
      if (dateA !== dateB) {
        return dateA.localeCompare(dateB);
      }
      const timeA = getLocalHHMM(a.startTime);
      const timeB = getLocalHHMM(b.startTime);
      return timeA.localeCompare(timeB);
    });

    return list;
  }, [activeSubTab, session14Schedules, schedules]);

  // Filtered Class Schedules by search query (class code or class name)
  const filteredClassSchedules = useMemo(() => {
    if (!searchClass.trim()) return uniqueClassSchedules;

    const q = searchClass.toLowerCase().trim();
    return uniqueClassSchedules.filter((sch) => {
      const className = (sch.classSite?.class?.name || sch.title || "").toLowerCase();
      const classId = (sch.classSite?.class?.id || "").toLowerCase();
      const desc = (sch.description || "").toLowerCase();
      const dateStr = getLocalDateStr(sch).toLowerCase();

      return (
        className.includes(q) ||
        classId.includes(q) ||
        desc.includes(q) ||
        dateStr.includes(q)
      );
    });
  }, [uniqueClassSchedules, searchClass]);

  // Teachers (LEC & TA) assigned to the selected class session
  const selectedClassTeachers = useMemo<{ lec: Teacher | null; ta: Teacher | null }>(() => {
    if (!selectedSchedule) return { lec: null, ta: null };

    const targetClassId = selectedSchedule.classSite?.class?.id;
    const targetTitle = selectedSchedule.title;
    const targetDate = getLocalDateStr(selectedSchedule);
    const targetStart = getLocalHHMM(selectedSchedule.startTime);

    const matching = schedules.filter((sch) => {
      if (sch.type !== "CLASS_SESSION") return false;
      if (getLocalDateStr(sch) !== targetDate) return false;
      if (getLocalHHMM(sch.startTime) !== targetStart) return false;

      if (targetClassId && sch.classSite?.class?.id) {
        return sch.classSite.class.id === targetClassId;
      }
      return sch.title === targetTitle;
    });

    let lecTeacher: Teacher | null = null;
    let taTeacher: Teacher | null = null;

    matching.forEach((sch) => {
      const teacherObj = teachersList.find((t) => t.id === sch.teacherId);
      if (!teacherObj) return;

      const roleUpper = (sch.teacherRole || "").toUpperCase();
      if (
        roleUpper.includes("TRỢ GIẢNG") ||
        roleUpper.includes("TA") ||
        roleUpper.includes("ASSISTANT") ||
        roleUpper.includes("TG")
      ) {
        taTeacher = teacherObj;
      } else {
        lecTeacher = teacherObj;
      }
    });

    if (!lecTeacher && selectedSchedule.teacherId) {
      lecTeacher = teachersList.find((t) => t.id === selectedSchedule.teacherId) || null;
    }

    return { lec: lecTeacher, ta: taTeacher };
  }, [selectedSchedule, schedules, teachersList]);

  // Auto select default schedule when switching subtabs or filtering (preferring upcoming/today's classes)
  useEffect(() => {
    if (activeSubTab === "substitute" || activeSubTab === "examiner") {
      const currentStillValid = selectedSchedule && filteredClassSchedules.some((s) => s.id === selectedSchedule.id);
      if (!currentStillValid) {
        const todayStr = format(new Date(), "yyyy-MM-dd");
        const firstUpcoming = filteredClassSchedules.find((s) => getLocalDateStr(s) >= todayStr);
        setSelectedSchedule(firstUpcoming || filteredClassSchedules[0] || null);
      }
    } else {
      setSelectedSchedule(null);
    }
  }, [activeSubTab, filteredClassSchedules]);

  // Target shift timing details
  const targetShiftDetails = useMemo(() => {
    if (activeSubTab === "trial") {
      if (selectedTrialSlot) {
        return {
          dateStr: selectedTrialSlot.dateStr || format(selectedDate, "yyyy-MM-dd"),
          displayDate: selectedTrialSlot.displayDate ? `${selectedTrialSlot.displayDate} (${selectedTrialSlot.day})` : format(selectedDate, "dd/MM/yyyy (EEEE)"),
          startTime: selectedTrialSlot.startTime,
          endTime: selectedTrialSlot.endTime,
          className: `Lớp Trial Sheet: ${selectedTrialSlot.track} (${selectedTrialSlot.format})`,
          primaryTeacherId: null,
          trialSlot: selectedTrialSlot,
        };
      }

      return {
        dateStr: format(selectedDate, "yyyy-MM-dd"),
        displayDate: format(selectedDate, "dd/MM/yyyy (EEEE)"),
        startTime: trialTimeStart,
        endTime: trialTimeEnd,
        className: `Lớp Trial ${trialTrack}`,
        primaryTeacherId: null,
      };
    }

    if (!selectedSchedule) return null;

    const dateStr = getLocalDateStr(selectedSchedule);
    const displayDate = formatDisplayDate(dateStr) || format(selectedDate, "dd/MM/yyyy");
    const startTime = getLocalHHMM(selectedSchedule.startTime);
    const endTime = getLocalHHMM(selectedSchedule.endTime);
    const className = selectedSchedule.classSite?.class?.name || selectedSchedule.title || "Lớp học";

    return {
      dateStr,
      displayDate,
      startTime,
      endTime,
      className,
      primaryTeacherId: selectedSchedule.teacherId,
    };
  }, [selectedSchedule, activeSubTab, selectedDate, selectedTrialSlot, trialTimeStart, trialTimeEnd, trialTrack]);

  // Check if target shift date has already passed
  const isTargetPastDate = useMemo(() => {
    if (!targetShiftDetails?.dateStr) return false;
    const todayStr = format(new Date(), "yyyy-MM-dd");
    return targetShiftDetails.dateStr < todayStr;
  }, [targetShiftDetails]);

  // Track teachers already booked for the target shift in realtime
  const currentShiftBookings = useMemo(() => {
    if (!targetShiftDetails) return new Map<string, BookingRecord>();

    const map = new Map<string, BookingRecord>();
    bookingHistory.forEach((rec) => {
      if (
        rec.status === "CONFIRMED" &&
        rec.dateStr === targetShiftDetails.dateStr &&
        rec.startTime === targetShiftDetails.startTime
      ) {
        map.set(rec.assignedTeacherId, rec);
      }
    });
    return map;
  }, [bookingHistory, targetShiftDetails]);

  // Filtered Booking History for Tab 4 (Lịch Sử Book)
  const filteredHistory = useMemo(() => {
    return bookingHistory.filter((rec) => {
      if (historyStatusFilter !== "ALL" && rec.status !== historyStatusFilter) return false;

      if (historySearch.trim()) {
        const q = historySearch.toLowerCase();
        const matchClass = rec.className.toLowerCase().includes(q);
        const matchTeacher =
          rec.assignedTeacherName.toLowerCase().includes(q) ||
          rec.assignedTeacherCode.toLowerCase().includes(q);
        const matchNotes = (rec.notes || "").toLowerCase().includes(q);
        const matchDate = rec.dateStr.includes(q);
        return matchClass || matchTeacher || matchNotes || matchDate;
      }

      return true;
    });
  }, [bookingHistory, historySearch, historyStatusFilter]);

  // Teacher Recommendations Algorithm
  // Group 1: At BU Thủ Dầu Một on that day & Free at shift time
  // Group 2: Not at BU Thủ Dầu Một on that day & Free at shift time
  const teacherRecommendations = useMemo(() => {
    if (!targetShiftDetails || !targetShiftDetails.dateStr || !targetShiftDetails.startTime) {
      return { groupAtBU: [], groupNotAtBU: [] };
    }

    const { dateStr, startTime, endTime, primaryTeacherId } = targetShiftDetails;

    const groupAtBU: { teacher: Teacher; daySessionsCount: number; weeklyHours: string }[] = [];
    const groupNotAtBU: { teacher: Teacher; daySessionsCount: number; weeklyHours: string }[] = [];

    teachersList.forEach((t) => {
      // Sub-tab 3 Objectivity Rule: Exclude primary teacher from examiner candidates
      if (activeSubTab === "examiner" && primaryTeacherId && t.id === primaryTeacherId) {
        return;
      }

      // Filter by search query if any
      if (searchTeacher.trim()) {
        const q = searchTeacher.toLowerCase();
        const match = t.fullName.toLowerCase().includes(q) || t.code.toLowerCase().includes(q);
        if (!match) return;
      }

      // Teacher's schedules on this date
      const teacherDaySchedules = schedules.filter((s) => {
        if (s.teacherId !== t.id) return false;
        return getLocalDateStr(s) === dateStr;
      });

      // Filter out suspended/cancelled classes for presence & conflict calculation
      const activeTeacherDaySchedules = teacherDaySchedules.filter((s) => !isScheduleSuspendedOrCancelled(s));

      // Filter active schedules specifically AT BU Thủ Dầu Một
      const activeTeacherBUDaySchedules = activeTeacherDaySchedules.filter((s) => isScheduleAtDefaultCentre(s));

      // Check if candidate has schedule conflict during target shift (from active LMS schedules across any centre)
      const hasLmsConflict = activeTeacherDaySchedules.some((s) => {
        const sStart = getLocalHHMM(s.startTime);
        const sEnd = getLocalHHMM(s.endTime);
        if (!sStart || !sEnd) return false;
        // Overlap check
        return sStart < endTime && startTime < sEnd;
      });

      // Check if candidate has overlapping CONFIRMED booking in history (Substitute, Trial, Examiner)
      const hasHistoryOverlap = bookingHistory.some((rec) => {
        if (rec.status !== "CONFIRMED") return false;
        if (rec.assignedTeacherId !== t.id) return false;
        if (rec.dateStr !== dateStr) return false;

        // If it's the exact same booking for this target schedule, don't treat as collision so "Đã Book" badge displays
        if (selectedSchedule?.id && rec.scheduleId === selectedSchedule.id) return false;
        if (activeSubTab === "trial" && rec.type === "trial" && rec.startTime === startTime && rec.endTime === endTime) {
          return false;
        }

        // Time overlap check: recStart < targetEnd && targetStart < recEnd
        return rec.startTime < endTime && startTime < rec.endTime;
      });

      // If occupied at this time (active LMS schedule OR confirmed booking history) -> Exclude
      if (hasLmsConflict || hasHistoryOverlap) return;

      // Check if candidate has active (non-suspended) classes AT BU Thủ Dầu Một on this date
      const isAtBU = activeTeacherBUDaySchedules.length > 0;

      // Calculate total weekly active hours for workload indicator
      const teacherAllActiveSchedules = schedules.filter(
        (s) => s.teacherId === t.id && !isScheduleSuspendedOrCancelled(s)
      );
      let totalMins = 0;
      teacherAllActiveSchedules.forEach((s) => {
        if (s.startTime && s.endTime) {
          try {
            const st = new Date(s.startTime).getTime();
            const et = new Date(s.endTime).getTime();
            if (et > st) totalMins += (et - st) / (1000 * 60);
          } catch {}
        }
      });
      const h = Math.floor(totalMins / 60);
      const weeklyHoursStr = `${h}h`;

      const candidateObj = {
        teacher: t,
        daySessionsCount: activeTeacherBUDaySchedules.length,
        weeklyHours: weeklyHoursStr,
      };

      if (isAtBU) {
        groupAtBU.push(candidateObj);
      } else {
        groupNotAtBU.push(candidateObj);
      }
    });

    return { groupAtBU, groupNotAtBU };
  }, [teachersList, schedules, targetShiftDetails, searchTeacher, activeSubTab, bookingHistory, selectedSchedule]);

  // Evaluates recommended teachers for any specific trial slot in Sheet Table View
  const getSlotRecommendations = (slot: TrialSlot) => {
    const { dateStr, startTime, endTime } = slot;
    if (!dateStr || !startTime || !endTime) return { groupAtBU: [], groupNotAtBU: [], bestTeacherId: null };

    const groupAtBU: { teacher: Teacher; daySessionsCount: number }[] = [];
    const groupNotAtBU: { teacher: Teacher; daySessionsCount: number }[] = [];

    teachersList.forEach((t) => {
      // Filter by search query if any
      if (searchTeacher.trim()) {
        const q = searchTeacher.toLowerCase();
        if (!t.fullName.toLowerCase().includes(q) && !t.code.toLowerCase().includes(q)) return;
      }

      // Teacher schedules on dateStr
      const teacherDaySchedules = schedules.filter((s) => {
        if (s.teacherId !== t.id) return false;
        return getLocalDateStr(s) === dateStr;
      });

      const activeTeacherDaySchedules = teacherDaySchedules.filter((s) => !isScheduleSuspendedOrCancelled(s));
      const activeTeacherBUDaySchedules = activeTeacherDaySchedules.filter((s) => isScheduleAtDefaultCentre(s));

      // Overlap check on active LMS schedules
      const hasLmsConflict = activeTeacherDaySchedules.some((s) => {
        const sStart = getLocalHHMM(s.startTime);
        const sEnd = getLocalHHMM(s.endTime);
        if (!sStart || !sEnd) return false;
        return sStart < endTime && startTime < sEnd;
      });

      // Overlap check on confirmed booking history
      const hasHistoryOverlap = bookingHistory.some((rec) => {
        if (rec.status !== "CONFIRMED") return false;
        if (rec.assignedTeacherId !== t.id) return false;
        if (rec.dateStr !== dateStr) return false;
        return rec.startTime < endTime && startTime < rec.endTime;
      });

      if (hasLmsConflict || hasHistoryOverlap) return;

      const isAtBU = activeTeacherBUDaySchedules.length > 0;
      const candidateObj = {
        teacher: t,
        daySessionsCount: activeTeacherBUDaySchedules.length,
      };

      if (isAtBU) {
        groupAtBU.push(candidateObj);
      } else {
        groupNotAtBU.push(candidateObj);
      }
    });

    const bestTeacherId = groupAtBU.length > 0 ? groupAtBU[0].teacher.id : groupNotAtBU.length > 0 ? groupNotAtBU[0].teacher.id : null;

    return { groupAtBU, groupNotAtBU, bestTeacherId };
  };

  // Assigns selected candidate teacher to a trial slot (or full 3h shift group of matching track)
  const handleAssignTeacherToSlot = (slot: TrialSlot, teacherId: string, assignFullShift: boolean = false) => {
    const teacher = teachersList.find((t) => t.id === teacherId);
    if (!teacher) return;

    const targetSlots = assignFullShift ? getShiftGroupSlots(slot, trialSlots) : [slot];
    let assignedCount = 0;

    targetSlots.forEach((s) => {
      const isAlreadyBooked = bookingHistory.some(
        (rec) =>
          rec.status === "CONFIRMED" &&
          rec.type === "trial" &&
          rec.dateStr === s.dateStr &&
          rec.startTime === s.startTime &&
          rec.className.includes(s.track)
      );

      if (!isAlreadyBooked) {
        saveBookingRecord({
          type: "trial",
          className: `Lớp Trial Sheet: ${s.track} (${s.format})`,
          dateStr: s.dateStr,
          startTime: s.startTime,
          endTime: s.endTime,
          centreName: TARGET_CENTRE_NAME,
          assignedTeacherId: teacher.id,
          assignedTeacherName: teacher.fullName,
          assignedTeacherCode: teacher.code,
          notes: s.notes ? `Sheet note: ${s.notes}` : `Ca Trial ${s.track}`,
          status: "CONFIRMED",
        });
        assignedCount++;
      }
    });

    setBookingHistory(getLocalBookings());

    if (assignedCount > 1) {
      setToastMessage(`Đã chốt book GV ${teacher.fullName} cho CẢ CA 3H (${assignedCount} ca Trial ${slot.track}) ngày ${slot.displayDate || slot.dateStr}!`);
    } else {
      setToastMessage(`Đã chốt book GV ${teacher.fullName} cho ca Trial ${slot.track} (${slot.displayDate || slot.dateStr})!`);
    }
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Batch auto-assign optimal teachers for all unassigned trial slots in the sheet, grouping 3h shifts of matching tracks
  const handleAutoAssignAllTrialSlots = () => {
    let count = 0;
    const processedSlotIds = new Set<string>();

    // Step 1: Process 3-hour shift blocks of matching tracks first
    trialSlots.forEach((slot) => {
      if (processedSlotIds.has(slot.id)) return;

      const group = getShiftGroupSlots(slot, trialSlots);
      const unbookedGroup = group.filter(
        (s) =>
          !bookingHistory.some(
            (rec) =>
              rec.status === "CONFIRMED" &&
              rec.type === "trial" &&
              rec.dateStr === s.dateStr &&
              rec.startTime === s.startTime &&
              rec.className.includes(s.track)
          )
      );

      if (unbookedGroup.length > 1) {
        // Find best teacher who is available for ALL slots in the 3-hour group
        let optimalTeacherId: string | null = null;
        const { groupAtBU, groupNotAtBU } = getSlotRecommendations(slot);
        const candidates = [...groupAtBU, ...groupNotAtBU];

        for (const cand of candidates) {
          const tId = cand.teacher.id;
          const isFreeForGroup = unbookedGroup.every((s) => {
            const recs = getSlotRecommendations(s);
            return (
              recs.groupAtBU.some((c) => c.teacher.id === tId) ||
              recs.groupNotAtBU.some((c) => c.teacher.id === tId)
            );
          });

          if (isFreeForGroup) {
            optimalTeacherId = tId;
            break;
          }
        }

        if (optimalTeacherId) {
          const teacher = teachersList.find((t) => t.id === optimalTeacherId);
          if (teacher) {
            unbookedGroup.forEach((s) => {
              saveBookingRecord({
                type: "trial",
                className: `Lớp Trial Sheet: ${s.track} (${s.format})`,
                dateStr: s.dateStr,
                startTime: s.startTime,
                endTime: s.endTime,
                centreName: TARGET_CENTRE_NAME,
                assignedTeacherId: teacher.id,
                assignedTeacherName: teacher.fullName,
                assignedTeacherCode: teacher.code,
                notes: s.notes ? `Sheet note: ${s.notes}` : `Ca Trial ${s.track}`,
                status: "CONFIRMED",
              });
              processedSlotIds.add(s.id);
              count++;
            });
          }
        }
      }
    });

    // Step 2: Process remaining single slots
    trialSlots.forEach((slot) => {
      if (processedSlotIds.has(slot.id)) return;

      const isAlreadyBooked = bookingHistory.some(
        (rec) =>
          rec.status === "CONFIRMED" &&
          rec.type === "trial" &&
          rec.dateStr === slot.dateStr &&
          rec.startTime === slot.startTime &&
          rec.className.includes(slot.track)
      );

      if (!isAlreadyBooked) {
        const { bestTeacherId } = getSlotRecommendations(slot);
        const selectedId = rowAssignedTeacher[slot.id] || bestTeacherId;
        if (selectedId) {
          const teacher = teachersList.find((t) => t.id === selectedId);
          if (teacher) {
            saveBookingRecord({
              type: "trial",
              className: `Lớp Trial Sheet: ${slot.track} (${slot.format})`,
              dateStr: slot.dateStr,
              startTime: slot.startTime,
              endTime: slot.endTime,
              centreName: TARGET_CENTRE_NAME,
              assignedTeacherId: teacher.id,
              assignedTeacherName: teacher.fullName,
              assignedTeacherCode: teacher.code,
              notes: slot.notes ? `Sheet note: ${slot.notes}` : `Ca Trial ${slot.track}`,
              status: "CONFIRMED",
            });
            count++;
          }
        }
      }
    });

    setBookingHistory(getLocalBookings());
    if (count > 0) {
      setToastMessage(`Tự động chốt book thành công ${count} ca Trial cho các giảng viên phù hợp nhất (ưu tiên ghép ca 3h trùng môn)!`);
      setTimeout(() => setToastMessage(null), 4000);
    } else {
      setToastMessage("Tất cả các ca Trial đều đã được gắn GV hoặc không có GV rảnh.");
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  // Handle confirming a booking
  const handleConfirmBooking = () => {
    if (!bookingCandidate || !targetShiftDetails || isTargetPastDate) return;

    saveBookingRecord({
      type: activeSubTab === "history" ? "substitute" : activeSubTab,
      scheduleId: selectedSchedule?.id,
      className: targetShiftDetails.className,
      dateStr: targetShiftDetails.dateStr,
      startTime: targetShiftDetails.startTime,
      endTime: targetShiftDetails.endTime,
      centreName: TARGET_CENTRE_NAME,
      assignedTeacherId: bookingCandidate.id,
      assignedTeacherName: bookingCandidate.fullName,
      assignedTeacherCode: bookingCandidate.code,
      notes: bookingNotes,
      status: "CONFIRMED",
    });

    setBookingHistory(getLocalBookings());
    setIsConfirmOpen(false);
    setBookingCandidate(null);
    setBookingNotes("");
  };

  const weekStr = `${format(startOfWeek(selectedDate, { weekStartsOn: 1 }), "dd/MM/yy")} - ${format(endOfWeek(selectedDate, { weekStartsOn: 1 }), "dd/MM/yy")}`;

  return (
    <div className="p-2 sm:p-4 space-y-3 h-full flex flex-col bg-background text-foreground font-sans overflow-hidden relative">
      {/* MindX Top Loading / Brand Line */}
      <div className="h-[2.5px] w-full bg-muted/40 shrink-0 rounded-full overflow-hidden relative">
        <div
          className={`h-full w-full bg-mindx-accent-gradient rounded-full ${
            isLoading ? "animate-top-loader" : "transition-all duration-300"
          }`}
        />
      </div>

      {/* Top Header & Sub-Tabs Navigation */}
      <div className="flex flex-col gap-2 shrink-0 border-b border-border pb-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-sm sm:text-base font-black text-foreground flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-primary" />
              <span>BU Book Giáo Viên</span>
            </h1>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Cơ sở mặc định: <strong className="text-primary">{TARGET_CENTRE_NAME}</strong>
            </p>
          </div>

          {/* Sub-Tabs Pill Navigation */}
          <div className="flex items-center bg-muted/80 p-1 rounded-xl border border-border/80 shadow-2xs overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setActiveSubTab("substitute")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                activeSubTab === "substitute"
                  ? "bg-[#000056] text-white shadow-xs font-black"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Repeat className="h-3.5 w-3.5" />
              <span>1. Book Dạy Thay</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab("trial")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                activeSubTab === "trial"
                  ? "bg-[#000056] text-white shadow-xs font-black"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <FlaskConical className="h-3.5 w-3.5" />
              <span>2. Book Ca Trial</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab("examiner")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                activeSubTab === "examiner"
                  ? "bg-[#000056] text-white shadow-xs font-black"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Award className="h-3.5 w-3.5" />
              <span>3. Book Giám Khảo (Buổi 14)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab("history")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                activeSubTab === "history"
                  ? "bg-[#000056] text-white shadow-xs font-black"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <History className="h-3.5 w-3.5" />
              <span>4. Lịch Sử Book ({bookingHistory.length})</span>
            </button>
          </div>
        </div>

        {/* Future Week Navigation Toolbar (Applies to all booking sub-tabs) */}
        {activeSubTab !== "history" && (
          <div className="flex flex-wrap items-center justify-between gap-2 bg-muted/40 p-2 rounded-xl border border-border/80 text-xs">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-bold text-muted-foreground mr-1 hidden sm:inline">
                Chọn Tuần Book:
              </span>

              <Button
                variant="outline"
                size="sm"
                onClick={handlePrevWeek}
                className="h-7 px-2 text-xs font-bold text-muted-foreground hover:text-foreground flex items-center gap-1 bg-background"
                title="Quay lại tuần trước"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                <span>Tuần Trước</span>
              </Button>

              <Button
                variant={
                  isSameDay(
                    startOfWeek(selectedDate, { weekStartsOn: 1 }),
                    startOfWeek(new Date(), { weekStartsOn: 1 })
                  )
                    ? "default"
                    : "outline"
                }
                size="sm"
                onClick={handleTodayWeek}
                className={`h-7 px-2.5 text-xs font-bold ${
                  isSameDay(
                    startOfWeek(selectedDate, { weekStartsOn: 1 }),
                    startOfWeek(new Date(), { weekStartsOn: 1 })
                  )
                    ? "bg-[#000056] text-white shadow-2xs"
                    : "bg-background text-muted-foreground hover:text-foreground"
                }`}
              >
                Tuần Này
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleNextWeek}
                className="h-7 px-2 text-xs font-bold text-primary border-primary/30 hover:bg-primary/5 flex items-center gap-1 bg-background"
                title="Chuyển sang tuần tiếp theo"
              >
                <span>Tuần Sau</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedDate((prev) => addWeeks(prev, 2))}
                className="h-7 px-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 flex items-center gap-1 bg-background"
                title="Chuyển nhanh tới 2 tuần sau"
              >
                <span>+2 Tuần Sau</span>
              </Button>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-extrabold text-[11px] text-foreground flex items-center gap-1.5 bg-background px-2.5 py-1 rounded-lg border border-border">
                <Calendar className="h-3.5 w-3.5 text-primary" />
                <span>Đang Xem Tuần: <strong className="text-primary font-mono">{weekStr}</strong></span>
              </span>

              <div className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground">
                <span>Chọn Ngày:</span>
                <DatePickerDropdown
                  selectedDate={selectedDate}
                  onSelect={(d) => setSelectedDate(d)}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {activeSubTab === "history" ? (
        /* DEDICATED SUB-TAB 4: Lịch Sử Book */
        <div className="flex-1 flex flex-col bg-card border border-border rounded-xl shadow-2xs overflow-hidden">
          {/* History Toolbar Header */}
          <div className="p-3 bg-muted/60 border-b border-border flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2">
              <ListOrdered className="h-5 w-5 text-primary" />
              <div>
                <h2 className="text-xs font-bold text-foreground">Nhật Ký & Lịch Sử Book Nhân Sự</h2>
                <p className="text-[10.5px] text-muted-foreground mt-0.5">
                  Tổng số: <strong>{bookingHistory.length}</strong> lượt book (
                  <span className="text-emerald-600 font-bold">{bookingHistory.filter((r) => r.status === "CONFIRMED").length} Đã chốt</span>
                  , <span className="text-rose-600 font-bold">{bookingHistory.filter((r) => r.status === "CANCELLED").length} Đã hủy</span>)
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Status Filter Buttons */}
              <div className="flex items-center bg-background p-0.5 rounded-lg border border-border text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setHistoryStatusFilter("ALL")}
                  className={`px-2.5 py-1 rounded-md transition-all ${
                    historyStatusFilter === "ALL"
                      ? "bg-[#000056] text-white shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Tất cả ({bookingHistory.length})
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryStatusFilter("CONFIRMED")}
                  className={`px-2.5 py-1 rounded-md transition-all ${
                    historyStatusFilter === "CONFIRMED"
                      ? "bg-emerald-600 text-white shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Đã chốt ({bookingHistory.filter((r) => r.status === "CONFIRMED").length})
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryStatusFilter("CANCELLED")}
                  className={`px-2.5 py-1 rounded-md transition-all ${
                    historyStatusFilter === "CANCELLED"
                      ? "bg-rose-600 text-white shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Đã hủy ({bookingHistory.filter((r) => r.status === "CANCELLED").length})
                </button>
              </div>

              {/* Bulk Clear Cancelled Logs Button */}
              {bookingHistory.some((r) => r.status === "CANCELLED") && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={requestClearCancelled}
                  className="h-8 px-2.5 text-xs font-bold text-rose-600 border-rose-200 hover:bg-rose-50 hover:text-rose-700 dark:border-rose-900/50 dark:hover:bg-rose-950/40 rounded-lg flex items-center gap-1"
                  title="Xóa tất cả các nhật ký ca đã hủy"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Xóa Logs Đã Hủy</span>
                </Button>
              )}

              {/* Search Bar */}
              <div className="relative w-52">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Tìm theo ca, GV, mã..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  className="pl-8 h-8 text-xs bg-background"
                />
              </div>
            </div>
          </div>

          {/* History Data Table */}
          <div className="flex-1 overflow-y-auto p-3">
            {filteredHistory.length === 0 ? (
              <div className="p-12 text-center text-xs text-muted-foreground">
                <ListOrdered className="h-10 w-10 mx-auto opacity-30 mb-2" />
                <span>Chưa tìm thấy nhật ký đặt ca nào phù hợp.</span>
              </div>
            ) : (
              <div className="border border-border rounded-lg overflow-hidden bg-card text-xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-muted/70 text-muted-foreground font-bold border-b border-border text-[11px]">
                      <th className="p-2.5">Tên Lớp / Ca Dạy</th>
                      <th className="p-2.5">Loại Book</th>
                      <th className="p-2.5">Thời Gian</th>
                      <th className="p-2.5">Giảng Viên Phân Công</th>
                      <th className="p-2.5">Ghi Chú</th>
                      <th className="p-2.5">Trạng Thái</th>
                      <th className="p-2.5 text-right">Thao Tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredHistory.map((rec) => (
                      <tr key={rec.id} className="hover:bg-muted/40 transition-colors">
                        <td className="p-2.5 font-bold text-foreground">{rec.className}</td>
                        <td className="p-2.5">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-muted text-foreground border border-border">
                            {rec.type === "substitute" ? "Dạy Thay" : rec.type === "trial" ? "Ca Trial" : "Giám Khảo (B14)"}
                          </span>
                        </td>
                        <td className="p-2.5 font-mono text-[11px]">
                          {formatDisplayDate(rec.dateStr)} <span className="text-muted-foreground">({rec.startTime} - {rec.endTime})</span>
                        </td>
                        <td className="p-2.5">
                          <strong className="text-foreground">{rec.assignedTeacherName}</strong>
                          <span className="font-mono text-[10.5px] text-muted-foreground ml-1">({rec.assignedTeacherCode})</span>
                        </td>
                        <td className="p-2.5 text-muted-foreground italic text-[11px]">
                          {rec.notes || "—"}
                        </td>
                        <td className="p-2.5">
                          <span
                            className={`px-2 py-0.5 rounded-full font-bold text-[9.5px] inline-flex items-center gap-1 ${
                              rec.status === "CONFIRMED"
                                ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                                : "bg-rose-500/10 text-rose-600 border border-rose-500/20"
                            }`}
                          >
                            {rec.status === "CONFIRMED" ? "Đã Chốt Book" : "Đã Hủy"}
                          </span>
                        </td>
                        <td className="p-2.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {rec.status === "CONFIRMED" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => requestCancelBooking(rec.id, `${rec.className} — ${rec.assignedTeacherName}`)}
                                className="h-7 px-2 text-xs font-bold text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-lg"
                                title="Hủy ca book này"
                              >
                                <XCircle className="h-3.5 w-3.5 mr-1" />
                                Hủy Book
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => requestDeleteBooking(rec.id, `${rec.className} — ${rec.assignedTeacherName}`)}
                              className="h-7 px-2 text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg"
                              title="Xóa vĩnh viễn dòng nhật ký này"
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-1" />
                              Xóa Log
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : activeSubTab === "trial" ? (
        /* DEDICATED SUB-TAB 2: FULL GOOGLE SHEETS TRIAL TABLE VIEW WITH SMART AUTO-MATCH */
        <div className="flex-1 flex flex-col bg-card border border-border rounded-xl shadow-2xs overflow-hidden">
          {/* Toast Notification Banner */}
          {toastMessage && (
            <div className="bg-emerald-600 text-white text-xs font-bold px-4 py-2 flex items-center justify-between shadow-md animate-in fade-in slide-in-from-top duration-200">
              <span className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 shrink-0" />
                <span>{toastMessage}</span>
              </span>
              <button onClick={() => setToastMessage(null)} className="text-white hover:text-emerald-200 font-bold p-0.5" title="Đóng">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Sheet Table Header Toolbar */}
          <div className="p-3 bg-muted/60 border-b border-border flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              <div>
                <h2 className="text-xs font-black text-foreground flex items-center gap-1.5">
                  <span>Bảng Ca Dạy Trial Từ Google Sheet</span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[10px] font-bold">
                    {trialSlots.length} Ca Trial
                  </span>
                </h2>
                <p className="text-[10.5px] text-muted-foreground mt-0.5">
                  Đang xem Sheet: <strong className="text-foreground">{sheetTabs.find((t) => t.gid === selectedSheetGid)?.name || "Tuần này"}</strong>
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Batch Auto Assign All Button */}
              {trialSlots.length > 0 && (
                <Button
                  size="sm"
                  onClick={handleAutoAssignAllTrialSlots}
                  className="h-8 px-3 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs rounded-lg flex items-center gap-1.5"
                  title="Tự động phân công giảng viên phù hợp nhất cho tất cả các ca Trial chưa chốt"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Tự Động Gắn Tất Cả Ca</span>
                </Button>
              )}

              {/* Sheet Dropdown */}
              <Select
                value={selectedSheetGid || ""}
                onValueChange={(val) => setSelectedSheetGid(val)}
              >
                <SelectTrigger className="h-8 text-xs font-bold w-[280px] bg-card border-border rounded-lg shadow-2xs">
                  <SelectValue placeholder="Chọn tuần..." />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectGroup>
                    <SelectLabel className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      Danh sách Tab Sheet
                    </SelectLabel>
                    {sheetTabs.map((tab) => {
                      const isAuto = findMatchingTabForDate(selectedDate, [tab]) !== null;
                      return (
                        <SelectItem key={tab.gid} value={tab.gid} className="text-xs font-bold py-1.5 cursor-pointer">
                          <div className="flex items-center justify-between w-full gap-2">
                            <span>{tab.name}</span>
                            {isAuto && (
                              <span className="text-[9.5px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 font-extrabold border border-emerald-500/20">
                                Tự động
                              </span>
                            )}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectGroup>
                </SelectContent>
              </Select>

              {/* Refresh Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => selectedSheetGid && loadTrialSlots(selectedSheetGid)}
                className="h-8 px-2 text-xs font-bold"
                title="Tải lại dữ liệu từ Google Sheet"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isFetchingSheet ? "animate-spin text-primary" : ""}`} />
              </Button>

              {/* Link Sheet Gốc */}
              {selectedSheetGid && (
                <a
                  href={`https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/htmlview?gid=${selectedSheetGid}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-8 px-2.5 bg-muted/80 hover:bg-muted border border-border rounded-lg text-xs font-bold text-primary flex items-center gap-1"
                  title="Mở Google Sheet trên tab mới"
                >
                  <span>Link Sheet Gốc</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>

          {/* Interactive Sheet Table Body */}
          <div className="flex-1 overflow-y-auto p-3">
            {isFetchingSheet ? (
              <div className="p-16 text-center text-xs text-muted-foreground">
                <RefreshCw className="h-8 w-8 mx-auto animate-spin text-primary mb-2" />
                <span>Đang tải và phân tích dữ liệu ca Trial từ Google Sheet...</span>
              </div>
            ) : sheetError ? (
              <div className="p-6 rounded-lg bg-rose-50 dark:bg-rose-950/30 text-rose-600 border border-rose-200 dark:border-rose-900 text-xs">
                <p className="font-bold flex items-center gap-1 mb-1">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>Lỗi đọc dữ liệu Google Sheet</span>
                </p>
                <p className="text-[11px]">{sheetError}</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => selectedSheetGid && loadTrialSlots(selectedSheetGid)}
                  className="mt-2 h-7 text-xs font-bold"
                >
                  Thử Lại
                </Button>
              </div>
            ) : trialSlots.length === 0 ? (
              <div className="p-16 text-center text-xs text-muted-foreground">
                <Calendar className="h-10 w-10 mx-auto opacity-30 mb-2" />
                <span>Không tìm thấy ca Trial nào trên Sheet này.</span>
              </div>
            ) : (
              <div className="border border-border rounded-lg overflow-hidden bg-card text-xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-muted/70 text-muted-foreground font-bold border-b border-border text-[11px]">
                      <th className="p-2.5 w-32">Thứ & Ngày</th>
                      <th className="p-2.5 w-28">Khung Giờ</th>
                      <th className="p-2.5 w-32">Môn & Hình Thức</th>
                      <th className="p-2.5">Học Viên Đăng Ký</th>
                      <th className="p-2.5">Ghi Chú Kit / Thiết Bị</th>
                      <th className="p-2.5 w-80">Gợi Ý Giáo Viên Hợp Lý</th>
                      <th className="p-2.5 text-right w-36">Thao Tác Gắn GV</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {trialSlots.map((slot) => {
                      const todayStr = format(new Date(), "yyyy-MM-dd");
                      const isPastDate = Boolean(slot.dateStr && slot.dateStr < todayStr);

                      // Check if slot is already booked in confirmed history
                      const bookedRecord = bookingHistory.find(
                        (rec) =>
                          rec.status === "CONFIRMED" &&
                          rec.type === "trial" &&
                          rec.dateStr === slot.dateStr &&
                          rec.startTime === slot.startTime &&
                          rec.className.includes(slot.track)
                      );

                      const { groupAtBU, groupNotAtBU, bestTeacherId } = getSlotRecommendations(slot);
                      const selectedTeacherId = rowAssignedTeacher[slot.id] || bestTeacherId || "";

                      return (
                        <tr
                          key={slot.id}
                          className={`hover:bg-muted/40 transition-colors ${
                            bookedRecord ? "bg-emerald-500/5" : isPastDate ? "opacity-75 bg-muted/20" : ""
                          }`}
                        >
                          {/* Thứ & Ngày */}
                          <td className="p-2.5 font-bold text-foreground">
                            <div className="flex flex-col">
                              <span className="text-xs">{slot.day}</span>
                              <span className="font-mono text-[10.5px] text-muted-foreground">{slot.displayDate || slot.dateStr}</span>
                            </div>
                          </td>

                          {/* Khung Giờ */}
                          <td className="p-2.5 font-mono text-[11px] font-extrabold text-primary">
                            <div className="flex flex-col">
                              <span>{slot.startTime} - {slot.endTime}</span>
                              <span className="text-[9.5px] font-normal text-muted-foreground">({slot.timeRaw})</span>
                            </div>
                          </td>

                          {/* Môn & Hình Thức */}
                          <td className="p-2.5">
                            <span className="font-bold text-xs text-foreground block">{slot.track}</span>
                            <div className="flex flex-wrap items-center gap-1 mt-0.5">
                              <span className="px-1.5 py-0.2 bg-[#000056] text-white rounded text-[8.5px] font-bold inline-block">
                                {slot.format}
                              </span>
                              {getShiftGroupSlots(slot, trialSlots).length > 1 && (
                                <span
                                  className="px-1.5 py-0.2 bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20 rounded text-[8.5px] font-extrabold flex items-center gap-1 shrink-0"
                                  title={`Ca 3 tiếng liên tục trùng môn ${slot.track} (${getShiftGroupSlots(slot, trialSlots).length} ca)`}
                                >
                                  <Layers className="h-2.5 w-2.5 text-purple-600 shrink-0" />
                                  <span>Ca 3h trùng môn ({getShiftGroupSlots(slot, trialSlots).length} ca)</span>
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Học Viên Đăng Ký */}
                          <td className="p-2.5 text-[11px]">
                            {slot.students.length === 0 ? (
                              <span className="text-muted-foreground italic">—</span>
                            ) : (
                              <div className="space-y-0.5">
                                <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                                  <Users className="h-3 w-3" /> {slot.students.length} Học viên:
                                </span>
                                {slot.students.map((st, i) => (
                                  <p key={i} className="font-mono text-[10px] text-muted-foreground line-clamp-1">• {st}</p>
                                ))}
                              </div>
                            )}
                          </td>

                          {/* Ghi Chú Kit / Thiết Bị */}
                          <td className="p-2.5 text-[11px]">
                            {slot.notes ? (
                              <div className="p-1.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-[10px] font-bold flex items-start gap-1">
                                <Info className="h-3 w-3 shrink-0 mt-0.5" />
                                <span>{slot.notes}</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground italic">—</span>
                            )}
                          </td>

                          {/* Gợi Ý Giáo Viên Hợp Lý */}
                          <td className="p-2.5">
                            {bookedRecord ? (
                              <div className="flex items-center gap-1.5 p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold">
                                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                                <div>
                                  <span>{bookedRecord.assignedTeacherName}</span>
                                  <span className="font-mono text-[10px] text-muted-foreground ml-1">({bookedRecord.assignedTeacherCode})</span>
                                </div>
                              </div>
                            ) : (
                              <Select
                                value={selectedTeacherId || ""}
                                onValueChange={(val) =>
                                  setRowAssignedTeacher((prev) => ({
                                    ...prev,
                                    [slot.id]: val,
                                  }))
                                }
                              >
                                <SelectTrigger className="w-full h-8 text-xs font-bold min-w-[280px] bg-card border-border rounded-lg shadow-2xs">
                                  <SelectValue placeholder="Chọn giáo viên dạy ca này..." />
                                </SelectTrigger>
                                <SelectContent className="max-h-64 z-[100]">
                                  {groupAtBU.length === 0 && groupNotAtBU.length === 0 ? (
                                    <div className="p-3 text-center text-xs text-muted-foreground italic font-semibold">
                                      Không có GV rảnh khung giờ này
                                    </div>
                                  ) : (
                                    <>
                                      {groupAtBU.length > 0 && (
                                        <SelectGroup>
                                          <SelectLabel className="text-[10.5px] font-extrabold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded my-0.5 border border-emerald-500/20">
                                            [Ưu Tiên 1] GV Có Mặt Tại BU
                                          </SelectLabel>
                                          {groupAtBU.map((c) => (
                                            <SelectItem key={c.teacher.id} value={c.teacher.id} className="text-xs font-semibold py-1.5 cursor-pointer">
                                              <div className="flex items-center justify-between w-full gap-2">
                                                <span className="font-bold text-foreground">{c.teacher.fullName}</span>
                                                <span className="text-[9.5px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20">
                                                  {c.daySessionsCount} ca tại BU
                                                </span>
                                              </div>
                                            </SelectItem>
                                          ))}
                                        </SelectGroup>
                                      )}

                                      {groupAtBU.length > 0 && groupNotAtBU.length > 0 && (
                                        <SelectSeparator className="my-1" />
                                      )}

                                      {groupNotAtBU.length > 0 && (
                                        <SelectGroup>
                                          <SelectLabel className="text-[10.5px] font-extrabold text-blue-700 dark:text-blue-400 bg-blue-500/10 px-2 py-1 rounded my-0.5 border border-blue-500/20">
                                            [Cụm 2] GV Rảnh
                                          </SelectLabel>
                                          {groupNotAtBU.map((c) => (
                                            <SelectItem key={c.teacher.id} value={c.teacher.id} className="text-xs font-semibold py-1.5 cursor-pointer">
                                              <div className="flex items-center justify-between w-full gap-2">
                                                <span className="font-bold text-foreground">{c.teacher.fullName}</span>
                                                <span className="text-[9.5px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold border border-blue-500/20">
                                                  Rảnh
                                                </span>
                                              </div>
                                            </SelectItem>
                                          ))}
                                        </SelectGroup>
                                      )}
                                    </>
                                  )}
                                </SelectContent>
                              </Select>
                            )}
                          </td>

                          {/* Thao Tác Gắn GV */}
                          <td className="p-2.5 text-right">
                            {bookedRecord ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => requestCancelBooking(bookedRecord.id, `${slot.track} — ${bookedRecord.assignedTeacherName}`)}
                                className="h-7 px-2 text-xs font-bold text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-lg"
                              >
                                <XCircle className="h-3.5 w-3.5 mr-1" />
                                Hủy Book
                              </Button>
                            ) : (
                              <div className="flex flex-col items-end gap-1">
                                {getShiftGroupSlots(slot, trialSlots).length > 1 ? (
                                  <>
                                    <Button
                                      size="sm"
                                      disabled={!selectedTeacherId || isPastDate}
                                      onClick={() => handleAssignTeacherToSlot(slot, selectedTeacherId, true)}
                                      className={`h-7 px-2.5 text-xs font-bold text-white shadow-2xs rounded-lg ${
                                        isPastDate
                                          ? "bg-gray-400 cursor-not-allowed"
                                          : "bg-purple-700 hover:bg-purple-800"
                                      }`}
                                      title={`Gắn GV này cho CẢ CA 3H (${getShiftGroupSlots(slot, trialSlots).length} ca Trial ${slot.track})`}
                                    >
                                      <Layers className="h-3.5 w-3.5 mr-1" />
                                      Gắn Ca 3h ({getShiftGroupSlots(slot, trialSlots).length} ca)
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled={!selectedTeacherId || isPastDate}
                                      onClick={() => handleAssignTeacherToSlot(slot, selectedTeacherId, false)}
                                      className="h-6 px-2 text-[10.5px] font-bold text-muted-foreground hover:text-foreground rounded-md"
                                      title="Chỉ gắn GV này cho ca 1 tiếng hiện tại"
                                    >
                                      <UserCheck className="h-3 w-3 mr-1" />
                                      Chỉ Gắn 1 Ca
                                    </Button>
                                  </>
                                ) : (
                                  <Button
                                    size="sm"
                                    disabled={!selectedTeacherId || isPastDate}
                                    onClick={() => handleAssignTeacherToSlot(slot, selectedTeacherId, false)}
                                    className={`h-7 px-2.5 text-xs font-bold text-white shadow-2xs rounded-lg ${
                                      isPastDate
                                        ? "bg-gray-400 cursor-not-allowed"
                                        : "bg-[#000056] hover:bg-[#000040]"
                                    }`}
                                  >
                                    <UserCheck className="h-3.5 w-3.5 mr-1" />
                                    Gắn GV Này
                                  </Button>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* SUB-TABS 1, 2, 3: 2-Column Booking Interface */
        <div className="flex-1 flex flex-col lg:flex-row gap-3 min-h-0 overflow-hidden">
          {/* Left Column: Target Shift Selector */}
          <div className="w-full lg:w-96 flex flex-col bg-card border border-border rounded-xl shadow-2xs shrink-0 overflow-hidden">
            <div className="p-3 bg-muted/60 border-b border-border flex items-center justify-between font-bold text-xs gap-1">
              <span className="flex items-center gap-1.5 truncate">
                <BookOpen className="h-4 w-4 text-primary shrink-0" />
                {activeSubTab === "substitute" && "Ca học cần tìm GV dạy thay"}
                {activeSubTab === "examiner" && "Lớp học tới Buổi 14 (Chấm thi)"}
              </span>
              <span className="font-mono text-[10px] text-muted-foreground shrink-0">Tuần: {weekStr}</span>
            </div>

            {/* List of Schedules with Search Bar */}
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                {/* Search Bar for Class Code / Class Name */}
                <div className="p-2 bg-muted/40 border-b border-border/70 shrink-0">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Tìm theo mã lớp, tên lớp..."
                      value={searchClass}
                      onChange={(e) => setSearchClass(e.target.value)}
                      className="pl-8 pr-7 h-7 text-xs bg-background border-border rounded-lg"
                    />
                    {searchClass && (
                      <button
                        type="button"
                        onClick={() => setSearchClass("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
                        title="Xóa từ khóa tìm kiếm"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* List of Filtered Schedules */}
                <div className="flex-1 overflow-y-auto p-2 space-y-2 no-vertical-scrollbar">
                  {filteredClassSchedules.length === 0 ? (
                    <div className="p-6 text-center text-xs text-muted-foreground">
                      <Calendar className="h-8 w-8 mx-auto opacity-40 mb-2" />
                      <span>
                        {searchClass.trim()
                          ? `Không tìm thấy lớp nào khớp với "${searchClass}"`
                          : activeSubTab === "examiner"
                          ? "Không có lớp nào trong tuần tới mốc Buổi 14."
                          : "Không tìm thấy lịch học nào."}
                      </span>
                    </div>
                  ) : (
                    filteredClassSchedules.map((sch) => {
                      const isSelected = selectedSchedule?.id === sch.id;
                      const className = sch.classSite?.class?.name || sch.title;
                      const dateStr = getLocalDateStr(sch);
                      const startTime = getLocalHHMM(sch.startTime);
                      const endTime = getLocalHHMM(sch.endTime);
                      const sIdx = sch.sessionIndex || 1;
                      const total = sch.totalSessions || 14;

                      const todayStr = format(new Date(), "yyyy-MM-dd");
                      const isPastDate = Boolean(dateStr && dateStr < todayStr);

                      return (
                        <div
                          key={sch.id}
                          onClick={() => setSelectedSchedule(sch)}
                          className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                            isSelected
                              ? isPastDate
                                ? "border-amber-500/50 bg-amber-500/5 ring-1 ring-amber-500/20 font-bold shadow-xs"
                                : "border-primary bg-primary/5 ring-1 ring-primary/30 font-bold shadow-xs"
                              : isPastDate
                              ? "border-border/60 bg-muted/30 opacity-70 hover:opacity-100 hover:bg-muted/50"
                              : "border-border/80 hover:bg-muted/50"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span
                              className={`font-mono text-[11px] flex items-center gap-1 font-extrabold ${
                                isPastDate ? "text-muted-foreground" : "text-primary"
                              }`}
                            >
                              <Clock className="h-3 w-3" />
                              {formatDisplayDate(dateStr)} ({startTime} - {endTime})
                            </span>

                            {isPastDate ? (
                              <span className="px-1.5 py-0.2 bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 rounded text-[9px] font-bold flex items-center gap-0.5">
                                <XCircle className="h-2.5 w-2.5" />
                                <span>Đã Qua</span>
                              </span>
                            ) : sch.teacherRole === "CHƯA_GẮN_GV" || !sch.teacherId ? (
                              <span className="px-1.5 py-0.2 bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30 rounded text-[8.5px] font-extrabold flex items-center gap-0.5">
                                <AlertTriangle className="h-2.5 w-2.5 shrink-0 text-rose-600" />
                                <span>Chưa có GV</span>
                              </span>
                            ) : activeSubTab === "examiner" ? (
                              <span className="px-1.5 py-0.2 bg-[#000056] text-white rounded text-[8.5px] font-bold">
                                Buổi 14/14
                              </span>
                            ) : null}
                          </div>

                          <h4 className="font-bold text-xs text-foreground mb-1 line-clamp-1">{className}</h4>

                          <div className="flex items-center justify-between text-[10.5px] text-muted-foreground pt-1 border-t border-border/40">
                            <span>Lớp: Buổi {sIdx}/{total}</span>
                            {sch.teacherRole === "CHƯA_GẮN_GV" || !sch.teacherId ? (
                              <span className="text-[10px] font-extrabold text-rose-600 dark:text-rose-400">
                                Chưa phân công GV
                              </span>
                            ) : (
                              <span className="font-mono text-[10px] truncate max-w-[140px]">
                                {sch.teacherName || teachersList.find((t) => t.id === sch.teacherId)?.fullName || "Giảng viên"} ({sch.teacherRole || "GV"})
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
          </div>

          {/* Right Column: Smart Candidate Matrix Grouped by Location Availability */}
          <div className="flex-1 flex flex-col bg-card border border-border rounded-xl shadow-2xs overflow-hidden">
            {/* Candidate Search Header */}
            <div className="p-2.5 bg-muted/60 border-b border-border flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="font-bold text-xs text-foreground">
                  Gợi Ý Giảng Viên Rảnh (Thủ Dầu Một)
                </span>
              </div>

              <div className="relative w-48">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Tìm tên / mã GV..."
                  value={searchTeacher}
                  onChange={(e) => setSearchTeacher(e.target.value)}
                  className="pl-7 h-7 text-[11px] rounded-lg bg-card border-border"
                />
              </div>
            </div>

            {/* Candidate Lists Body */}
            <div className="flex-1 overflow-y-auto p-3 space-y-4">
              {/* Target Shift Banner */}
              {targetShiftDetails && (
                <div
                  className={`p-2.5 rounded-lg border flex flex-col gap-1.5 text-xs ${
                    isTargetPastDate
                      ? "bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-200"
                      : "bg-primary/5 border-primary/20"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-primary">{targetShiftDetails.className}</span>
                      <span className="text-muted-foreground font-mono text-[11px]">
                        ({targetShiftDetails.displayDate}: {targetShiftDetails.startTime} - {targetShiftDetails.endTime})
                      </span>
                    </div>

                    {isTargetPastDate ? (
                      <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40 text-[10.5px] font-black flex items-center gap-1 shrink-0">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Ca Đã Qua Ngày (Không Thể Book)
                      </span>
                    ) : activeSubTab === "examiner" ? (
                      <span className="text-[10px] text-muted-foreground italic font-medium">
                        (Đã tự động loại GV chính khỏi danh sách Giám khảo)
                      </span>
                    ) : null}
                  </div>

                  {(selectedClassTeachers.lec || selectedClassTeachers.ta) && (
                    <div className="flex flex-wrap items-center gap-3 pt-1.5 border-t border-primary/15 text-[11px]">
                      {selectedClassTeachers.lec && (
                        <div className="flex items-center gap-1 font-medium text-foreground">
                          <span className="font-extrabold text-primary">LEC:</span>
                          <span>{selectedClassTeachers.lec.fullName}</span>
                          <span className="font-mono text-[10px] text-muted-foreground">({selectedClassTeachers.lec.code})</span>
                        </div>
                      )}
                      {selectedClassTeachers.ta && (
                        <div className="flex items-center gap-1 font-medium text-foreground">
                          <span className="font-extrabold text-foreground font-bold">TA:</span>
                          <span>{selectedClassTeachers.ta.fullName}</span>
                          <span className="font-mono text-[10px] text-muted-foreground">({selectedClassTeachers.ta.code})</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* GROUP 1: Teachers Currently AT BU Thủ Dầu Một on That Day (Priority 1) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3
                    onClick={() => setIsGroup1Collapsed(!isGroup1Collapsed)}
                    className="text-xs font-black text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5 cursor-pointer select-none"
                  >
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Cụm 1: Giảng Viên CÓ MẶT Tại BU Thủ Dầu Một Hôm Đó (Ưu Tiên Số 1)</span>
                  </h3>
                  <div className="flex items-center gap-1">
                    <span className="text-[10.5px] font-mono font-extrabold text-muted-foreground">
                      ({teacherRecommendations.groupAtBU.length} ứng viên)
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setIsGroup1Collapsed(!isGroup1Collapsed)}
                      className="h-6 w-6 rounded-md text-muted-foreground hover:text-foreground"
                      title={isGroup1Collapsed ? "Mở rộng Cụm 1" : "Thu gọn Cụm 1"}
                    >
                      <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${isGroup1Collapsed ? "-rotate-90" : "rotate-0"}`} />
                    </Button>
                  </div>
                </div>

                {!isGroup1Collapsed && (
                  teacherRecommendations.groupAtBU.length === 0 ? (
                    <div className="p-3 rounded-lg bg-muted/40 text-[11px] text-muted-foreground italic text-center">
                      Không có giảng viên nào đã có ca tại Thủ Dầu Một hôm đó rảnh khung giờ này.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {teacherRecommendations.groupAtBU.map(({ teacher, daySessionsCount, weeklyHours }) => {
                        const isAlreadyBooked = currentShiftBookings.has(teacher.id);

                        return (
                          <div
                            key={teacher.id}
                            className={`p-2.5 rounded-lg border flex items-center justify-between gap-2 shadow-2xs transition-all ${
                              isAlreadyBooked
                                ? "border-emerald-500/40 bg-emerald-500/10 ring-1 ring-emerald-500/30"
                                : "border-emerald-500/25 bg-emerald-500/5 hover:border-emerald-500"
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="h-8 w-8 rounded-lg bg-emerald-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                                {teacher.fullName.charAt(0)}
                              </div>
                              <div className="min-w-0">
                                <h4 className="font-bold text-xs text-foreground truncate">{teacher.fullName}</h4>
                                <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
                                  <span>Có {daySessionsCount} ca tại BU hôm nay</span>
                                </div>
                              </div>
                            </div>

                            {isAlreadyBooked ? (
                              <span className="h-7 px-2 text-[10px] font-extrabold bg-emerald-600 text-white rounded-lg flex items-center gap-1 shrink-0 shadow-2xs">
                                <Check className="h-3 w-3" />
                                Đã Book
                              </span>
                            ) : isTargetPastDate ? (
                              <span className="h-7 px-2.5 text-[10.5px] font-bold bg-muted text-muted-foreground border border-border/80 rounded-lg flex items-center gap-1 shrink-0 opacity-70 select-none">
                                <XCircle className="h-3 w-3" />
                                Quá Hạn
                              </span>
                            ) : (
                              <Button
                                size="sm"
                                onClick={() => {
                                  setBookingCandidate(teacher);
                                  setIsConfirmOpen(true);
                                }}
                                className="h-7 px-2.5 text-[11px] font-bold bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg shrink-0"
                              >
                                Book Ngay
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )
                )}
              </div>

              {/* GROUP 2: Teachers NOT AT BU Thủ Dầu Một on That Day (Priority 2) */}
              <div className="space-y-2 pt-2 border-t border-border/60">
                <div className="flex items-center justify-between">
                  <h3
                    onClick={() => setIsGroup2Collapsed(!isGroup2Collapsed)}
                    className="text-xs font-bold text-foreground/80 flex items-center gap-1.5 cursor-pointer select-none"
                  >
                    <span className="h-2 w-2 rounded-full bg-muted-foreground/60" />
                    <span>Cụm 2: Giảng Viên KHÔNG CÓ MẶT Tại BU Hôm Đó (Ưu Tiên Số 2)</span>
                  </h3>
                  <div className="flex items-center gap-1">
                    <span className="text-[10.5px] font-mono font-extrabold text-muted-foreground">
                      ({teacherRecommendations.groupNotAtBU.length} ứng viên)
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setIsGroup2Collapsed(!isGroup2Collapsed)}
                      className="h-6 w-6 rounded-md text-muted-foreground hover:text-foreground"
                      title={isGroup2Collapsed ? "Mở rộng Cụm 2" : "Thu gọn Cụm 2"}
                    >
                      <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${isGroup2Collapsed ? "-rotate-90" : "rotate-0"}`} />
                    </Button>
                  </div>
                </div>

                {!isGroup2Collapsed && (
                  teacherRecommendations.groupNotAtBU.length === 0 ? (
                    <div className="p-3 rounded-lg bg-muted/40 text-[11px] text-muted-foreground italic text-center">
                      Không tìm thấy giảng viên khác rảnh.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {teacherRecommendations.groupNotAtBU.map(({ teacher, weeklyHours }) => {
                        const isAlreadyBooked = currentShiftBookings.has(teacher.id);

                        return (
                          <div
                            key={teacher.id}
                            className={`p-2.5 rounded-lg border bg-card flex items-center justify-between gap-2 shadow-2xs transition-all ${
                              isAlreadyBooked
                                ? "border-emerald-500/40 bg-emerald-500/10 ring-1 ring-emerald-500/30"
                                : "border-border hover:border-primary/50"
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="h-8 w-8 rounded-lg bg-muted text-foreground font-black text-xs flex items-center justify-center border border-border shrink-0">
                                {teacher.fullName.charAt(0)}
                              </div>
                              <div className="min-w-0">
                                <h4 className="font-bold text-xs text-foreground truncate">{teacher.fullName}</h4>
                                <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
                                  <span>Rảnh khung giờ này</span>
                                </div>
                              </div>
                            </div>

                            {isAlreadyBooked ? (
                              <span className="h-7 px-2 text-[10px] font-extrabold bg-emerald-600 text-white rounded-lg flex items-center gap-1 shrink-0 shadow-2xs">
                                <Check className="h-3 w-3" />
                                Đã Book
                              </span>
                            ) : isTargetPastDate ? (
                              <span className="h-7 px-2.5 text-[10.5px] font-bold bg-muted text-muted-foreground border border-border/80 rounded-lg flex items-center gap-1 shrink-0 opacity-70 select-none">
                                <XCircle className="h-3 w-3" />
                                Quá Hạn
                              </span>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setBookingCandidate(teacher);
                                  setIsConfirmOpen(true);
                                }}
                                className="h-7 px-2.5 text-[11px] font-bold rounded-lg shrink-0 hover:bg-primary/10 hover:text-primary"
                              >
                                Book Ngay
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Booking Confirmation Dialog */}
      {isConfirmOpen && bookingCandidate && targetShiftDetails && (
        <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
          <DialogContent className="sm:max-w-[420px]">
            <DialogHeader>
              <DialogTitle className="text-sm font-bold flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span>Xác Nhận Book Giảng Viên</span>
              </DialogTitle>
              <DialogDescription className="text-xs">
                Bạn đang thực hiện book nhân sự cho ca dạy tại Thủ Dầu Một.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 text-xs pt-1">
              <div className="p-3 bg-muted/60 rounded-lg space-y-1.5 border border-border">
                <p><strong>Loại Book:</strong> {activeSubTab === "substitute" ? "Dạy Thay" : activeSubTab === "trial" ? "Dạy Trial" : "Giám Khảo (Buổi 14)"}</p>
                <p><strong>Ca dạy:</strong> {targetShiftDetails.className}</p>
                <p><strong>Thời gian:</strong> {targetShiftDetails.displayDate} ({targetShiftDetails.startTime} - {targetShiftDetails.endTime})</p>
                <p><strong>Giảng viên phân công:</strong> <strong className="text-primary">{bookingCandidate.fullName} ({bookingCandidate.code})</strong></p>
              </div>

              <div>
                <label className="text-xs font-bold text-foreground block mb-1">Ghi chú (Tùy chọn):</label>
                <Input
                  type="text"
                  placeholder="Ví dụ: Đã thỏa thuận qua điện thoại..."
                  value={bookingNotes}
                  onChange={(e) => setBookingNotes(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <Button variant="outline" size="sm" onClick={() => setIsConfirmOpen(false)} className="h-8 text-xs">
                Hủy
              </Button>
              <Button size="sm" onClick={handleConfirmBooking} className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
                Xác Nhận Book
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Action Confirmation Modal (No native window.confirm/alert) */}
      {actionConfirm && actionConfirm.isOpen && (
        <Dialog open={actionConfirm.isOpen} onOpenChange={(open) => !open && setActionConfirm(null)}>
          <DialogContent className="sm:max-w-[420px]">
            <DialogHeader>
              <DialogTitle className="text-sm font-bold flex items-center gap-2">
                {actionConfirm.type === "CANCEL_BOOKING" ? (
                  <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-rose-500 shrink-0" />
                )}
                <span>
                  {actionConfirm.type === "CANCEL_BOOKING" && "Xác Nhận Hủy Ca Book"}
                  {actionConfirm.type === "DELETE_BOOKING" && "Xác Nhận Xóa Vĩnh Viễn Log"}
                  {actionConfirm.type === "CLEAR_CANCELLED" && "Xác Nhận Xóa Nhật Ký Đã Hủy"}
                </span>
              </DialogTitle>
              <DialogDescription className="text-xs">
                {actionConfirm.type === "CANCEL_BOOKING" && "Chuyển trạng thái ca book sang ĐÃ HỦY."}
                {actionConfirm.type === "DELETE_BOOKING" && "Xóa hoàn toàn dữ liệu nhật ký khỏi hệ thống."}
                {actionConfirm.type === "CLEAR_CANCELLED" && "Dọn dẹp toàn bộ các dòng nhật ký ca đã bị hủy."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 text-xs pt-1">
              <div className="p-3 bg-muted/60 rounded-lg space-y-1.5 border border-border">
                {actionConfirm.type === "CANCEL_BOOKING" && (
                  <>
                    <p className="font-bold text-foreground">Bạn có chắc chắn muốn HỦY ca book này?</p>
                    {actionConfirm.recordTitle && (
                      <p className="text-muted-foreground font-mono text-[11px] bg-background p-1.5 rounded border border-border mt-1">
                        {actionConfirm.recordTitle}
                      </p>
                    )}
                    <p className="text-amber-600 dark:text-amber-400 text-[11px] font-medium pt-1">
                      • Trạng thái ca dạy sẽ cập nhật thành <strong>Đã Hủy</strong>.
                    </p>
                  </>
                )}

                {actionConfirm.type === "DELETE_BOOKING" && (
                  <>
                    <p className="font-bold text-foreground">Bạn có chắc chắn muốn XÓA VĨNH VIỄN dòng nhật ký này?</p>
                    {actionConfirm.recordTitle && (
                      <p className="text-muted-foreground font-mono text-[11px] bg-background p-1.5 rounded border border-border mt-1">
                        {actionConfirm.recordTitle}
                      </p>
                    )}
                    <p className="text-rose-600 dark:text-rose-400 text-[11px] font-medium pt-1 flex items-center gap-1">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-rose-500" />
                      <span>Thao tác này sẽ dọn dẹp bản ghi và <strong>không thể hoàn tác</strong>.</span>
                    </p>
                  </>
                )}

                {actionConfirm.type === "CLEAR_CANCELLED" && (
                  <>
                    <p className="font-bold text-foreground">
                      Bạn có chắc chắn muốn xóa toàn bộ{" "}
                      <strong className="text-rose-600">
                        {bookingHistory.filter((r) => r.status === "CANCELLED").length}
                      </strong>{" "}
                      nhật ký ca ĐÃ HỦY?
                    </p>
                    <p className="text-rose-600 dark:text-rose-400 text-[11px] font-medium pt-1 flex items-center gap-1">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-rose-500" />
                      <span>Tất cả các ca đã hủy sẽ bị loại bỏ khỏi bộ nhớ local và Cloud storage.</span>
                    </p>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActionConfirm(null)}
                className="h-8 text-xs font-medium"
              >
                Hủy bỏ
              </Button>
              <Button
                size="sm"
                onClick={handleExecuteAction}
                className={`h-8 text-xs font-bold text-white shadow-2xs ${
                  actionConfirm.type === "CANCEL_BOOKING"
                    ? "bg-amber-600 hover:bg-amber-700"
                    : "bg-rose-600 hover:bg-rose-700"
                }`}
              >
                {actionConfirm.type === "CANCEL_BOOKING" ? "Xác Nhận Hủy Ca" : "Xác Nhận Xóa Vĩnh Viễn"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
