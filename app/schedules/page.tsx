"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import {
  Loader2,
  Search,
  CalendarClock,
  Calendar,
  RefreshCw,
  Filter,
  ChevronLeft,
  ChevronRight,
  Info,
  Clock,
  User,
  RotateCcw,
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
import { extractHHMM, extractDatePart } from "@/lib/date";
import {
  getSessionExamType,
  extractSessionIndex,
  resolveDirectTeacherRole,
} from "@/lib/courseConfig";

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

const DEFAULT_CENTRE_ID = process.env.NEXT_PUBLIC_DEFAULT_CENTRE_IDS || "6443460f94300678908f7974";

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

export default function StandaloneSchedulesPage() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [teachersList, setTeachersList] = useState<Teacher[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [hideTeachersWithoutSchedules, setHideTeachersWithoutSchedules] = useState(true);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const datePickerRef = useRef<HTMLDivElement>(null);
  const [viewingSchedule, setViewingSchedule] = useState<Schedule | null>(null);

  // Column/row highlights for comparison
  const [selectedHighlightTeacherId, setSelectedHighlightTeacherId] = useState<string | null>(null);
  const [selectedHighlightSlot, setSelectedHighlightSlot] = useState<string | null>(null);

  // Drag horizontal scroll
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const isDraggingActive = useRef(false);
  const startX = useRef(0);
  const scrollLeftStart = useRef(0);

  const handleDragMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("input") || target.closest("a")) return;
    isDragging.current = true;
    isDraggingActive.current = false;
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
    setTimeout(() => {
      isDraggingActive.current = false;
    }, 50);
  };

  const handleDragMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging.current) return;
    const x = e.pageX - (scrollContainerRef.current?.offsetLeft || 0);
    const walk = (x - startX.current) * 1.5;
    if (Math.abs(x - startX.current) > 5) {
      isDraggingActive.current = true;
    }
    e.preventDefault();
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollLeft = scrollLeftStart.current - walk;
    }
  };

  const fetchSchedulesForDate = async (date: Date) => {
    setIsLoading(true);
    setError(null);

    try {
      const monday = startOfWeek(date, { weekStartsOn: 1 });
      const sunday = endOfWeek(date, { weekStartsOn: 1 });
      const dateGte = monday.toISOString();
      const dateLte = sunday.toISOString();

      // 1. Fetch teachers
      const teachersRes = await fetch("/api/teachers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ centers: [DEFAULT_CENTRE_ID] }),
      });
      const teachersData = await teachersRes.json();

      if (!teachersData.success) {
        throw new Error(teachersData.error || "Lỗi lấy danh sách giảng viên.");
      }

      const fetchedTeachers: Teacher[] = teachersData.data || [];
      setTeachersList(fetchedTeachers);

      const teacherIds = fetchedTeachers.map((t) => t.id);
      if (teacherIds.length === 0) {
        setSchedules([]);
        return;
      }

      // 2. Fetch schedules
      const schedulesRes = await fetch("/api/teachers/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teacherIds, dateGte, dateLte }),
      });
      const schedulesData = await schedulesRes.json();

      if (schedulesData.success) {
        setSchedules(schedulesData.data || []);
      } else {
        throw new Error(schedulesData.error || "Lỗi lấy lịch giảng dạy.");
      }
    } catch (err: any) {
      setError(err?.message || "Lỗi kết nối API.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedulesForDate(selectedDate);
  }, [selectedDate]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (datePickerRef.current && !datePickerRef.current.contains(e.target as Node)) {
        setIsDatePickerOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

  const timeToMinutes = (timeStr: string): number => {
    if (!timeStr) return 0;
    const hhmm = extractHHMM(timeStr);
    if (hhmm) return hhmm.hours * 60 + hhmm.minutes;
    return 0;
  };

  const getShortClassName = (name: string): string => {
    if (!name) return "";
    return name
      .replace(/^(TDM|DA|TA|SG|OL|HN|BH|HP|QN|VTH|NT|HĐ|NX)-/i, "")
      .replace(/^(C4K|ROB|ART)-/i, "");
  };

  const getShortTeacherName = (fullName: string): string => {
    if (!fullName) return "";
    const parts = fullName.trim().split(/\s+/);
    if (parts.length <= 2) return fullName;
    return parts.slice(-2).join(" ");
  };

  const centerSchedules = useMemo(() => {
    return schedules.filter((s) => s.type === "CLASS_SESSION" || s.type === "OFFICE_HOURS");
  }, [schedules]);

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

  const getColDuration = useMemo(() => {
    const durations = displayedSlots.map((currentSlot, colIdx) => {
      if (!currentSlot) return 120;
      const [currentDate, currentStartStr] = currentSlot.split("_");
      const currentStart = timeToMinutes(currentStartStr);
      if (colIdx + 1 < displayedSlots.length) {
        const [nextDate, nextStartStr] = displayedSlots[colIdx + 1].split("_");
        if (nextDate === currentDate) {
          return timeToMinutes(nextStartStr) - currentStart;
        }
      }
      return 120;
    });
    return (colIdx: number) => durations[colIdx] ?? 120;
  }, [displayedSlots]);

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

  // Exact colSpan and Card Width Math ported directly from frontend/src/app/dashboard/schedules/page.tsx
  const computedGrid = useMemo(() => {
    const grid: Record<string, Record<string, {
      schedules: Schedule[];
      colSpan: number;
      skip: boolean;
      cards: { left: string; width: string }[];
    }>> = {};

    displayedTeachers.forEach((teacher) => {
      grid[teacher.id] = {};
      
      displayedSlots.forEach((slot) => {
        grid[teacher.id][slot] = {
          schedules: [],
          colSpan: 1,
          skip: false,
          cards: []
        };
      });

      const skipSlots = new Set<string>();

      displayedSlots.forEach((slot, colIndex) => {
        if (skipSlots.has(slot)) {
          grid[teacher.id][slot].skip = true;
          return;
        }

        const cellSchedules = schedulesByTeacher[teacher.id]?.[slot] || [];
        grid[teacher.id][slot].schedules = cellSchedules;

        if (cellSchedules.length > 0) {
          let maxSpan = 1;
          cellSchedules.forEach((sch) => {
            let actualEndMin = timeToMinutes(getLocalTime(sch.endTime));
            const [slotDate] = slot.split("_");

            let span = 1;
            for (let idx = colIndex + 1; idx < displayedSlots.length; idx++) {
              const [nextDate, nextTimeStr] = displayedSlots[idx].split("_");
              if (nextDate !== slotDate) break;
              const nextTimeMin = timeToMinutes(nextTimeStr);
              if (actualEndMin > nextTimeMin) {
                span++;
              } else {
                break;
              }
            }
            if (span > maxSpan) maxSpan = span;
          });

          grid[teacher.id][slot].colSpan = maxSpan;

          for (let offset = 1; offset < maxSpan; offset++) {
            const nextIdx = colIndex + offset;
            if (nextIdx < displayedSlots.length) {
              skipSlots.add(displayedSlots[nextIdx]);
            }
          }

          // Compute exact width & left percentage per card
          const cards: { left: string; width: string }[] = [];
          cellSchedules.forEach((sch) => {
            const actualStartMin = timeToMinutes(getLocalTime(sch.startTime));
            let actualEndMin = timeToMinutes(getLocalTime(sch.endTime));

            const getXCoordinate = (timeMin: number) => {
              for (let colOffset = 0; colOffset < maxSpan; colOffset++) {
                const currentIdx = colIndex + colOffset;
                const slotKey = displayedSlots[currentIdx];
                if (!slotKey) continue;
                const [_, currentStartStr] = slotKey.split("_");
                const colStart = timeToMinutes(currentStartStr);
                const colDur = getColDuration(currentIdx);
                const colEnd = colStart + colDur;
                
                if (timeMin >= colStart && timeMin <= colEnd) {
                  const posInCol = (timeMin - colStart) / colDur;
                  return colOffset + posInCol;
                }
              }
              if (timeMin < timeToMinutes(slot.split("_")[1])) return 0;
              return maxSpan;
            };

            const xStart = getXCoordinate(actualStartMin);
            const xEnd = getXCoordinate(actualEndMin);
            
            let leftPercent = (xStart / maxSpan) * 100;
            let widthPercent = ((xEnd - xStart) / maxSpan) * 100;
            if (leftPercent + widthPercent > 100) {
              widthPercent = 100 - leftPercent;
            }

            cards.push({
              left: `${leftPercent}%`,
              width: `${widthPercent}%`
            });
          });

          grid[teacher.id][slot].cards = cards;
        }
      });
    });

    return grid;
  }, [displayedTeachers, displayedSlots, schedulesByTeacher, getColDuration]);

  const dayMap: Record<number, string> = {
    0: "CN",
    1: "Thứ 2",
    2: "Thứ 3",
    3: "Thứ 4",
    4: "Thứ 5",
    5: "Thứ 6",
    6: "Thứ 7",
  };

  const getDayHeaderBg = (slot: string) => {
    const [dateStr] = slot.split("_");
    const slotDate = new Date(dateStr);
    const isToday = isSameDay(slotDate, new Date());
    if (isToday) {
      return "bg-primary/10 text-primary font-bold border-b-2 border-primary shadow-2xs";
    }
    const dayIndex = slotDate.getDay();
    if (dayIndex === 0 || dayIndex === 6) {
      return "bg-muted/60 text-muted-foreground";
    }
    return "bg-card text-foreground";
  };

  const getDayCellBg = (slot: string) => {
    const [dateStr] = slot.split("_");
    const slotDate = new Date(dateStr);
    const isToday = isSameDay(slotDate, new Date());
    if (isToday) {
      return "bg-primary/[0.03] dark:bg-primary/[0.06]";
    }
    const dayIndex = slotDate.getDay();
    if (dayIndex === 0 || dayIndex === 6) {
      return "bg-muted/20";
    }
    return "bg-card hover:bg-accent/30";
  };

  const formatSlotHeader = (slotKey: string) => {
    const [dateStr, timeStr] = slotKey.split("_");
    try {
      const parts = dateStr.split("-");
      const dateObj = new Date(
        parseInt(parts[0]),
        parseInt(parts[1]) - 1,
        parseInt(parts[2])
      );
      const isToday = isSameDay(dateObj, new Date());
      const dayLabel = dayMap[dateObj.getDay()];
      const displayDay = dayLabel.replace("Thứ ", "T");
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
    if (sch.type === "OFFICE_HOURS") {
      return "bg-[#eab308] text-slate-950 border-[#ca8a04] font-semibold shadow-2xs";
    }

    if (sch.type === "CLASS_SESSION") {
      const className = sch.classSite?.class?.name || sch.title || "";
      const sessionIdx = sch.sessionIndex || extractSessionIndex(sch.title, sch.description);
      const total = sch.totalSessions || 14;
      const examType = getSessionExamType(className, sch.title, sch.description, sessionIdx || undefined, total);

      if (examType === "checkpoint1" || examType === "checkpoint2") {
        return "bg-[#d97706] text-white border-[#b45309] shadow-2xs font-semibold";
      }
      if (examType === "demo") {
        return "bg-[#059669] text-white border-[#047857] shadow-2xs font-semibold";
      }
      return "bg-[#000056] dark:bg-[#000056] text-white border-[#000056] shadow-2xs hover:bg-[#08086b]";
    }

    return "bg-muted text-foreground border-border";
  };

  const renderRoleBadge = (sch: Schedule) => {
    if (!sch.teacherRole || sch.teacherRole.trim() === "") return null;
    const upper = sch.teacherRole.toUpperCase().trim();
    let label = "";
    let bgClass = "";

    if (upper === "LEC" || upper === "LECTURER" || upper === "GIẢNG VIÊN") {
      label = "GV";
      bgClass = "bg-[#E31F26] text-white border-[#E31F26] font-extrabold shadow-2xs";
    } else if (upper === "TA" || upper === "TEACHING_ASSISTANT" || upper === "TRỢ GIẢNG") {
      label = "TG";
      bgClass = "bg-[#FFD62D] text-slate-950 border-[#eab308] font-extrabold shadow-2xs";
    } else if (upper === "GK" || upper === "EXAMINER" || upper === "EXAM" || upper === "JUDGE" || upper.includes("GK") || upper.includes("EXAM")) {
      label = "GK";
      bgClass = "bg-purple-600 text-white border-purple-600 font-extrabold shadow-2xs";
    } else if (upper === "DT" || upper === "SUBSTITUTE" || upper === "COVER" || upper === "SUB" || upper.includes("DT") || upper.includes("SUB")) {
      label = "DT";
      bgClass = "bg-rose-600 text-white border-rose-600 font-extrabold shadow-2xs";
    } else {
      return null;
    }

    return (
      <span className={`text-[8.5px] md:text-[9.5px] px-1 py-0.5 rounded-[4px] font-sans shrink-0 leading-none border ${bgClass}`}>
        {label}
      </span>
    );
  };

  const getScheduleTitle = (sch: Schedule) => {
    const centerName = sch.classSite?.centre?.name || sch.officeHour?.centre?.name || "—";
    const start = getLocalTime(sch.startTime);
    const end = getLocalTime(sch.endTime);

    let roleName = sch.teacherRole;
    if (roleName) {
      const upper = roleName.toUpperCase();
      if (upper === "LEC" || upper === "LECTURER") roleName = "Giảng viên (GV)";
      else if (upper === "TA" || upper === "TEACHING_ASSISTANT") roleName = "Trợ giảng (TG)";
    }
    const rolePart = roleName ? `\nVai trò: ${roleName}` : "";
    return `${start} - ${end}\nCơ sở: ${centerName}${rolePart}\nGhi chú: ${sch.description || sch.officeHour?.type || "—"}`;
  };

  const weekStr = `${format(startOfWeek(selectedDate, { weekStartsOn: 1 }), "dd/MM/yy")} - ${format(endOfWeek(selectedDate, { weekStartsOn: 1 }), "dd/MM/yy")}`;

  return (
    <div className="p-3 sm:p-6 space-y-4 h-[calc(100vh-20px)] overflow-hidden flex flex-col bg-background text-foreground font-sans">
      {/* MindX Brand Line */}
      <div className="h-1 w-full bg-mindx-accent-gradient shrink-0 rounded-full" />

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

          <div className="relative w-full sm:w-48 lg:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Tìm theo tên giáo viên..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 w-full shadow-2xs"
            />
          </div>
        </div>
      </div>

      {/* Main Table Matrix Grid Container */}
      <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden relative flex-1 flex flex-col">
        {isLoading && (
          <div className="absolute inset-0 z-50 bg-card/80 backdrop-blur-xs flex items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-7 w-7 text-primary animate-spin" />
              <span className="text-xs font-semibold text-muted-foreground">Đang tải lịch giảng dạy từ LMS...</span>
            </div>
          </div>
        )}

        <div
          ref={scrollContainerRef}
          className="overflow-auto flex-1 no-vertical-scrollbar cursor-grab active:cursor-grabbing select-none"
          onMouseDown={handleDragMouseDown}
          onMouseMove={handleDragMouseMove}
          onMouseUp={handleDragMouseUpOrLeave}
          onMouseLeave={handleDragMouseUpOrLeave}
        >
          <table className="w-max min-w-full border-collapse text-xs">
            <thead>
              <tr className="border-b-2 border-border sticky top-0 z-40 bg-muted">
                <th
                  onClick={() => {
                    setSelectedHighlightTeacherId(null);
                    setSelectedHighlightSlot(null);
                  }}
                  className="sticky left-0 top-0 z-50 bg-slate-100 dark:bg-slate-800/90 backdrop-blur-md min-w-[150px] md:min-w-[170px] max-w-[190px] border-r border-border text-foreground font-bold text-xs p-2.5 shadow-[4px_0_10px_-3px_rgba(0,0,0,0.06)] cursor-pointer select-none text-left"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-foreground font-bold">
                      <User className="h-3.5 w-3.5 text-primary" />
                      Giáo viên
                    </span>
                    <span className="px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-mono text-[10px] font-bold">
                      {displayedTeachers.length}
                    </span>
                  </div>
                </th>
                {displayedSlots.map((slot) => (
                  <th
                    key={slot}
                    onClick={() =>
                      setSelectedHighlightSlot(selectedHighlightSlot === slot ? null : slot)
                    }
                    className={`sticky top-0 z-40 border-r border-border min-w-[70px] md:min-w-[72px] p-0.5 text-center cursor-pointer select-none ${getDayHeaderBg(slot)}`}
                  >
                    {formatSlotHeader(slot)}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-border">
              {displayedTeachers.length === 0 && !isLoading ? (
                <tr>
                  <td
                    colSpan={displayedSlots.length + 1}
                    className="text-center py-16 text-muted-foreground bg-card"
                  >
                    {search ? "Không tìm thấy giáo viên nào." : "Không có dữ liệu giáo viên."}
                  </td>
                </tr>
              ) : (
                displayedTeachers.map((teacher) => {
                  const isTeacherHighlighted = selectedHighlightTeacherId === teacher.id;
                  return (
                    <tr
                      key={teacher.id}
                      className={`group border-b border-border ${
                        isTeacherHighlighted ? "bg-primary/5" : ""
                      }`}
                    >
                      <td
                        onClick={() =>
                          setSelectedHighlightTeacherId(
                            selectedHighlightTeacherId === teacher.id ? null : teacher.id
                          )
                        }
                        className={`sticky left-0 z-30 border-r border-border px-3 py-2.5 align-middle min-w-[140px] md:min-w-[160px] max-w-[180px] cursor-pointer bg-card transition-all shadow-[4px_0_10px_-3px_rgba(0,0,0,0.05)] ${
                          isTeacherHighlighted
                            ? "bg-primary/10 border-l-4 border-l-primary font-bold text-primary"
                            : "hover:bg-muted/50 border-l-4 border-l-transparent"
                        }`}
                      >
                        <span
                          className="font-bold text-xs text-foreground truncate block leading-tight hover:text-primary transition-colors"
                          title={teacher.fullName}
                        >
                          {teacher.fullName}
                        </span>
                      </td>

                      {displayedSlots.map((slot) => {
                        const cellData = computedGrid[teacher.id]?.[slot];
                        if (!cellData || cellData.skip) return null;

                        const { schedules: cellSchedules, colSpan } = cellData;
                        const isSlotHighlighted = selectedHighlightSlot === slot;
                        const isCellHighlighted = isTeacherHighlighted || isSlotHighlighted;

                        return (
                          <td
                            key={slot}
                            colSpan={colSpan}
                            onClick={() =>
                              setSelectedHighlightSlot(selectedHighlightSlot === slot ? null : slot)
                            }
                            className={`relative hover:z-[60] border-r border-border p-0 align-top cursor-pointer transition-all ${
                              colSpan === 1 ? "min-w-[70px] md:min-w-[72px]" : ""
                            } ${getDayCellBg(slot)} ${isCellHighlighted ? "bg-primary/10" : ""}`}
                          >
                            {cellSchedules.length > 0 && (
                              <div className="flex flex-col w-full h-full gap-[1px] relative min-h-[48px]">
                                {cellSchedules.map((sch, i) => {
                                  const cardData = cellData.cards[i];

                                  return (
                                    <div
                                      key={i}
                                      className="relative group/tooltip hover:z-[100] transition-all"
                                      style={{
                                        marginLeft: cardData?.left || "0%",
                                        width: cardData?.width || "100%",
                                      }}
                                    >
                                      <div
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setViewingSchedule(sch);
                                        }}
                                        className={`w-full cursor-pointer overflow-hidden p-1.5 transition-all hover:brightness-95 rounded ${getScheduleStyle(sch)}`}
                                        title={getScheduleTitle(sch)}
                                      >
                                        <div className="flex flex-col gap-0.5 w-full">
                                          <div className="flex items-center justify-between gap-1 w-full">
                                            <span className="font-bold truncate text-[9px] md:text-[10px] block leading-tight flex-1">
                                              {sch.classSite?.class?.name
                                                ? getShortClassName(sch.classSite.class.name)
                                                : (sch.type === "OFFICE_HOURS" ? "OFFICE" : sch.type)}
                                            </span>
                                            <div className="flex items-center gap-1 shrink-0">
                                              {renderRoleBadge(sch)}
                                            </div>
                                          </div>
                                          <div className="text-[8.5px] md:text-[9px] opacity-90 font-medium flex items-center justify-end mt-0.5">
                                             {(() => {
                                               if (sch.type !== "CLASS_SESSION") return null;
                                               const className = sch.classSite?.class?.name || sch.title || "";
                                               const sessionIdx = sch.sessionIndex || extractSessionIndex(sch.title, sch.description) || 1;
                                               const total = sch.totalSessions || 14;
                                               const examType = getSessionExamType(className, sch.title, sch.description, sessionIdx, total);

                                               if (examType === "checkpoint1") return <span className="text-[8.5px] font-bold opacity-95 text-white/90">Checkpoint 1</span>;
                                               if (examType === "checkpoint2") return <span className="text-[8.5px] font-bold opacity-95 text-white/90">Checkpoint 2</span>;
                                               if (examType === "demo") return <span className="text-[8.5px] font-bold opacity-95 text-white/90">Demo</span>;
                                               return <span className="text-[8.5px] font-semibold opacity-95 text-white/90">Buổi {sessionIdx}</span>;
                                             })()}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
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

      {/* Schedule Detail Dialog */}
      <Dialog open={!!viewingSchedule} onOpenChange={() => setViewingSchedule(null)}>
        <DialogContent className="sm:max-w-md rounded-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary font-bold text-base">
              <Info className="h-5 w-5 text-primary" />
              Chi tiết ca giảng dạy
            </DialogTitle>
            <DialogDescription className="text-xs">Thông tin chi tiết từ LMS MindX</DialogDescription>
          </DialogHeader>

          {viewingSchedule && (
            <div className="space-y-4 text-sm py-2">
              <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tên Lớp Học</span>
                <p className="font-bold text-foreground text-base mt-0.5">
                  {viewingSchedule.classSite?.class?.name || viewingSchedule.title}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-2.5 bg-muted/50 rounded-lg border border-border">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                    <Clock className="h-3.5 w-3.5 text-primary" />
                    <span className="font-semibold">Thời gian</span>
                  </div>
                  <p className="font-bold text-xs font-mono">
                    {getLocalTime(viewingSchedule.startTime)} - {getLocalTime(viewingSchedule.endTime)}
                  </p>
                </div>

                <div className="p-2.5 bg-muted/50 rounded-lg border border-border">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                    <User className="h-3.5 w-3.5 text-primary" />
                    <span className="font-semibold">Vai trò</span>
                  </div>
                  <p className="font-bold text-xs text-primary">
                    {viewingSchedule.teacherRole || "Giảng viên"}
                  </p>
                </div>
              </div>

              {viewingSchedule.description && (
                <div>
                  <span className="text-xs font-semibold text-muted-foreground">Ghi chú / Mô tả:</span>
                  <p className="text-xs bg-muted p-2.5 rounded-lg border border-border mt-1">
                    {viewingSchedule.description}
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
