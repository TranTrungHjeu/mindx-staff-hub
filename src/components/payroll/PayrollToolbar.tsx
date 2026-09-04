import { Search, Download, Cloud, ArrowUpDown, RotateCcw } from "lucide-react";
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
  return (
    <div className="w-full bg-card/60 backdrop-blur-md border-b border-border px-4 lg:px-6 py-3 transition-all">
      <div className="max-w-[1700px] mx-auto flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        {/* Left: Month Selector & Filters */}
        <div className="flex items-center flex-wrap gap-2.5 flex-1">
          {/* R2 Month / File Selector */}
          <div className="min-w-[200px]">
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
                  <SelectValue placeholder="Chọn file công lương" />
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
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Tìm tên GV, email, mã..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="h-9 pl-9 pr-3 text-xs rounded-xl bg-background border-border/80 focus-visible:ring-primary/30"
            />
          </div>

          {/* Center Filter Select (Default = 230ĐLBD) */}
          <div className="min-w-[150px]">
            <Select
              value={selectedCenter || "all"}
              onValueChange={(val) => onCenterChange(val === "all" ? "" : val)}
            >
              <SelectTrigger className="h-9 bg-background">
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

          {/* Role Filter Select */}
          <div className="min-w-[150px]">
            <Select
              value={selectedRole || "all"}
              onValueChange={(val) => onRoleChange(val === "all" ? "" : val)}
            >
              <SelectTrigger className="h-9 bg-background">
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

          {/* Min Hours Threshold Filter */}
          <div className="min-w-[125px]">
            <Select
              value={String(minHoursFilter)}
              onValueChange={(val) => onMinHoursChange(Number(val))}
            >
              <SelectTrigger className="h-9 bg-background">
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
          <div className="min-w-[145px]">
            <Select
              value={statusFilter}
              onValueChange={onStatusFilterChange}
            >
              <SelectTrigger className="h-9 bg-background">
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
          <div className="min-w-[185px]">
            <Select
              value={sortOrder}
              onValueChange={(val) => onSortOrderChange(val)}
            >
              <SelectTrigger className="h-9 bg-background">
                <div className="flex items-center gap-1.5 overflow-hidden">
                  <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
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
        </div>

        {/* Right: Action Buttons */}
        <div className="flex items-center gap-2">
          {onRefresh && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={isLoading}
              className="h-9 px-3 gap-1.5 text-xs font-semibold rounded-xl border-border hover:bg-muted shadow-2xs active:scale-95 transition-all duration-200"
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
            className="h-9 px-3 gap-1.5 text-xs font-bold rounded-xl border-primary/40 text-primary hover:bg-primary/10 hover:border-primary/60 shadow-2xs active:scale-95 transition-all duration-200 group"
          >
            <Cloud className="h-3.5 w-3.5 text-primary group-hover:scale-110 transition-transform duration-200" />
            <span>Quản Lý File Công</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onExport}
            className="h-9 px-3 gap-1.5 text-xs font-semibold rounded-xl border-border hover:bg-muted hover:border-emerald-500/40 shadow-2xs active:scale-95 transition-all duration-200 group"
          >
            <Download className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform duration-200" />
            <span className="hidden sm:inline">Export Excel</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
