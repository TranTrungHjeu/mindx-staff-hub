import { useEffect, useMemo, useState, useRef } from "react";
import {
  Search,
  Calendar,
  Filter,
  ChevronLeft,
  ChevronRight,
  Clock,
  RotateCcw,
  Building2,
} from "lucide-react";
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
  startOfWeek,
  endOfWeek,
  format,
  addDays,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
} from "date-fns";
import { vi } from "date-fns/locale";
import { extractHHMM, extractDatePart, formatDate, formatTime } from "@/lib/date";
import {
  getSessionExamType,
  extractSessionIndex,
  resolveDirectTeacherRole,
} from "@/lib/courseConfig";
import { LmsClient } from "@/lib/lms/client";

interface Schedule {
  id: string;
  teacherId: string;
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

function CustomDatePicker({
  selectedDate,
  onSelect,
  onClose,
}: {
  selectedDate: Date;
  onSelect: (date: Date) => void;
  onClose: () => void;
}) {
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(selectedDate));

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const daysInMonth = eachDayOfInterval({
    start: startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 }),
  });

  const weekDays = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
  const monthName = format(currentMonth, "MMMM, yyyy", { locale: vi });

  return (
    <div className="p-3 bg-card rounded-xl shadow-xl border border-border w-[280px] animate-in fade-in zoom-in-95 duration-200">
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handlePrevMonth}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-semibold text-foreground capitalize">{monthName}</span>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleNextMonth}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center mb-2">
        {weekDays.map((day) => (
          <div key={day} className="text-[11px] font-semibold text-muted-foreground">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {daysInMonth.map((day, idx) => {
          const isSelected = isSameDay(day, selectedDate);
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isToday = isSameDay(day, new Date());

          return (
            <button
              key={idx}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(day);
                onClose();
              }}
              className={`h-8 w-8 rounded-md flex items-center justify-center text-xs transition-all
                ${!isCurrentMonth ? "text-muted-foreground/70" : "text-foreground hover:bg-muted"}
                ${isSelected ? "bg-primary text-white hover:bg-primary/90 font-bold shadow-md" : ""}
                ${isToday && !isSelected ? "text-primary font-bold bg-primary/10" : ""}
              `}
            >
              {format(day, "d")}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface SchedulesViewProps {
  onSwitchToPayroll: () => void;
}

export function SchedulesView({ onSwitchToPayroll }: SchedulesViewProps) {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [teachersList, setTeachersList] = useState<Teacher[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [hideTeachersWithoutSchedules, setHideTeachersWithoutSchedules] = useState(true);
  const [hideSuspendedClasses, setHideSuspendedClasses] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const datePickerRef = useRef<HTMLDivElement>(null);
  const [viewingSchedule, setViewingSchedule] = useState<Schedule | null>(null);
  const [selectedTeacherForPanel, setSelectedTeacherForPanel] = useState<Teacher | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollLeftStart = useRef(0);

  const handleDragMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("input") || target.closest("a")) return;
    isDragging.current = true;
    if (scrollContainerRef.current) {
      scrollContainerRef.current.style.cursor = "grabbing";
      scrollContainerRef.current.style.userSelect = "none";
    }
    startX.current = e.pageX - (scrollContainerRef.current?.offsetLeft || 0);
    scrollLeftStart.current = scrollContainerRef.current?.scrollLeft || 0;
  };

  const handleDragMouseUpOrLeave = () => {
    if (!isDragging.current) return;
    isDragging.current = false;
    if (scrollContainerRef.current) {
      scrollContainerRef.current.style.cursor = "grab";
      scrollContainerRef.current.style.userSelect = "";
    }
  };

  const handleDragMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging.current || !scrollContainerRef.current) return;
    const x = e.pageX - (scrollContainerRef.current.offsetLeft || 0);
    const walk = (x - startX.current) * 1.5;
    e.preventDefault();
    scrollContainerRef.current.scrollLeft = scrollLeftStart.current - walk;
  };

  const fetchSchedulesForDate = async (date: Date) => {
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
      if (teacherIds.length === 0) {
        setSchedules([]);
        return;
      }

      const schedulesData = await LmsClient.getTeacherSchedules(teacherIds, dateGte, dateLte);
      setSchedules(schedulesData || []);
    } catch (err: any) {
      setError(err?.message || "Lỗi kết nối LMS API.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedulesForDate(selectedDate);
  }, [selectedDate]);

  const getLocalDate = (sch: Schedule) => {
    try {
      if (sch.startTime && sch.startTime.includes("T")) {
        return extractDatePart(sch.startTime);
      }
      if (sch.date) {
        return extractDatePart(sch.date);
      }
      return "";
    } catch {
      return sch.date ? sch.date.split("T")[0] : "";
    }
  };

  const getLocalTime = (timeStr: string) => {
    if (!timeStr) return "";
    const hhmm = extractHHMM(timeStr);
    if (hhmm) return `${String(hhmm.hours).padStart(2, "0")}:${String(hhmm.minutes).padStart(2, "0")}`;
    return "";
  };

  const centerSchedules = useMemo(() => {
    return schedules.filter((s) => {
      if (s.type !== "CLASS_SESSION" && s.type !== "OFFICE_HOURS") return false;
      if (hideSuspendedClasses && (s.classStatus === "SUSPENDED" || s.classStatus === "CANCELLED" || s.classStatus === "PAUSED")) {
        return false;
      }
      return true;
    });
  }, [schedules, hideSuspendedClasses]);

  const teacherSchedulesList = useMemo(() => {
    if (!selectedTeacherForPanel) return [];
    return centerSchedules
      .filter((s) => s.teacherId === selectedTeacherForPanel.id)
      .sort((a, b) => {
        const dateA = a.startTime || a.date || "";
        const dateB = b.startTime || b.date || "";
        return dateA.localeCompare(dateB);
      });
  }, [centerSchedules, selectedTeacherForPanel]);

  const weekDaysList = useMemo(() => {
    const mon = startOfWeek(selectedDate, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => {
      const day = addDays(mon, i);
      const dayName = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"][i];
      return {
        date: day,
        dayName,
        dateStr: format(day, "dd/MM"),
        fullDateStr: format(day, "yyyy-MM-dd"),
        isToday: isSameDay(day, new Date()),
      };
    });
  }, [selectedDate]);

  const teachersWithSchedules = useMemo(() => {
    return new Set(centerSchedules.map((s) => s.teacherId));
  }, [centerSchedules]);

  const filteredTeachers = useMemo(() => {
    return teachersList.filter((t) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return t.fullName?.toLowerCase().includes(q) || t.code?.toLowerCase().includes(q);
    });
  }, [teachersList, search]);

  const displayedTeachers = useMemo(() => {
    const list = filteredTeachers.filter((t) => {
      if (hideTeachersWithoutSchedules) {
        return teachersWithSchedules.has(t.id);
      }
      return true;
    });

    return list.sort((a, b) => {
      const getSortable = (fullName = "") => {
        const parts = fullName.trim().split(/\s+/);
        if (parts.length <= 1) return fullName;
        const firstName = parts[parts.length - 1];
        const rest = parts.slice(0, parts.length - 1).join(" ");
        return `${firstName} ${rest}`;
      };
      return getSortable(a.fullName).localeCompare(getSortable(b.fullName), "vi", { sensitivity: "base" });
    });
  }, [filteredTeachers, hideTeachersWithoutSchedules, teachersWithSchedules]);

  const relevantSchedules = useMemo(() => {
    const activeTeacherIds = new Set(displayedTeachers.map((t) => t.id));
    return centerSchedules.filter((s) => activeTeacherIds.has(s.teacherId));
  }, [centerSchedules, displayedTeachers]);

  const displayedSlots = useMemo(() => {
    const uniqueSlotsSet = new Set<string>();
    relevantSchedules.forEach((sch) => {
      const localDate = getLocalDate(sch);
      const startLocalTime = getLocalTime(sch.startTime);
      const endLocalTime = getLocalTime(sch.endTime);
      if (localDate && startLocalTime) {
        uniqueSlotsSet.add(`${localDate}_${startLocalTime}`);
      }
      if (localDate && endLocalTime) {
        uniqueSlotsSet.add(`${localDate}_${endLocalTime}`);
      }
    });

    return Array.from(uniqueSlotsSet).sort((a, b) => {
      const [dateA, timeA] = a.split("_");
      const [dateB, timeB] = b.split("_");
      if (dateA !== dateB) return dateA.localeCompare(dateB);
      return timeA.localeCompare(timeB);
    });
  }, [relevantSchedules]);

  const schedulesByTeacher = useMemo(() => {
    const map: Record<string, Record<string, Schedule[]>> = {};
    relevantSchedules.forEach((sch) => {
      const localDate = getLocalDate(sch);
      const localTime = getLocalTime(sch.startTime);
      if (localDate && localTime) {
        const slot = `${localDate}_${localTime}`;
        if (!map[sch.teacherId]) map[sch.teacherId] = {};
        if (!map[sch.teacherId][slot]) map[sch.teacherId][slot] = [];
        map[sch.teacherId][slot].push(sch);
      }
    });
    return map;
  }, [relevantSchedules]);

  const formatSlotHeader = (slotKey: string) => {
    try {
      const [dateStr, timeStr] = slotKey.split("_");
      const dateObj = new Date(dateStr);
      const days = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
      const displayDay = days[dateObj.getDay()];
      const isToday = isSameDay(dateObj, new Date());
      const dateDisplay = format(dateObj, "dd/MM");
      return (
        <div className="flex flex-col items-center leading-none whitespace-nowrap gap-0.5 py-0.5">
          <span className={`font-bold text-[8.5px] md:text-[9.5px] ${isToday ? "text-primary" : "text-foreground"}`}>
            {displayDay} - {dateDisplay}
          </span>
          <span className={`text-[8px] md:text-[9px] font-mono font-bold ${isToday ? "text-primary" : "text-muted-foreground"}`}>{timeStr}</span>
        </div>
      );
    } catch {
      return <span>{slotKey}</span>;
    }
  };

  const getScheduleStyle = (sch: Schedule) => {
    if (sch.classStatus === "SUSPENDED" || sch.classStatus === "CANCELLED" || sch.classStatus === "PAUSED") {
      return "bg-rose-500/10 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200 border-rose-300 dark:border-rose-800 border-l-4 border-l-rose-500 font-semibold shadow-2xs opacity-80 hover:opacity-100";
    }

    if (sch.type === "OFFICE_HOURS") {
      return "bg-purple-500/10 dark:bg-purple-500/20 text-purple-950 dark:text-purple-100 border-purple-200 dark:border-purple-800/80 border-l-4 border-l-purple-600 dark:border-l-purple-400 font-semibold shadow-2xs hover:bg-purple-500/20";
    }

    if (sch.type === "CLASS_SESSION") {
      const className = sch.classSite?.class?.name || sch.title || "";
      const sessionIdx = sch.sessionIndex || extractSessionIndex(sch.title, sch.description);
      const total = sch.totalSessions || 14;
      const examType = getSessionExamType(className, sch.title, sch.description, sessionIdx || undefined, total);

      if (examType === "checkpoint1" || examType === "checkpoint2") {
        return "bg-amber-500/15 dark:bg-amber-500/25 text-amber-950 dark:text-amber-100 border-amber-300/80 dark:border-amber-700/80 border-l-4 border-l-amber-500 font-semibold shadow-2xs hover:bg-amber-500/22";
      }
      if (examType === "demo") {
        return "bg-emerald-500/15 dark:bg-emerald-500/25 text-emerald-950 dark:text-emerald-100 border-emerald-300/80 dark:border-emerald-700/80 border-l-4 border-l-emerald-500 font-semibold shadow-2xs hover:bg-emerald-500/22";
      }
      // Lớp học thường: Nền Slate Blue dịu mắt, chữ tương phản cao, vạch lề xanh Navy MindX
      return "bg-slate-100/90 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 border-slate-300/80 dark:border-slate-700 border-l-4 border-l-[#000056] dark:border-l-blue-400 shadow-2xs hover:bg-slate-200/80 dark:hover:bg-slate-700/90";
    }

    return "bg-muted text-foreground border-border";
  };

  const renderRoleBadge = (sch: Schedule) => {
    if (!sch.teacherRole || sch.teacherRole.trim() === "") return null;
    const upper = sch.teacherRole.toUpperCase().trim();
    let badgeBg = "bg-primary text-white";
    if (upper === "GV") badgeBg = "bg-[#E31F26] text-white";
    else if (upper === "TG") badgeBg = "bg-[#FFD62D] text-black font-bold";
    else if (upper === "GK") badgeBg = "bg-[#9333EA] text-white";
    else if (upper === "DT") badgeBg = "bg-[#E11D48] text-white";

    return (
      <span className={`px-1 py-0.2 rounded-xs text-[8px] font-extrabold tracking-wider ${badgeBg}`}>
        {upper}
      </span>
    );
  };

  const weekStr = `${format(startOfWeek(selectedDate, { weekStartsOn: 1 }), "dd/MM/yy")} - ${format(endOfWeek(selectedDate, { weekStartsOn: 1 }), "dd/MM/yy")}`;

  return (
    <div className="p-3 sm:p-6 space-y-4 h-[calc(100vh-20px)] overflow-hidden flex flex-col bg-background text-foreground font-sans">
      {/* MindX Top Loading / Brand Line */}
      <div className="h-[3px] w-full bg-muted/40 shrink-0 rounded-full overflow-hidden relative">
        <div
          className={`h-full w-full bg-mindx-accent-gradient rounded-full ${
            isLoading ? "animate-top-loader" : "transition-all duration-300"
          }`}
        />
      </div>

      {/* Control Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-sm font-bold text-foreground min-w-[130px]">
            {isLoading ? "Đang tải..." : `Tuần: ${weekStr}`}
          </span>

          <div className="flex items-center bg-card border border-border rounded-lg shadow-xs h-9 justify-between">
            <Button
              variant="ghost"
              size="icon"
              className="h-full w-8 text-muted-foreground hover:text-primary rounded-none rounded-l-lg"
              onClick={() => setSelectedDate(addDays(selectedDate, -7))}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>

            <div className="relative h-full border-x border-border flex items-center" ref={datePickerRef}>
              <div
                onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
                className={`flex items-center justify-center gap-1.5 px-3 h-full hover:bg-muted/50 transition-colors cursor-pointer select-none text-[11px] font-bold text-foreground ${
                  isDatePickerOpen ? "bg-muted/50 ring-1 ring-primary/20" : ""
                }`}
              >
                <Calendar className="h-3.5 w-3.5 text-primary shrink-0" />
                <span>{format(selectedDate, "dd/MM/yyyy")}</span>
              </div>

              {isDatePickerOpen && (
                <div className="absolute top-[calc(100%+6px)] left-1/2 -translate-x-1/2 z-50">
                  <CustomDatePicker
                    selectedDate={selectedDate}
                    onSelect={(d) => setSelectedDate(d)}
                    onClose={() => setIsDatePickerOpen(false)}
                  />
                </div>
              )}
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="h-full w-8 text-muted-foreground hover:text-primary rounded-none"
              onClick={() => setSelectedDate(addDays(selectedDate, 7))}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>

            <div className="h-full border-l border-border">
              <Button
                variant="ghost"
                className="h-full px-2 text-[10px] font-extrabold text-primary hover:bg-primary/10 rounded-none rounded-r-lg"
                onClick={() => setSelectedDate(new Date())}
              >
                H.Nay
              </Button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Legend Color Indicator */}
          <div className="hidden lg:flex items-center gap-1.5 text-[10.5px] font-semibold text-muted-foreground border-r border-border pr-2">
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 border-l-3 border-l-[#000056] dark:border-l-blue-400">
              Thường
            </span>
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-950 dark:text-amber-100 border-l-3 border-l-amber-500">
              <span className="px-1 bg-amber-600 text-white rounded-xs text-[8px] font-black">CP1/2</span>
            </span>
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-950 dark:text-emerald-100 border-l-3 border-l-emerald-500">
              <span className="px-1 bg-emerald-600 text-white rounded-xs text-[8px] font-black">Demo</span>
            </span>
          </div>
          <Button
            onClick={() => fetchSchedulesForDate(selectedDate)}
            disabled={isLoading}
            size="sm"
            variant="outline"
            className="h-9 gap-1.5 shadow-2xs"
          >
            <RotateCcw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin text-primary" : ""}`} />
            <span className="hidden sm:inline">Làm mới</span>
          </Button>

          <Button
            variant={hideTeachersWithoutSchedules ? "secondary" : "outline"}
            size="sm"
            className="h-9 text-xs font-semibold gap-1.5 shadow-2xs"
            onClick={() => setHideTeachersWithoutSchedules(!hideTeachersWithoutSchedules)}
          >
            <Filter className="h-3.5 w-3.5 text-primary" />
            <span>GV ({displayedTeachers.length}/{teachersList.length})</span>
          </Button>

          <Button
            variant={hideSuspendedClasses ? "secondary" : "outline"}
            size="sm"
            className={`h-9 text-xs font-semibold gap-1.5 shadow-2xs ${hideSuspendedClasses ? "text-rose-600 bg-rose-500/10 border-rose-300" : ""}`}
            onClick={() => setHideSuspendedClasses(!hideSuspendedClasses)}
          >
            <Filter className="h-3.5 w-3.5 text-rose-500" />
            <span>{hideSuspendedClasses ? "Ẩn Tạm Ngưng" : "Hiện Tạm Ngưng"}</span>
          </Button>

          <div className="relative w-full sm:w-48 lg:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Tìm theo tên/mã GV..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9 text-xs rounded-lg bg-card"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 p-2.5 rounded-lg text-xs text-destructive flex items-center justify-between shrink-0">
          <span>⚠️ {error}</span>
          <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => fetchSchedulesForDate(selectedDate)}>
            Thử lại
          </Button>
        </div>
      )}

      {/* Main Schedule Matrix */}
      <div className="flex-1 border border-border rounded-xl bg-card overflow-hidden flex flex-col shadow-xs relative">
        {/* Teacher Schedule Overlay Panel (Dạng Lịch Tuần 7 ngày trượt đè lên View Lịch) */}
        {selectedTeacherForPanel && (
          <div className="absolute inset-0 z-30 bg-card flex flex-col animate-in slide-in-from-right duration-300 overflow-hidden">
            {/* Panel Top Toolbar */}
            <div className="p-3 sm:p-4 bg-muted/80 backdrop-blur-xs border-b border-border flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedTeacherForPanel(null)}
                  className="h-8 gap-1.5 text-xs font-bold shadow-2xs hover:bg-primary/10 hover:text-primary hover:border-primary/30"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span>Quay lại lịch chung</span>
                </Button>

                <div className="h-5 w-px bg-border hidden sm:block" />

                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center font-black text-sm text-white shadow-2xs">
                    {selectedTeacherForPanel.fullName.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold text-foreground flex items-center gap-2">
                      <span>{selectedTeacherForPanel.fullName}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-muted-foreground/15 text-muted-foreground">
                        {selectedTeacherForPanel.code}
                      </span>
                    </h3>
                    <p className="text-[10.5px] text-muted-foreground">
                      Lịch cá nhân tuần ({format(startOfWeek(selectedDate, { weekStartsOn: 1 }), "dd/MM")} - {format(endOfWeek(selectedDate, { weekStartsOn: 1 }), "dd/MM/yyyy")})
                    </p>
                  </div>
                </div>
              </div>

              {/* KPI Badges */}
              <div className="flex items-center gap-1.5 text-[11px] font-bold">
                <div className="px-2.5 py-1 rounded-lg bg-background border border-border/80 flex items-center gap-1.5 shadow-2xs">
                  <span className="text-muted-foreground font-semibold">Tổng ca:</span>
                  <span className="font-mono text-foreground font-black">{teacherSchedulesList.length}</span>
                </div>
                <div className="px-2.5 py-1 rounded-lg bg-background border border-border/80 flex items-center gap-1.5 shadow-2xs">
                  <span className="text-muted-foreground font-semibold">GV:</span>
                  <span className="font-mono text-primary font-black">
                    {teacherSchedulesList.filter(s => (s.teacherRole || "").toUpperCase().includes("GV") || (s.teacherRole || "").toUpperCase().includes("LEC")).length}
                  </span>
                </div>
                <div className="px-2.5 py-1 rounded-lg bg-background border border-border/80 flex items-center gap-1.5 shadow-2xs">
                  <span className="text-muted-foreground font-semibold">TG:</span>
                  <span className="font-mono text-amber-600 dark:text-amber-400 font-black">
                    {teacherSchedulesList.filter(s => (s.teacherRole || "").toUpperCase().includes("TG") || (s.teacherRole || "").toUpperCase().includes("TA")).length}
                  </span>
                </div>
                <div className="px-2.5 py-1 rounded-lg bg-background border border-border/80 flex items-center gap-1.5 shadow-2xs">
                  <span className="text-muted-foreground font-semibold">Trực:</span>
                  <span className="font-mono text-purple-600 dark:text-purple-400 font-black">
                    {teacherSchedulesList.filter(s => s.type === "OFFICE_HOURS").length}
                  </span>
                </div>
              </div>
            </div>

            {/* 7-Day Matrix Table View for Teacher */}
            <div className="flex-1 overflow-auto p-3 bg-muted/20">
              <div className="grid grid-cols-1 md:grid-cols-7 gap-2.5 h-full min-w-[750px]">
                {weekDaysList.map((d) => {
                  const daySchedules = teacherSchedulesList.filter((sch) => {
                    const schDateStr = getLocalDate(sch);
                    return schDateStr === d.fullDateStr;
                  });

                  return (
                    <div
                      key={d.fullDateStr}
                      className={`flex flex-col rounded-xl border border-border/80 bg-card overflow-hidden shadow-2xs ${
                        d.isToday ? "ring-2 ring-primary/40 border-primary/50" : ""
                      }`}
                    >
                      {/* Day Column Header */}
                      <div
                        className={`p-2 text-center border-b border-border/60 font-bold text-xs shrink-0 ${
                          d.isToday ? "bg-primary/15 text-primary" : "bg-muted/50 text-foreground"
                        }`}
                      >
                        <div>{d.dayName} - {d.dateStr}</div>
                        <div className="text-[9.5px] text-muted-foreground font-semibold mt-0.5">
                          {daySchedules.length} ca
                        </div>
                      </div>

                      {/* Day Schedules List */}
                      <div className="p-1.5 space-y-1.5 flex-1 overflow-y-auto no-vertical-scrollbar">
                        {daySchedules.length === 0 ? (
                          <div className="h-full min-h-[120px] flex items-center justify-center text-muted-foreground/50 text-[11px] font-medium italic">
                            Không có lịch
                          </div>
                        ) : (
                          daySchedules.map((sch) => {
                            const isClass = sch.type === "CLASS_SESSION";
                            const className = sch.classSite?.class?.name || sch.title || "Lịch dạy";
                            const centreName = sch.classSite?.centre?.name || sch.officeHour?.centre?.name || "MindX";
                            const total = sch.totalSessions || 14;
                            const sIdx = sch.sessionIndex || 1;
                            const examType = isClass ? getSessionExamType(className, sch.title, sch.description, sIdx, total) : null;

                            return (
                              <div
                                key={sch.id}
                                onClick={() => setViewingSchedule(sch)}
                                className={`p-2 rounded-lg border text-[11px] leading-tight cursor-pointer transition-all hover:scale-[1.02] shadow-2xs ${getScheduleStyle(
                                  sch
                                )}`}
                              >
                                <div className="flex items-center justify-between gap-1 mb-1">
                                  <span className="font-mono text-[9.5px] font-bold opacity-90">
                                    {formatTime(sch.startTime)} - {formatTime(sch.endTime)}
                                  </span>
                                  {renderRoleBadge(sch)}
                                </div>

                                <p className="font-bold truncate text-[11px] mb-1">{className}</p>

                                {isClass && (
                                  <div className="flex items-center justify-between text-[9px] border-t border-border/30 pt-1 mt-1">
                                    <span className="font-mono font-bold opacity-85">
                                      B{sIdx}
                                    </span>
                                    {sch.classStatus === "SUSPENDED" ? (
                                      <span className="px-1 py-0.2 bg-rose-600 text-white rounded-xs font-black tracking-wider">Tạm ngưng</span>
                                    ) : (
                                      <>
                                        {examType === "checkpoint1" && (
                                          <span className="px-1 py-0.2 bg-amber-600 text-white rounded-xs font-bold">CP1</span>
                                        )}
                                        {examType === "checkpoint2" && (
                                          <span className="px-1 py-0.2 bg-amber-600 text-white rounded-xs font-bold">CP2</span>
                                        )}
                                        {examType === "demo" && (
                                          <span className="px-1 py-0.2 bg-emerald-600 text-white rounded-xs font-bold">Demo</span>
                                        )}
                                      </>
                                    )}
                                  </div>
                                )}

                                <div className="text-[9px] text-muted-foreground truncate opacity-80 mt-1">
                                  📍 {centreName}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        <div
          ref={scrollContainerRef}
          onMouseDown={handleDragMouseDown}
          onMouseUp={handleDragMouseUpOrLeave}
          onMouseLeave={handleDragMouseUpOrLeave}
          onMouseMove={handleDragMouseMove}
          className="overflow-auto flex-1 cursor-grab select-none no-vertical-scrollbar"
        >
          <table className="border-collapse text-left text-xs min-w-full">
            <thead className="sticky top-0 z-20 bg-muted/90 backdrop-blur-xs border-b border-border shadow-2xs">
              <tr>
                <th className="sticky left-0 z-30 bg-muted p-2 w-48 min-w-[190px] border-r border-border font-bold text-foreground">
                  Giảng viên
                </th>
                {displayedSlots.map((slotKey) => (
                  <th
                    key={slotKey}
                    className="p-1.5 min-w-[110px] text-center border-r border-border/60 select-none"
                  >
                    {formatSlotHeader(slotKey)}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className={`divide-y divide-border/50 transition-opacity duration-200 ${isLoading ? "opacity-60 pointer-events-none" : "opacity-100"}`}>
              {displayedTeachers.length === 0 ? (
                <tr>
                  <td colSpan={displayedSlots.length + 1} className="p-8 text-center text-muted-foreground">
                    {isLoading ? "Đang tải lịch từ LMS..." : "Không tìm thấy giảng viên phù hợp."}
                  </td>
                </tr>
              ) : (
                displayedTeachers.map((teacher) => {
                  const teacherSlotsMap = schedulesByTeacher[teacher.id] || {};

                  return (
                    <tr
                      key={teacher.id}
                      className="transition-colors hover:bg-muted/30"
                    >
                      <td
                        onClick={() => setSelectedTeacherForPanel(teacher)}
                        title="Nhấn để xem tổng quan tải lịch giảng dạy"
                        className="sticky left-0 z-10 bg-card p-0 border-r border-border cursor-pointer select-none font-semibold group"
                      >
                        <div className="p-2 h-full w-full bg-card group-hover:bg-primary/10 transition-colors flex items-center justify-between gap-1 truncate text-xs font-semibold group-hover:text-primary">
                          <span className="truncate">{teacher.fullName}</span>
                          <ChevronRight className="h-3 w-3 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                        </div>
                      </td>

                      {displayedSlots.map((slotKey) => {
                        const cellSchedules = teacherSlotsMap[slotKey] || [];

                        return (
                          <td
                            key={slotKey}
                            className="p-1 border-r border-border/40 align-top transition-colors"
                          >
                            <div className="space-y-1">
                              {cellSchedules.map((sch) => {
                                const isClass = sch.type === "CLASS_SESSION";
                                const className = sch.classSite?.class?.name || sch.title || "Lịch dạy";
                                const total = sch.totalSessions || 14;
                                const sIdx = sch.sessionIndex || 1;
                                const examType = isClass
                                  ? getSessionExamType(className, sch.title, sch.description, sIdx, total)
                                  : null;

                                return (
                                  <div
                                    key={sch.id}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setViewingSchedule(sch);
                                    }}
                                    className={`p-1.5 rounded-md border text-[11px] leading-tight cursor-pointer transition-all hover:scale-[1.02] ${getScheduleStyle(
                                      sch
                                    )}`}
                                  >
                                    <div className="flex items-center justify-between gap-1 mb-0.5">
                                      <p className="font-bold truncate text-[10.5px]">{className}</p>
                                      {renderRoleBadge(sch)}
                                    </div>

                                    {isClass && (
                                      <div className="flex items-center justify-between mt-1 text-[9px]">
                                        <span className="font-mono font-bold opacity-85">
                                          B{sIdx}
                                        </span>
                                        {sch.classStatus === "SUSPENDED" ? (
                                          <span className="px-1 py-0.2 bg-rose-600 text-white rounded-xs font-black tracking-wider">Tạm ngưng</span>
                                        ) : (
                                          <>
                                            {examType === "checkpoint1" && (
                                              <span className="px-1 py-0.2 bg-amber-600 text-white rounded-xs font-bold">CP1</span>
                                            )}
                                            {examType === "checkpoint2" && (
                                              <span className="px-1 py-0.2 bg-amber-600 text-white rounded-xs font-bold">CP2</span>
                                            )}
                                            {examType === "demo" && (
                                              <span className="px-1 py-0.2 bg-emerald-600 text-white rounded-xs font-bold">Demo</span>
                                            )}
                                          </>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Schedule Detail Modal */}
      {viewingSchedule && (
        <Dialog open={!!viewingSchedule} onOpenChange={(open) => !open && setViewingSchedule(null)}>
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle className="text-base font-bold">
                {viewingSchedule.classSite?.class?.name || viewingSchedule.title}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {viewingSchedule.classSite?.centre?.name || viewingSchedule.officeHour?.centre?.name || "MindX Center"}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 text-xs pt-2">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4 text-primary" />
                <span>
                  {formatDate(viewingSchedule.startTime)} ({formatTime(viewingSchedule.startTime)} - {formatTime(viewingSchedule.endTime)})
                </span>
              </div>

              {viewingSchedule.teacherRole && (
                <div className="flex items-center gap-2 font-semibold">
                  <span>Vai trò:</span>
                  <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-bold">
                    {viewingSchedule.teacherRole}
                  </span>
                </div>
              )}

              {viewingSchedule.description && (
                <div className="p-3 bg-muted rounded-lg text-muted-foreground italic">
                  {viewingSchedule.description}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
