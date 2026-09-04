"use client";

import { useRef } from "react";
import { Search, Filter, Upload, Download, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface PayrollToolbarProps {
  searchQuery: string;
  onSearchChange: (val: string) => void;
  selectedCenter: string;
  onCenterChange: (val: string) => void;
  selectedRole: string;
  onRoleChange: (val: string) => void;
  centersList: string[];
  rolesList: string[];
  onUploadFile: (file: File) => void;
  onExport: () => void;
  isUploading: boolean;
}

export function PayrollToolbar({
  searchQuery,
  onSearchChange,
  selectedCenter,
  onCenterChange,
  selectedRole,
  onRoleChange,
  centersList,
  rolesList,
  onUploadFile,
  onExport,
  isUploading,
}: PayrollToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onUploadFile(e.target.files[0]);
    }
  };

  return (
    <div className="w-full bg-card/60 backdrop-blur-md border-b border-border px-4 lg:px-6 py-3 transition-all">
      <div className="max-w-[1700px] mx-auto flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Left: Search & Filter Selects */}
        <div className="flex items-center flex-wrap gap-2.5 flex-1">
          {/* Search Bar */}
          <div className="relative flex-1 min-w-[240px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Tìm theo tên GV, Email, Username..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="h-9 pl-9 pr-3 text-xs rounded-xl bg-background border-border/80 focus-visible:ring-primary/30"
            />
          </div>

          {/* Center Filter Select */}
          <select
            value={selectedCenter}
            onChange={(e) => onCenterChange(e.target.value)}
            className="h-9 px-3 text-xs font-semibold rounded-xl bg-background border border-border/80 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer"
          >
            <option value="">Tất cả cơ sở ({centersList.length})</option>
            {centersList.map((c) => (
              <option key={c} value={c}>
                Cơ sở {c}
              </option>
            ))}
          </select>

          {/* Role Filter Select */}
          <select
            value={selectedRole}
            onChange={(e) => onRoleChange(e.target.value)}
            className="h-9 px-3 text-xs font-semibold rounded-xl bg-background border border-border/80 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer"
          >
            <option value="">Tất cả vai trò ({rolesList.length})</option>
            {rolesList.map((r) => (
              <option key={r} value={r}>
                Vai trò {r}
              </option>
            ))}
          </select>
        </div>

        {/* Right: Action Buttons (Upload & Export) */}
        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept=".xlsx, .xls"
            className="hidden"
          />

          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="h-9 px-3 gap-1.5 text-xs font-semibold rounded-xl border-border hover:bg-muted"
          >
            <Upload className={`h-3.5 w-3.5 text-primary ${isUploading ? "animate-bounce" : ""}`} />
            <span>{isUploading ? "Đang xử lý..." : "Upload File Excel"}</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onExport}
            className="h-9 px-3 gap-1.5 text-xs font-semibold rounded-xl border-border hover:bg-muted"
          >
            <Download className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            <span className="hidden sm:inline">Export Excel</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
