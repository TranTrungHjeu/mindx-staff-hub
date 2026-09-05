import { useState } from "react";
import { Search, Download, Cloud, ArrowUpDown, RotateCcw, SlidersHorizontal, X, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { R2PayrollFile } from "@/lib/r2Storage";

interface PayrollToolbarProps {
  searchQuery: string;
  onSearchChange: (val: string) => void;
  selectedCenter: string;
  onCenterChange: (val: string) => void;
  selectedRole: string;
  onRoleChange: (val: string) => void;
  minHoursFilter: number;
  onMinHoursChange: (val: number) => void;
  statusFilter: string;
  onStatusFilterChange: (val: string) => void;
  sortOrder: string;
  onSortOrderChange: (val: string) => void;
  centersList: string[];
  rolesList: string[];
  r2Files: R2PayrollFile[];
  activeFileId: string;
  onSelectR2File: (file: R2PayrollFile) => void;
  onOpenR2Modal: () => void;
  onExport: () => void;
  isLoading?: boolean;
  onRefresh?: () => void;
}

export function PayrollToolbar({
  searchQuery,
  onSearchChange,
  selectedCenter,
  onCenterChange,
  selectedRole,
  onRoleChange,
  minHoursFilter,
  onMinHoursChange,
  statusFilter,
  onStatusFilterChange,
  sortOrder,
  onSortOrderChange,
  centersList,
  rolesList,
  r2Files,
  activeFileId,
  onSelectR2File,
  onOpenR2Modal,
  onExport,
  isLoading,
  onRefresh,
}: PayrollToolbarProps) {
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false);

  // Active secondary filters count for badge indicator
  const activeFiltersCount =
    (selectedCenter ? 1 : 0) +
    (selectedRole ? 1 : 0) +
    (minHoursFilter > 0 ? 1 : 0) +
    (statusFilter !== "all" ? 1 : 0) +
    (sortOrder !== "hours_desc" ? 1 : 0);

  const handleResetFilters = () => {
    onCenterChange("");
    onRoleChange("");
    onMinHoursChange(0);
    onStatusFilterChange("all");
    onSortOrderChange("hours_desc");
  };

  return (
    <div className="w-full bg-card/70 backdrop-blur-md border-b border-border px-3 sm:px-4 lg:px-6 py-2 transition-all shrink-0">
      <div className="max-w-[1700px] mx-auto flex flex-col gap-2">
        {/* Primary Main Bar (Always Visible) */}
        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-2.5 mx-auto w-full">
          {/* Month Selector */}
          <div className="w-36 sm:w-48 shrink-0">
            <Select
              value={activeFileId}
              onValueChange={(val) => {
                const selected = r2Files.find((f) => f.id === val);
                if (selected) onSelectR2File(selected);
              }}
            >
              <SelectTrigger className="h-9 bg-primary/10 border-primary/30 text-primary font-bold hover:bg-primary/15 transition-colors">
                <div className="flex items-center gap-1.5 overflow-hidden">
                  <Cloud className="h-4 w-4 shrink-0 text-primary" />
                  <SelectValue placeholder="Chọn file công" />
                </div>
              </SelectTrigger>
              <SelectContent>
                {r2Files.length === 0 ? (
                  <SelectItem value="none" disabled>
                    Chưa có file công lương
                  </SelectItem>
                ) : (
                  r2Files.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.month}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Search Bar */}
          <div className="relative flex-1 min-w-[140px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Tìm tên GV, email, mã..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="h-9 pl-9 pr-3 text-xs rounded-xl bg-background border-border/80 focus-visible:ring-primary/30"
            />
          </div>

          {/* Toggle Filter Button (Opens/Closes Secondary Filter Row) */}
          <Button
            variant={isFiltersExpanded ? "secondary" : activeFiltersCount > 0 ? "default" : "outline"}
            size="sm"
            onClick={() => setIsFiltersExpanded(!isFiltersExpanded)}
            className={`h-9 px-3 gap-1.5 text-xs font-bold rounded-xl border-border shrink-0 transition-all shadow-2xs active:scale-95 ${
              activeFiltersCount > 0 && !isFiltersExpanded
                ? "bg-primary text-white hover:bg-primary/90 shadow-xs"
                : ""
            }`}
            title={isFiltersExpanded ? "Ẩn bộ lọc để tăng không gian hiển thị" : "Mở rộng các bộ lọc nâng cao"}
          >
            <SlidersHorizontal
              className={`h-3.5 w-3.5 ${
                activeFiltersCount > 0 && !isFiltersExpanded ? "text-white" : "text-primary"
              }`}
            />
            <span className="hidden sm:inline">{isFiltersExpanded ? "Ẩn Bộ Lọc" : "Bộ Lọc"}</span>
            {activeFiltersCount > 0 && (
              <span
                className={`h-4 min-w-[16px] px-1 rounded-full text-[9.5px] font-mono font-black flex items-center justify-center ${
                  activeFiltersCount > 0 && !isFiltersExpanded
                    ? "bg-white text-primary shadow-2xs"
                    : "bg-primary text-white"
                }`}
              >
                {activeFiltersCount}
              </span>
            )}
            {isFiltersExpanded ? (
              <ChevronUp
                className={`h-3.5 w-3.5 ${
                  activeFiltersCount > 0 && !isFiltersExpanded ? "text-white" : "text-muted-foreground"
                }`}
              />
            ) : (
              <ChevronDown
                className={`h-3.5 w-3.5 ${
                  activeFiltersCount > 0 && !isFiltersExpanded ? "text-white" : "text-muted-foreground"
                }`}
              />
            )}
          </Button>

          {/* Action Buttons */}
          <div className="flex items-center justify-center gap-1.5 sm:gap-2 shrink-0">
            {onRefresh && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRefresh}
                disabled={isLoading}
                className="h-9 px-2.5 sm:px-3 gap-1.5 text-xs font-semibold rounded-xl border-border hover:bg-muted shadow-2xs active:scale-95 transition-all"
                title="Làm mới dữ liệu từ Cloudflare R2"
              >
                <RotateCcw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin text-primary" : ""}`} />
                <span className="hidden sm:inline">Làm mới</span>
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={onOpenR2Modal}
              className="h-9 px-2.5 sm:px-3 gap-1.5 text-xs font-bold rounded-xl border-primary/40 text-primary hover:bg-primary/10 shadow-2xs active:scale-95 transition-all"
            >
              <Cloud className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="hidden sm:inline">Quản Lý File</span>
              <span className="sm:hidden">Kho File</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={onExport}
              className="h-9 px-2.5 sm:px-3 gap-1.5 text-xs font-semibold rounded-xl border-border hover:bg-muted shadow-2xs active:scale-95 transition-all"
            >
              <Download className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="hidden sm:inline">Export Excel</span>
            </Button>
          </div>
        </div>

        {/* Collapsible Secondary Filter Panel (Appears when expanded) */}
        {isFiltersExpanded && (
          <div className="pt-2 border-t border-border/60 flex flex-wrap items-center justify-center gap-2 mx-auto w-full animate-in fade-in slide-in-from-top-1 duration-200">
            {/* Center Filter */}
            <div className="min-w-[125px] sm:min-w-[135px]">
              <Select
                value={selectedCenter || "all"}
                onValueChange={(val) => onCenterChange(val === "all" ? "" : val)}
              >
                <SelectTrigger className="h-8 bg-background text-xs rounded-lg">
                  <SelectValue placeholder="Tất cả cơ sở" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả cơ sở ({centersList.length})</SelectItem>
                  {centersList.map((c) => (
                    <SelectItem key={c} value={c}>
                      Cơ sở {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Role Filter */}
            <div className="min-w-[125px] sm:min-w-[135px]">
              <Select
                value={selectedRole || "all"}
                onValueChange={(val) => onRoleChange(val === "all" ? "" : val)}
              >
                <SelectTrigger className="h-8 bg-background text-xs rounded-lg">
                  <SelectValue placeholder="Tất cả loại ca" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả loại ca</SelectItem>
                  <SelectItem value="TA">TA (Trợ Giảng)</SelectItem>
                  <SelectItem value="LEC">LEC (Giảng Viên)</SelectItem>
                  <SelectItem value="Judge">Judge (Giám Khảo)</SelectItem>
                  <SelectItem value="Supply">Supply (Dạy Thay)</SelectItem>
                  <SelectItem value="Fixed">Fixed (Lớp Cố Định)</SelectItem>
                  <SelectItem value="Makeup">Makeup (Dạy Bù)</SelectItem>
                  <SelectItem value="Trial">Trial (Học Thử / ≥3h)</SelectItem>
                  {rolesList
                    .filter((r) => !["TA", "LEC", "Judge", "Supply", "Fixed", "Makeup", "Trial", "GK", "DT"].includes(r))
                    .map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Min Hours Filter */}
            <div className="min-w-[115px] sm:min-w-[125px]">
              <Select
                value={String(minHoursFilter)}
                onValueChange={(val) => onMinHoursChange(Number(val))}
              >
                <SelectTrigger className="h-8 bg-background text-xs rounded-lg">
                  <SelectValue placeholder="Tất cả giờ dạy" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Tất cả giờ dạy</SelectItem>
                  <SelectItem value="10">≥ 10 giờ</SelectItem>
                  <SelectItem value="20">≥ 20 giờ</SelectItem>
                  <SelectItem value="40">≥ 40 giờ</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Check Status Filter */}
            <div className="min-w-[125px] sm:min-w-[135px]">
              <Select
                value={statusFilter}
                onValueChange={onStatusFilterChange}
              >
                <SelectTrigger className="h-8 bg-background text-xs rounded-lg">
                  <SelectValue placeholder="Trạng thái Check" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả</SelectItem>
                  <SelectItem value="checked">✓ Checked</SelectItem>
                  <SelectItem value="partial">⏳ Checked (1 phần)</SelectItem>
                  <SelectItem value="unchecked">○ Unchecked</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Sort Order Dropdown */}
            <div className="min-w-[145px] sm:min-w-[160px]">
              <Select
                value={sortOrder}
                onValueChange={(val) => onSortOrderChange(val)}
              >
                <SelectTrigger className="h-8 bg-background text-xs rounded-lg">
                  <div className="flex items-center gap-1.5 overflow-hidden">
                    <ArrowUpDown className="h-3 w-3 text-muted-foreground shrink-0" />
                    <SelectValue placeholder="Sắp xếp" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hours_desc">Giờ dạy: Cao → Thấp</SelectItem>
                  <SelectItem value="hours_asc">Giờ dạy: Thấp → Cao</SelectItem>
                  <SelectItem value="sessions_desc">Số ca dạy: Nhiều nhất</SelectItem>
                  <SelectItem value="name_asc">Tên Giảng Viên: A → Z</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Reset Filters Button */}
            {activeFiltersCount > 0 && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="h-8 px-2.5 text-[11px] font-bold text-destructive hover:bg-destructive/10 rounded-lg transition-colors flex items-center gap-1 shrink-0"
                title="Đặt lại tất cả bộ lọc về mặc định"
              >
                <RefreshCw className="h-3 w-3" />
                <span>Đặt lại ({activeFiltersCount})</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

