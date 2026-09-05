import { useState, useEffect, useMemo } from "react";
import {
  X,
  Calendar,
  Users,
  FileText,
  CheckCircle2,
  Circle,
  Search,
  BookOpen,
  CheckSquare,
  Copy,
  Check,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TeacherPayrollSummary,
  formatDateString,
  SessionLog,
  getSessionCategory,
} from "@/lib/payrollParser";

interface TeacherSessionDrawerProps {
  teacher: TeacherPayrollSummary | null;
  onClose: () => void;
  checkedSessionMap?: Record<string, boolean>;
  onToggleSessionCheck?: (sessionId: string) => void;
  onToggleAllTeacherSessions?: (teacher: TeacherPayrollSummary) => void;
}

export function TeacherSessionDrawer({
  teacher,
  onClose,
  checkedSessionMap = {},
  onToggleSessionCheck,
  onToggleAllTeacherSessions,
}: TeacherSessionDrawerProps) {
  const [drawerSearch, setDrawerSearch] = useState("");
  const [drawerStatusFilter, setDrawerStatusFilter] = useState<"all" | "checked" | "unchecked">("all");
  const [drawerCategoryFilter, setDrawerCategoryFilter] = useState<string>("all");
  const [copiedSessionId, setCopiedSessionId] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const categoryStats = useMemo(() => {
    const map: Record<string, number> = {
      TA: 0,
      LEC: 0,
      Judge: 0,
      Supply: 0,
      Fixed: 0,
      Makeup: 0,
      Trial: 0,
    };

    if (!teacher?.sessions) return map;

    teacher.sessions.forEach((s) => {
      const cat = getSessionCategory(s);
      map[cat] = Math.round(((map[cat] || 0) + s.duration) * 10) / 10;
    });

    return map;
  }, [teacher?.sessions]);

  if (!teacher) return null;

  const totalSessions = teacher.sessions.length;
  const checkedSessionsCount = teacher.sessions.filter((s) => checkedSessionMap[s.id]).length;
  const uncheckedSessionsCount = totalSessions - checkedSessionsCount;
  const isFullyChecked = totalSessions > 0 && checkedSessionsCount === totalSessions;

  const filteredSessions = teacher.sessions.filter((s) => {
    const isSessionChecked = Boolean(checkedSessionMap[s.id]);
    if (drawerStatusFilter === "checked" && !isSessionChecked) return false;
    if (drawerStatusFilter === "unchecked" && isSessionChecked) return false;

    const cat = getSessionCategory(s);
    if (drawerCategoryFilter !== "all" && cat !== drawerCategoryFilter) {
      return false;
    }

    if (!drawerSearch.trim()) return true;
    const q = drawerSearch.toLowerCase();
    return (
      s.className?.toLowerCase().includes(q) ||
      s.course?.toLowerCase().includes(q) ||
      s.date?.toLowerCase().includes(q) ||
      s.role?.toLowerCase().includes(q) ||
      s.note?.toLowerCase().includes(q)
    );
  });

  const handleCopySession = (s: SessionLog) => {
    const isSessionChecked = Boolean(checkedSessionMap[s.id]);
    const formattedDate = formatDateString(s.date);
    const textToCopy = `📋 THÔNG TIN CA DẠY:
• Giảng viên: ${teacher.name} (${teacher.email || teacher.username || "N/A"})
• Lớp học: ${s.className || "N/A"}
• Môn/Khóa: ${s.course || "N/A"}
• Vai trò: ${s.role || "N/A"} (${s.duration} giờ)
• Thời gian: ${formattedDate}
• Cơ sở: ${s.center || teacher.center || "N/A"}
• Trạng thái Check: ${isSessionChecked ? "Checked" : "Uncheck"}
${s.note ? `• Ghi chú: ${s.note}` : ""}`;

    navigator.clipboard.writeText(textToCopy);
    setCopiedSessionId(s.id);
    setTimeout(() => setCopiedSessionId(null), 2000);
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm flex justify-end animate-drawer-backdrop"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl bg-card border-l border-border h-[100dvh] max-h-[100dvh] flex flex-col shadow-2xl animate-drawer-panel"
      >
        {/* Drawer Header */}
        <div className="p-4 sm:p-6 bg-slate-900 text-slate-100 border-b border-slate-800 flex items-start justify-between gap-3">
          <div className="space-y-1.5 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-slate-300 text-[11px] font-semibold">
                {teacher.center || "Cơ sở MindX"}
              </span>
              <span className="px-2.5 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-slate-200 text-[11px] font-bold font-mono">
                {teacher.totalHours}h ({teacher.totalSessions} ca)
              </span>

              {onToggleAllTeacherSessions && (
                <button
                  type="button"
                  onClick={() => onToggleAllTeacherSessions(teacher)}
                  className={`px-2.5 py-0.5 rounded-md text-[11px] font-semibold flex items-center gap-1 transition-all duration-200 active:scale-95 cursor-pointer border ${
                    isFullyChecked
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30"
                      : checkedSessionsCount > 0
                      ? "bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30"
                      : "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700"
                  }`}
                >
                  {isFullyChecked ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                      <span>Checked ({checkedSessionsCount}/{totalSessions})</span>
                    </>
                  ) : checkedSessionsCount > 0 ? (
                    <>
                      <CheckSquare className="h-3.5 w-3.5 text-amber-400" />
                      <span>Checked ({checkedSessionsCount}/{totalSessions})</span>
                    </>
                  ) : (
                    <>
                      <Circle className="h-3.5 w-3.5 opacity-60" />
                      <span>Check tất cả</span>
                    </>
                  )}
                </button>
              )}
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight truncate">{teacher.name}</h2>
            <p className="text-xs text-slate-400 font-mono truncate">
              {teacher.email || teacher.username || "Chưa có email"}
            </p>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-slate-400 hover:text-white hover:bg-slate-800 active:scale-90 transition-all rounded-xl h-8 w-8 shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Roles & Categories Breakdown Summary Bar */}
        <div className="px-4 sm:px-6 py-2.5 bg-muted/40 border-b border-border/80 flex items-center flex-wrap gap-2 text-xs font-medium">
          <span className="text-muted-foreground mr-1">Phân bổ loại ca:</span>
          {Object.entries(categoryStats)
            .filter(([_, hours]) => hours > 0)
            .map(([cat, hours]) => (
              <span
                key={cat}
                className="px-2 py-0.5 rounded-md text-[11px] font-semibold font-mono bg-background border border-border text-foreground"
              >
                {cat}: {hours}h
              </span>
            ))}
        </div>

        {/* Search Bar & Status Filter Pills inside Drawer */}
        <div className="px-4 sm:px-6 pt-4 pb-2 space-y-2.5">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Tìm lớp, môn học, ngày dạy trong ca..."
                value={drawerSearch}
                onChange={(e) => setDrawerSearch(e.target.value)}
                className="h-8 pl-8 text-xs rounded-xl bg-background border-border focus-visible:ring-primary/30 transition-all"
              />
            </div>

            {/* Category Filter Dropdown */}
            <div className="w-full sm:w-auto min-w-[150px]">
              <Select value={drawerCategoryFilter} onValueChange={setDrawerCategoryFilter}>
                <SelectTrigger className="h-8 bg-background text-xs rounded-xl border-border">
                  <div className="flex items-center gap-1.5 truncate">
                    <Filter className="h-3 w-3 text-muted-foreground shrink-0" />
                    <SelectValue placeholder="Tất cả loại ca" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả loại ca ({teacher.sessions.length})</SelectItem>
                  <SelectItem value="TA">TA (Trợ Giảng: {categoryStats.TA || 0}h)</SelectItem>
                  <SelectItem value="LEC">LEC (Giảng Viên: {categoryStats.LEC || 0}h)</SelectItem>
                  <SelectItem value="Judge">Judge (Giám Khảo: {categoryStats.Judge || 0}h)</SelectItem>
                  <SelectItem value="Supply">Supply (Dạy Thay: {categoryStats.Supply || 0}h)</SelectItem>
                  <SelectItem value="Fixed">Fixed (Lớp Cố Định: {categoryStats.Fixed || 0}h)</SelectItem>
                  <SelectItem value="Makeup">Makeup (Dạy Bù: {categoryStats.Makeup || 0}h)</SelectItem>
                  <SelectItem value="Trial">Trial (Học Thử: {categoryStats.Trial || 0}h)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Sub Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <button
              type="button"
              onClick={() => setDrawerStatusFilter("all")}
              className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all duration-200 cursor-pointer ${
                drawerStatusFilter === "all"
                  ? "bg-primary text-white shadow-2xs"
                  : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              }`}
            >
              Tất cả ({totalSessions})
            </button>

            <button
              type="button"
              onClick={() => setDrawerStatusFilter("checked")}
              className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all duration-200 cursor-pointer flex items-center gap-1 ${
                drawerStatusFilter === "checked"
                  ? "bg-emerald-600 text-white shadow-2xs"
                  : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20"
              }`}
            >
              <CheckCircle2 className="h-3 w-3" />
              <span>Checked ({checkedSessionsCount})</span>
            </button>

            <button
              type="button"
              onClick={() => setDrawerStatusFilter("unchecked")}
              className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all duration-200 cursor-pointer flex items-center gap-1 ${
                drawerStatusFilter === "unchecked"
                  ? "bg-amber-600 text-white shadow-2xs"
                  : "bg-amber-500/10 text-amber-800 dark:text-amber-200 hover:bg-amber-500/20"
              }`}
            >
              <Circle className="h-3 w-3 opacity-60" />
              <span>Uncheck ({uncheckedSessionsCount})</span>
            </button>
          </div>
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 pt-2 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-primary" />
              Danh sách ca dạy ({filteredSessions.length}/{teacher.sessions.length} ca):
            </h3>

            {onToggleAllTeacherSessions && (
              <button
                type="button"
                onClick={() => onToggleAllTeacherSessions(teacher)}
                className="text-[11px] font-bold text-primary hover:underline active:scale-95 transition-transform cursor-pointer"
              >
                {isFullyChecked ? "Uncheck tất cả" : "Check tất cả"}
              </button>
            )}
          </div>

          <div className="space-y-2.5">
            {filteredSessions.length === 0 ? (
              <p className="text-center py-8 text-xs text-muted-foreground italic">
                Không tìm thấy ca dạy nào phù hợp với bộ lọc.
              </p>
            ) : (
              filteredSessions.map((s, idx) => {
                const isSessionChecked = Boolean(checkedSessionMap[s.id]);
                const isCopied = copiedSessionId === s.id;
                const isTrial = getSessionCategory(s) === "Trial";

                return (
                  <div
                    key={s.id || idx}
                    style={{ animationDelay: `${Math.min(idx * 35, 350)}ms` }}
                    className={`p-3 sm:p-3.5 rounded-xl border transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-backwards ${
                      isSessionChecked
                        ? "bg-emerald-500/5 border-emerald-500/30 hover:border-emerald-500/50"
                        : "bg-card border-border/80 hover:border-primary/40"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-md bg-muted text-foreground border border-border/80 font-mono shrink-0">
                          {s.role || "LEC"}
                        </span>
                        <span className="text-xs font-bold text-foreground font-mono truncate">
                          {s.className}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 self-end sm:self-auto">
                        <span className="text-xs font-bold font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-md">
                          +{s.duration}h
                        </span>

                        {/* Copy Info Button */}
                        <button
                          type="button"
                          onClick={() => handleCopySession(s)}
                          title="Copy thông tin ca dạy này"
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10.5px] font-bold transition-all duration-200 active:scale-95 border cursor-pointer ${
                            isCopied
                              ? "bg-primary text-white border-primary shadow-2xs"
                              : "bg-muted/90 text-muted-foreground border-border hover:bg-primary/10 hover:text-primary hover:border-primary/30"
                          }`}
                        >
                          {isCopied ? (
                            <>
                              <Check className="h-3.5 w-3.5 shrink-0" />
                              <span>Đã Copy</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-3.5 w-3.5 shrink-0" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>

                        {/* Check / Uncheck Toggle Button */}
                        {onToggleSessionCheck && (
                          <button
                            type="button"
                            onClick={() => onToggleSessionCheck(s.id)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10.5px] font-bold transition-all duration-200 active:scale-95 border cursor-pointer group/sessionBtn ${
                              isSessionChecked
                                ? "bg-emerald-500 text-white border-emerald-600 shadow-2xs hover:bg-emerald-600 hover:shadow-xs"
                                : "bg-muted text-muted-foreground border-border hover:bg-muted/80 hover:text-foreground hover:border-primary/40"
                            }`}
                          >
                            {isSessionChecked ? (
                              <>
                                <CheckCircle2 className="h-3.5 w-3.5 group-hover/sessionBtn:scale-110 transition-transform duration-200" />
                                <span>Checked</span>
                              </>
                            ) : (
                              <>
                                <Circle className="h-3.5 w-3.5 opacity-50 group-hover/sessionBtn:scale-110 transition-transform duration-200" />
                                <span>Uncheck</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-muted-foreground/70 shrink-0" />
                        <span className="font-mono">{formatDateString(s.date)}</span>
                      </div>
                      {s.studentCount > 0 && (
                        <div className="flex items-center gap-1">
                          <Users className="h-3 w-3 text-muted-foreground/70 shrink-0" />
                          <span>{s.studentCount} Học sinh</span>
                        </div>
                      )}
                    </div>

                    {s.note && (
                      <p className="text-[11px] text-muted-foreground bg-muted/40 p-2 rounded-lg italic">
                        📝 {s.note}
                      </p>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


