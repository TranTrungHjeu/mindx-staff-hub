import { useEffect, useState, useMemo } from "react";
import {
  Building2,
  Users,
  Clock,
  ChevronRight,
  Cloud,
  CheckCircle2,
  Circle,
  CheckSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { TeacherSessionDrawer } from "./TeacherSessionDrawer";
import { PayrollToolbar } from "./PayrollToolbar";
import { R2ManagerModal } from "./R2ManagerModal";
import {
  parsePayrollData,
  PayrollParsedResult,
  TeacherPayrollSummary,
  getSessionCategory,
} from "@/lib/payrollParser";
import { getR2FilesFromCloud, fetchR2FileBuffer, R2PayrollFile } from "@/lib/r2Storage";

interface PayrollViewProps {
  onSwitchToSchedules: () => void;
}

const DEFAULT_TARGET_CENTER = "230ĐLBD";

export function PayrollView({ onSwitchToSchedules }: PayrollViewProps) {
  const [r2Files, setR2Files] = useState<R2PayrollFile[]>([]);
  const [activeFile, setActiveFile] = useState<R2PayrollFile | null>(null);

  const [payrollData, setPayrollData] = useState<PayrollParsedResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters state
  const [search, setSearch] = useState("");
  const [selectedCenter, setSelectedCenter] = useState<string>(DEFAULT_TARGET_CENTER);
  const [selectedRole, setSelectedRole] = useState("");
  const [minHoursFilter, setMinHoursFilter] = useState<number>(0);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<string>("hours_desc");

  // Check Status Map per Session ID
  const [checkedSessionMap, setCheckedSessionMap] = useState<Record<string, boolean>>({});

  const [selectedTeacher, setSelectedTeacher] = useState<TeacherPayrollSummary | null>(null);
  const [isR2ModalOpen, setIsR2ModalOpen] = useState(false);

  // Load checked session statuses from localStorage when active file changes
  useEffect(() => {
    if (!activeFile?.id) return;
    try {
      const stored = localStorage.getItem(`mindx_checked_sessions_${activeFile.id}`);
      if (stored) {
        setCheckedSessionMap(JSON.parse(stored));
      } else {
        setCheckedSessionMap({});
      }
    } catch (e) {
      setCheckedSessionMap({});
    }
  }, [activeFile?.id]);

  const toggleSessionCheck = (sessionId: string) => {
    setCheckedSessionMap((prev) => {
      const next = { ...prev, [sessionId]: !prev[sessionId] };
      if (activeFile?.id) {
        localStorage.setItem(`mindx_checked_sessions_${activeFile.id}`, JSON.stringify(next));
      }
      return next;
    });
  };

  const toggleAllTeacherSessions = (teacher: TeacherPayrollSummary, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setCheckedSessionMap((prev) => {
      const allChecked = teacher.sessions.length > 0 && teacher.sessions.every((s) => prev[s.id]);
      const next = { ...prev };
      teacher.sessions.forEach((s) => {
        next[s.id] = !allChecked;
      });
      if (activeFile?.id) {
        localStorage.setItem(`mindx_checked_sessions_${activeFile.id}`, JSON.stringify(next));
      }
      return next;
    });
  };

  const loadPayrollFile = async (file: R2PayrollFile | null) => {
    if (!file) {
      setPayrollData(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      let data: PayrollParsedResult;
      let buffer: ArrayBuffer | undefined = file.fileBuffer;

      if (!buffer || buffer.byteLength === 0) {
        try {
          buffer = await fetchR2FileBuffer(file);
        } catch (fetchErr: any) {
          console.warn("Could not fetch binary buffer from Cloudflare R2 public URL", fetchErr);
        }
      }

      if (buffer && buffer.byteLength > 0) {
        data = await parsePayrollData(buffer, file.filename);
      } else {
        data = {
          filename: file.filename,
          summary: { totalTeachers: 0, totalHours: 0, totalSessions: 0, centers: [], roles: [] },
          teachers: [],
        };
      }
      setPayrollData(data);

      // Populate checkedSessionMap directly from parsed Excel file rows (plus local overrides)
      const initialMap: Record<string, boolean> = {};
      data.teachers.forEach((t) => {
        t.sessions.forEach((s) => {
          initialMap[s.id] = Boolean(s.isChecked);
        });
      });

      try {
        const stored = localStorage.getItem(`mindx_checked_sessions_${file.id}`);
        if (stored) {
          const overrides = JSON.parse(stored);
          Object.assign(initialMap, overrides);
        }
      } catch (e) {}

      setCheckedSessionMap(initialMap);

      // Auto-set default center if available in parsed centers list
      if (data.summary.centers && data.summary.centers.length > 0) {
        const matchingCenter = data.summary.centers.find(
          (c) =>
            c.toUpperCase().includes("230") ||
            c.toUpperCase().includes("230ĐLBD") ||
            c.toUpperCase().includes("230 ĐLBD")
        );
        if (matchingCenter) {
          setSelectedCenter(matchingCenter);
        } else if (!data.summary.centers.includes(selectedCenter)) {
          setSelectedCenter(DEFAULT_TARGET_CENTER);
        }
      }
    } catch (err: any) {
      setError(err?.message || "Lỗi đọc dữ liệu công giảng viên.");
    } finally {
      setIsLoading(false);
    }
  };

  const refreshR2Files = async () => {
    setIsLoading(true);
    try {
      const files = await getR2FilesFromCloud();
      setR2Files(files);
      if (files.length > 0) {
        const targetFile = files[0];
        setActiveFile(targetFile);
        await loadPayrollFile(targetFile);
      } else {
        setActiveFile(null);
        setPayrollData(null);
      }
    } catch (err: any) {
      console.error("Error refreshing R2 files:", err);
      setError("Không thể tải danh sách file từ Cloudflare R2.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshR2Files();
  }, []);

  const handleSelectR2File = (file: R2PayrollFile) => {
    setActiveFile(file);
    loadPayrollFile(file);
  };

  const handleExportCSV = () => {
    if (!displayedTeachers || displayedTeachers.length === 0) return;

    let csvContent = "\uFEFF";
    csvContent += "STT,Tên Giảng Viên,Email,Cơ Sở,Số Ca Dạy,Số Ca Checked,Tổng Giờ Dạy,Phân Bổ Vai Trò,Trạng Thái Check\n";

    displayedTeachers.forEach((t, i) => {
      const rolesStr = Object.entries(t.roles)
        .map(([r, h]) => `${r}:${h}h`)
        .join(" | ");
      const checkedSessionsCount = t.sessions.filter((s) => checkedSessionMap[s.id]).length;
      const totalSessionsCount = t.sessions.length;
      const statusStr =
        totalSessionsCount > 0 && checkedSessionsCount === totalSessionsCount
          ? "Checked"
          : checkedSessionsCount > 0
          ? `Checked (${checkedSessionsCount}/${totalSessionsCount})`
          : "Unchecked";

      csvContent += `${i + 1},"${t.name}","${t.email}","${t.center}",${t.totalSessions},${checkedSessionsCount},${t.totalHours},"${rolesStr}","${statusStr}"\n`;
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const monthStr = activeFile ? activeFile.month.replace(/\s+/g, "_") : "Payroll";
    link.setAttribute("download", `Bang_Cong_GV_MindX_${monthStr}_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered & Sorted Teachers list
  const displayedTeachers = useMemo(() => {
    if (!payrollData?.teachers) return [];

    const filtered = payrollData.teachers.filter((t) => {
      if (search) {
        const q = search.toLowerCase();
        const matchName = t.name?.toLowerCase().includes(q);
        const matchEmail = t.email?.toLowerCase().includes(q);
        const matchUsername = t.username?.toLowerCase().includes(q);
        if (!matchName && !matchEmail && !matchUsername) return false;
      }

      if (selectedCenter && t.center !== selectedCenter) {
        return false;
      }

      if (selectedRole) {
        const hasMatchingRole =
          (t.roles[selectedRole] && t.roles[selectedRole] > 0) ||
          t.sessions.some(
            (s) => getSessionCategory(s).toUpperCase() === selectedRole.toUpperCase()
          );
        if (!hasMatchingRole) return false;
      }

      if (minHoursFilter > 0 && t.totalHours < minHoursFilter) {
        return false;
      }

      const total = t.sessions.length;
      const checked = t.sessions.filter((s) => checkedSessionMap[s.id]).length;

      if (statusFilter === "checked" && (total === 0 || checked < total)) {
        return false;
      }
      if (statusFilter === "partial" && (checked === 0 || checked === total)) {
        return false;
      }
      if (statusFilter === "unchecked" && checked > 0) {
        return false;
      }

      return true;
    });

    // Sorting logic
    return filtered.sort((a, b) => {
      if (sortOrder === "hours_desc") return b.totalHours - a.totalHours;
      if (sortOrder === "hours_asc") return a.totalHours - b.totalHours;
      if (sortOrder === "sessions_desc") return b.totalSessions - a.totalSessions;
      if (sortOrder === "name_asc") return a.name.localeCompare(b.name, "vi");
      return 0;
    });
  }, [payrollData, search, selectedCenter, selectedRole, minHoursFilter, statusFilter, checkedSessionMap, sortOrder]);

  // Dynamic KPI Stats based on active filters
  const filteredStats = useMemo(() => {
    const totalTeachers = displayedTeachers.length;
    const totalHours = displayedTeachers.reduce((acc, t) => acc + t.totalHours, 0);
    const totalSessions = displayedTeachers.reduce((acc, t) => acc + t.totalSessions, 0);

    let checkedSessionsTotal = 0;
    displayedTeachers.forEach((t) => {
      t.sessions.forEach((s) => {
        if (checkedSessionMap[s.id]) checkedSessionsTotal += 1;
      });
    });

    return {
      totalTeachers,
      totalHours: Math.round(totalHours * 10) / 10,
      totalSessions,
      checkedSessionsTotal,
    };
  }, [displayedTeachers, checkedSessionMap]);

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden bg-background text-foreground">
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* MindX Top Loading / Brand Line (Trùng hệt vị trí & kích thước trang Schedule) */}
        <div className="px-4 lg:px-6 pt-3 shrink-0">
          <div className="max-w-[1700px] mx-auto h-[3px] w-full bg-muted/40 shrink-0 rounded-full overflow-hidden relative">
            <div
              className={`h-full w-full bg-mindx-accent-gradient rounded-full ${
                isLoading ? "animate-top-loader" : "transition-all duration-300"
              }`}
            />
          </div>
        </div>
          {/* Dynamic KPI Summary Cards Bar */}
          <div className="bg-card/40 border-b border-border px-3 sm:px-4 lg:px-6 py-2.5 sm:py-3.5">
            <div className="max-w-[1700px] mx-auto grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3">
              <div className="p-2.5 sm:p-3.5 rounded-xl bg-card border border-border/80 shadow-2xs hover:border-border transition-all duration-200 cursor-default flex items-center gap-2.5 sm:gap-3.5 min-w-0">
                <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-xl bg-muted text-foreground flex items-center justify-center font-bold shrink-0">
                  <Users className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] sm:text-[11px] font-semibold text-muted-foreground uppercase tracking-wider truncate">
                    Số GV ({selectedCenter ? selectedCenter : "Tất cả"})
                  </p>
                  <p className="text-base sm:text-lg font-extrabold font-mono text-foreground truncate">
                    {filteredStats.totalTeachers} GV
                  </p>
                </div>
              </div>

              <div className="p-2.5 sm:p-3.5 rounded-xl bg-card border border-border/80 shadow-2xs hover:border-border transition-all duration-200 cursor-default flex items-center gap-2.5 sm:gap-3.5 min-w-0">
                <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-xl bg-muted text-foreground flex items-center justify-center font-bold shrink-0">
                  <Clock className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] sm:text-[11px] font-semibold text-muted-foreground uppercase tracking-wider truncate">Tổng giờ dạy</p>
                  <p className="text-base sm:text-lg font-extrabold font-mono text-foreground truncate">
                    {filteredStats.totalHours.toLocaleString()}h
                  </p>
                </div>
              </div>

              <div className="p-2.5 sm:p-3.5 rounded-xl bg-card border border-border/80 shadow-2xs hover:border-border transition-all duration-200 cursor-default flex items-center gap-2.5 sm:gap-3.5 min-w-0">
                <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-xl bg-muted text-foreground flex items-center justify-center font-bold shrink-0">
                  <CheckSquare className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] sm:text-[11px] font-semibold text-muted-foreground uppercase tracking-wider truncate">Trạng Thái Check</p>
                  <p className="text-xs sm:text-sm font-extrabold font-mono text-foreground truncate">
                    <span className="text-emerald-600 dark:text-emerald-400">Checked: {filteredStats.checkedSessionsTotal}</span> / {filteredStats.totalSessions}
                  </p>
                </div>
              </div>

              <div className="p-2.5 sm:p-3.5 rounded-xl bg-card border border-border/80 shadow-2xs hover:border-border transition-all duration-200 cursor-default flex items-center gap-2.5 sm:gap-3.5 min-w-0">
                <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-xl bg-muted text-foreground flex items-center justify-center font-bold shrink-0">
                  <Building2 className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] sm:text-[11px] font-semibold text-muted-foreground uppercase tracking-wider truncate">Kỳ Công Tháng</p>
                  <p className="text-xs sm:text-sm font-extrabold font-mono text-foreground truncate">
                    {activeFile?.month || "Chưa có file"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Operational Toolbar */}
          <PayrollToolbar
            searchQuery={search}
            onSearchChange={setSearch}
            selectedCenter={selectedCenter}
            onCenterChange={setSelectedCenter}
            selectedRole={selectedRole}
            onRoleChange={setSelectedRole}
            minHoursFilter={minHoursFilter}
            onMinHoursChange={setMinHoursFilter}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            sortOrder={sortOrder}
            onSortOrderChange={setSortOrder}
            centersList={payrollData?.summary.centers || [DEFAULT_TARGET_CENTER]}
            rolesList={payrollData?.summary.roles || []}
            r2Files={r2Files}
            activeFileId={activeFile?.id || ""}
            onSelectR2File={handleSelectR2File}
            onOpenR2Modal={() => setIsR2ModalOpen(true)}
            onExport={handleExportCSV}
            isLoading={isLoading}
            onRefresh={refreshR2Files}
          />

          {/* Error Alert */}
          {error && (
            <div className="mx-4 lg:mx-6 mt-3 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-xs text-destructive flex items-center justify-between">
              <span>⚠️ {error}</span>
              <Button size="sm" variant="ghost" onClick={() => loadPayrollFile(activeFile)}>
                Thử lại
              </Button>
            </div>
          )}

          {/* Main Table / Mobile Card List */}
          <div className="flex-1 overflow-auto px-3 sm:px-4 lg:px-6 py-3">
            <div className="max-w-[1700px] mx-auto space-y-3">
              {/* Mobile Card List (< md screens) */}
              <div className="md:hidden space-y-2.5">
                {isLoading && displayedTeachers.length === 0 ? (
                  Array.from({ length: 4 }).map((_, skelIdx) => (
                    <div key={`skel-card-${skelIdx}`} className="p-3.5 rounded-2xl bg-card border border-border animate-pulse space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-muted" />
                        <div className="space-y-1.5 flex-1">
                          <div className="h-4 w-32 bg-muted rounded" />
                          <div className="h-3 w-44 bg-muted/60 rounded" />
                        </div>
                      </div>
                    </div>
                  ))
                ) : displayedTeachers.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground bg-card rounded-2xl border border-border">
                    <p className="text-xs">Không tìm thấy giảng viên phù hợp.</p>
                  </div>
                ) : (
                  displayedTeachers.map((t, idx) => {
                    const totalSessionsCount = t.sessions.length;
                    const checkedSessionsCount = t.sessions.filter((s) => checkedSessionMap[s.id]).length;
                    const isFullyChecked = totalSessionsCount > 0 && checkedSessionsCount === totalSessionsCount;
                    const isPartiallyChecked = checkedSessionsCount > 0 && checkedSessionsCount < totalSessionsCount;

                    return (
                      <div
                        key={t.id || idx}
                        onClick={() => setSelectedTeacher(t)}
                        className="p-3.5 rounded-2xl bg-card border border-border/90 shadow-2xs hover:border-primary/40 transition-all space-y-2.5 cursor-pointer active:scale-[0.99]"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-black text-sm shrink-0 font-mono">
                              {t.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <h4 className="font-bold text-xs text-foreground truncate">{t.name}</h4>
                              <p className="text-[10.5px] text-muted-foreground font-mono truncate">
                                {t.email || t.username || "Chưa cập nhật email"}
                              </p>
                            </div>
                          </div>

                          <span className="px-2 py-0.5 rounded-md bg-muted/80 text-foreground font-semibold text-[10.5px] border border-border/60 shrink-0">
                            {t.center}
                          </span>
                        </div>

                        {/* Hours & Role Badges */}
                        <div className="flex items-center justify-between text-xs pt-1 border-t border-border/50">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {Object.entries(t.roles).map(([r, hours]) => (
                              <span
                                key={r}
                                className="px-2 py-0.5 rounded-md text-[10px] font-bold font-mono bg-muted text-foreground border border-border/60"
                              >
                                {r}: {hours}h
                              </span>
                            ))}
                          </div>

                          <div className="text-right shrink-0">
                            <span className="text-sm font-extrabold font-mono text-foreground">{t.totalHours}h</span>
                            <span className="text-[10px] text-muted-foreground block font-mono">({t.totalSessions} ca)</span>
                          </div>
                        </div>

                        {/* Bottom Actions Row */}
                        <div className="flex items-center justify-between gap-2 pt-1">
                          <button
                            type="button"
                            onClick={(e) => toggleAllTeacherSessions(t, e)}
                            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all border ${
                              isFullyChecked
                                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                                : isPartiallyChecked
                                ? "bg-amber-500/10 text-amber-800 dark:text-amber-200 border-amber-500/30"
                                : "bg-muted text-muted-foreground border-border"
                            }`}
                          >
                            {isFullyChecked ? (
                              <>
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                                <span>Checked ({checkedSessionsCount}/{totalSessionsCount})</span>
                              </>
                            ) : isPartiallyChecked ? (
                              <>
                                <Clock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                                <span>Checked ({checkedSessionsCount}/{totalSessionsCount})</span>
                              </>
                            ) : (
                              <>
                                <Circle className="h-3.5 w-3.5 opacity-50" />
                                <span>Unchecked (0/{totalSessionsCount})</span>
                              </>
                            )}
                          </button>

                          <div className="h-8 w-8 rounded-xl bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                            <ChevronRight className="h-4 w-4" />
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Desktop Table View (>= md screens) */}
              <div className="hidden md:block bg-card rounded-2xl border border-border overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-muted/70 border-b border-border text-muted-foreground font-bold uppercase tracking-wider">
                        <th className="p-3.5 w-12 text-center sticky left-0 z-20 bg-muted/90 backdrop-blur-xs border-r border-border">STT</th>
                        <th className="p-3.5 sticky left-12 z-20 bg-muted/90 backdrop-blur-xs border-r border-border min-w-[200px] max-w-[240px]">Giảng Viên / Nhân Sự</th>
                        <th className="p-3.5">Cơ Sở Trực Thuộc</th>
                        <th className="p-3.5 text-center">Số Ca Dạy</th>
                        <th className="p-3.5">Phân Bổ Vai Trò (LEC / TA / GK / DT)</th>
                        <th className="p-3.5 text-right font-mono">Tổng Giờ Dạy</th>
                        <th className="p-3.5 text-center w-48 min-w-[190px]">Check / Uncheck</th>
                        <th className="p-3.5 w-10"></th>
                      </tr>
                    </thead>

                    <tbody className={`divide-y divide-border/60 transition-all duration-300 ${isLoading && displayedTeachers.length > 0 ? "opacity-50 pointer-events-none" : "opacity-100"}`}>
                      {isLoading && displayedTeachers.length === 0 ? (
                        Array.from({ length: 6 }).map((_, skelIdx) => (
                          <tr key={`skel-${skelIdx}`} className="animate-pulse border-b border-border/40">
                            <td className="p-3.5 text-center sticky left-0 z-10 bg-card border-r border-border">
                              <div className="h-4 w-6 bg-muted/80 rounded-md mx-auto" />
                            </td>
                            <td className="p-3.5 sticky left-12 z-10 bg-card border-r border-border">
                              <div className="space-y-2">
                                <div className="h-4 w-36 bg-muted/90 rounded-md" />
                                <div className="h-3 w-48 bg-muted/50 rounded-md" />
                              </div>
                            </td>
                            <td className="p-3.5">
                              <div className="h-4 w-20 bg-muted/70 rounded-md" />
                            </td>
                            <td className="p-3.5 text-center">
                              <div className="h-4 w-12 bg-muted/70 rounded-md mx-auto" />
                            </td>
                            <td className="p-3.5">
                              <div className="flex gap-1.5">
                                <div className="h-5 w-14 bg-muted/80 rounded-md" />
                                <div className="h-5 w-14 bg-muted/80 rounded-md" />
                              </div>
                            </td>
                            <td className="p-3.5 text-right">
                              <div className="h-4 w-12 bg-muted/90 rounded-md ml-auto" />
                            </td>
                            <td className="p-3.5 text-center">
                              <div className="h-6 w-32 bg-muted/80 rounded-lg mx-auto" />
                            </td>
                            <td className="p-3.5">
                              <div className="h-4 w-4 bg-muted/60 rounded-md mx-auto" />
                            </td>
                          </tr>
                        ))
                      ) : displayedTeachers.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="p-16 text-center text-muted-foreground">
                            <div className="max-w-md mx-auto flex flex-col items-center justify-center space-y-3">
                              <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                                <Cloud className="h-6 w-6" />
                              </div>
                              <div className="space-y-1">
                                <h3 className="text-sm font-bold text-foreground">
                                  {activeFile ? `Chưa có dữ liệu công (${activeFile.month})` : "Chưa có file công lương"}
                                </h3>
                                <p className="text-xs text-muted-foreground">
                                  {!activeFile
                                    ? "Bấm nút Upload File để chọn Tháng/Năm và tải file Excel công lương giảng viên lên hệ thống."
                                    : payrollData?.teachers?.length === 0
                                    ? `Dữ liệu ${activeFile.month} hiện chưa có thông tin.`
                                    : `Không tìm thấy giảng viên phù hợp bộ lọc (Cơ sở: ${selectedCenter || "Tất cả"}).`}
                                </p>
                              </div>
                              <Button
                                size="sm"
                                onClick={() => setIsR2ModalOpen(true)}
                                className="mt-2 text-xs font-bold gap-1.5 bg-primary text-white rounded-xl shadow-xs hover:bg-primary/90"
                              >
                                <Cloud className="h-4 w-4" />
                                <span>Upload File Công Mới</span>
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        displayedTeachers.map((t, idx) => {
                          const totalSessionsCount = t.sessions.length;
                          const checkedSessionsCount = t.sessions.filter((s) => checkedSessionMap[s.id]).length;
                          const isFullyChecked = totalSessionsCount > 0 && checkedSessionsCount === totalSessionsCount;
                          const isPartiallyChecked = checkedSessionsCount > 0 && checkedSessionsCount < totalSessionsCount;

                          return (
                            <tr
                              key={t.id || idx}
                              onClick={() => setSelectedTeacher(t)}
                              className="hover:bg-primary/5 transition-colors cursor-pointer group"
                            >
                              <td className="p-3.5 text-center font-mono font-bold text-muted-foreground sticky left-0 z-10 bg-card group-hover:bg-primary/5 transition-colors border-r border-border">
                                {idx + 1}
                              </td>

                              <td className="p-3.5 sticky left-12 z-10 bg-card group-hover:bg-primary/5 transition-colors border-r border-border min-w-[200px] max-w-[240px]">
                                <div className="flex items-center gap-3">
                                  <div className="h-8 w-8 rounded-lg bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 border border-border flex items-center justify-center font-bold text-xs shrink-0 font-mono">
                                    {t.name.charAt(0).toUpperCase()}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="font-bold text-foreground group-hover:text-primary transition-colors truncate">
                                      {t.name}
                                    </p>
                                    <p className="text-[10.5px] text-muted-foreground font-mono truncate">
                                      {t.email || t.username || "Chưa cập nhật email"}
                                    </p>
                                  </div>
                                </div>
                              </td>

                              <td className="p-3.5">
                                <span className="px-2.5 py-1 rounded-lg bg-muted/60 text-foreground font-semibold text-[11px] border border-border/60">
                                  {t.center}
                                </span>
                              </td>

                              <td className="p-3.5 text-center font-mono font-bold text-foreground">
                                {t.totalSessions} ca
                              </td>

                              <td className="p-3.5">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {Object.entries(t.roles).map(([r, hours]) => (
                                    <span
                                      key={r}
                                      className="px-2 py-0.5 rounded-md text-[10.5px] font-semibold font-mono bg-muted/80 text-foreground border border-border/70"
                                    >
                                      {r}: {hours}h
                                    </span>
                                  ))}
                                </div>
                              </td>

                              <td className="p-3.5 text-right font-mono font-bold text-sm text-foreground">
                                {t.totalHours}h
                              </td>

                              <td className="p-3.5 text-center">
                                <button
                                  type="button"
                                  onClick={(e) => toggleAllTeacherSessions(t, e)}
                                  title="Click để Check/Uncheck tất cả ca dạy của giảng viên này"
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-semibold transition-all duration-200 border shadow-2xs active:scale-95 cursor-pointer group/btn ${
                                    isFullyChecked
                                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25 hover:bg-emerald-500/20"
                                      : isPartiallyChecked
                                      ? "bg-amber-500/10 text-amber-800 dark:text-amber-200 border-amber-500/25 hover:bg-amber-500/20"
                                      : "bg-muted/50 text-muted-foreground border-border/80 hover:bg-muted hover:text-foreground"
                                  }`}
                                >
                                  {isFullyChecked ? (
                                    <>
                                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 group-hover/btn:scale-110 transition-transform duration-200" />
                                      <span>Checked ({checkedSessionsCount}/{totalSessionsCount})</span>
                                    </>
                                  ) : isPartiallyChecked ? (
                                    <>
                                      <Clock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0 group-hover/btn:scale-110 transition-transform duration-200" />
                                      <span>Checked ({checkedSessionsCount}/{totalSessionsCount})</span>
                                    </>
                                  ) : (
                                    <>
                                      <Circle className="h-3.5 w-3.5 opacity-40 shrink-0 group-hover/btn:scale-110 transition-transform duration-200" />
                                      <span>Unchecked (0/{totalSessionsCount})</span>
                                    </>
                                  )}
                                </button>
                              </td>

                              <td className="p-3.5 text-center">
                                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all duration-200" />
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>

      {/* R2 Cloud Manager Modal */}
      <R2ManagerModal
        isOpen={isR2ModalOpen}
        onClose={() => setIsR2ModalOpen(false)}
        filesList={r2Files}
        activeFileId={activeFile?.id || ""}
        onSelectFile={(f) => {
          handleSelectR2File(f);
          setIsR2ModalOpen(false);
        }}
        onFilesUpdated={refreshR2Files}
      />

      {/* Detailed Teacher Session Drawer */}
      <TeacherSessionDrawer
        teacher={selectedTeacher}
        onClose={() => setSelectedTeacher(null)}
        checkedSessionMap={checkedSessionMap}
        onToggleSessionCheck={toggleSessionCheck}
        onToggleAllTeacherSessions={toggleAllTeacherSessions}
      />
    </div>
  );
}

