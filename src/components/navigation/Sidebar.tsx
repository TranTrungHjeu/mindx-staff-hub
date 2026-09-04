import { useState, useEffect } from "react";
import {
  CalendarDays,
  CircleDollarSign,
  ChevronLeft,
  Repeat,
  LayoutGrid,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export type ViewMode = "schedules" | "payroll";

interface SidebarProps {
  currentView: ViewMode;
  onViewChange: (view: ViewMode) => void;
}

export function Sidebar({ currentView, onViewChange }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("mindx_sidebar_collapsed") === "true";
    }
    return false;
  });

  useEffect(() => {
    localStorage.setItem("mindx_sidebar_collapsed", String(isCollapsed));
  }, [isCollapsed]);

  // Keyboard shortcut Ctrl+B or Cmd+B to toggle sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setIsCollapsed((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const navItems = [
    {
      id: "schedules" as ViewMode,
      label: "Ma Trận Lịch Tuần",
      icon: CalendarDays,
      activeColor: "bg-[#000056] text-white dark:bg-primary dark:text-primary-foreground shadow-xs",
    },
    {
      id: "payroll" as ViewMode,
      label: "Bảng Công Giảng Viên",
      icon: CircleDollarSign,
      activeColor: "bg-emerald-600 text-white dark:bg-emerald-600 dark:text-white shadow-xs",
    },
    {
      id: "substitutes",
      label: "Quản Lý Dạy Thay",
      icon: Repeat,
      activeColor: "",
      disabled: true,
      badge: "Sắp có",
    },
    {
      id: "classrooms",
      label: "Phân Bổ Phòng Học",
      icon: LayoutGrid,
      activeColor: "",
      disabled: true,
      badge: "Sắp có",
    },
  ];

  return (
    <aside
      className={`h-screen bg-card border-r border-border flex flex-col justify-between transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] z-40 shrink-0 select-none ${
        isCollapsed ? "w-16" : "w-60 sm:w-64"
      }`}
    >
      {/* Top Header & Brand */}
      <div className="flex flex-col">
        {/* Toggle Button Header */}
        <div
          className={`p-2 border-b border-border flex items-center h-14 shrink-0 ${
            isCollapsed ? "justify-center" : "justify-end px-3"
          }`}
        >
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="h-10 w-10 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/80 shrink-0 transition-transform active:scale-95 relative group flex items-center justify-center"
            title={isCollapsed ? "Mở rộng Sidebar (Ctrl+B)" : "Thu gọn Sidebar (Ctrl+B)"}
          >
            <ChevronLeft
              className={`h-4.5 w-4.5 transition-transform duration-300 ${
                isCollapsed ? "rotate-180 text-primary" : "rotate-0"
              }`}
            />
            {/* Tooltip on hover when collapsed */}
            {isCollapsed && (
              <div className="absolute left-full ml-3 px-2.5 py-1.5 rounded-lg bg-popover border border-border shadow-lg text-popover-foreground text-[11px] font-bold whitespace-nowrap z-50 pointer-events-none opacity-0 group-hover:opacity-100 scale-95 group-hover:scale-100 transition-all duration-150">
                Mở rộng (Ctrl+B)
              </div>
            )}
          </Button>
        </div>

        {/* Navigation Items List */}
        <nav className="p-2 space-y-1.5 mt-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;

            return (
              <button
                key={item.id}
                disabled={item.disabled}
                onClick={() => !item.disabled && onViewChange(item.id as ViewMode)}
                className={`w-full h-10 flex items-center rounded-xl text-xs font-semibold transition-all relative group cursor-pointer overflow-hidden ${
                  item.disabled
                    ? "opacity-40 cursor-not-allowed text-muted-foreground"
                    : isActive
                    ? item.activeColor
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                }`}
              >
                {/* Fixed Icon Container: 48px wide to match 48px inner area of 64px sidebar */}
                <div className="w-12 h-10 flex items-center justify-center shrink-0">
                  <Icon
                    className={`h-4.5 w-4.5 shrink-0 transition-transform duration-200 ${
                      isActive
                        ? "text-current scale-105"
                        : "text-muted-foreground group-hover:text-foreground group-hover:scale-110"
                    }`}
                  />
                </div>

                {/* Smooth Animated Label & Badge */}
                <div
                  className={`flex-1 flex items-center justify-between whitespace-nowrap transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] pr-3 ${
                    isCollapsed ? "max-w-0 opacity-0 pointer-events-none" : "max-w-[180px] opacity-100"
                  }`}
                >
                  <span className="truncate">{item.label}</span>
                  {item.badge && (
                    <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded-md font-mono bg-muted/60 text-muted-foreground ml-1">
                      {item.badge}
                    </span>
                  )}
                </div>

                {/* Floating Tooltip in Collapsed Mode */}
                {isCollapsed && (
                  <div className="absolute left-full ml-3 px-2.5 py-1.5 rounded-lg bg-popover border border-border shadow-lg text-popover-foreground text-[11px] font-bold whitespace-nowrap z-50 pointer-events-none opacity-0 group-hover:opacity-100 scale-95 group-hover:scale-100 transition-all duration-150 flex items-center gap-1.5">
                    <span>{item.label}</span>
                    {item.badge && (
                      <span className="text-[9px] font-normal opacity-70">({item.badge})</span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
