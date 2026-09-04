"use client";

import { X, Clock, Calendar, BookOpen, Users, MapPin, UserCheck, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SessionLog {
  id: string;
  date: string;
  type: string;
  className: string;
  course: string;
  role: string;
  duration: number;
  studentCount: number;
  note: string;
  center: string;
}

interface TeacherPayrollSummary {
  id: string;
  name: string;
  email: string;
  center: string;
  totalHours: number;
  totalSessions: number;
  roles: Record<string, number>;
  sessions: SessionLog[];
}

interface TeacherSessionDrawerProps {
  teacher: TeacherPayrollSummary | null;
  onClose: () => void;
}

export function TeacherSessionDrawer({ teacher, onClose }: TeacherSessionDrawerProps) {
  if (!teacher) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/50 backdrop-blur-xs flex justify-end animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-card border-l border-border h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
        {/* Drawer Header */}
        <div className="p-6 bg-gradient-to-r from-[#000056] via-[#1E3A8A] to-[#2563EB] text-white flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-white text-[11px] font-bold">
                {teacher.center || "Cơ sở MindX"}
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500 text-white text-[11px] font-bold font-mono">
                {teacher.totalHours} giờ dạy
              </span>
            </div>
            <h2 className="text-xl font-extrabold text-white tracking-tight">{teacher.name}</h2>
            <p className="text-xs text-white/80 font-mono">{teacher.email || "Chưa có email"}</p>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-xl h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Roles Breakdown Summary Bar */}
        <div className="px-6 py-3 bg-muted/40 border-b border-border/80 flex items-center flex-wrap gap-2 text-xs font-semibold">
          <span className="text-muted-foreground mr-1">Phân bổ vai trò:</span>
          {Object.entries(teacher.roles).map(([role, hours]) => (
            <span
              key={role}
              className={`px-2 py-0.5 rounded-md text-[11px] font-bold font-mono ${
                role === "LEC"
                  ? "bg-[#E31F26]/10 text-[#E31F26] border border-[#E31F26]/20"
                  : role === "TA"
                  ? "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                  : role === "Judge" || role === "GK"
                  ? "bg-purple-500/10 text-purple-600 border border-purple-500/20"
                  : "bg-primary/10 text-primary border border-primary/20"
              }`}
            >
              {role}: {hours}h
            </span>
          ))}
        </div>

        {/* Sessions Table */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-primary" />
              Danh sách {teacher.sessions.length} ca dạy trong tháng:
            </h3>
          </div>

          <div className="space-y-2">
            {teacher.sessions.map((s, idx) => (
              <div
                key={s.id || idx}
                className="p-3.5 rounded-xl bg-card border border-border/80 hover:border-primary/40 transition-all space-y-2 shadow-2xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md text-white ${
                        s.role === "LEC"
                          ? "bg-[#E31F26]"
                          : s.role === "TA"
                          ? "bg-amber-500 text-black"
                          : s.role === "Judge" || s.role === "GK"
                          ? "bg-purple-600"
                          : "bg-primary"
                      }`}
                    >
                      {s.role || "LEC"}
                    </span>
                    <span className="text-xs font-bold text-foreground font-mono">
                      {s.className}
                    </span>
                  </div>

                  <span className="text-xs font-bold font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                    +{s.duration}h
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3 text-muted-foreground/70" />
                    <span className="font-mono">{s.date || "N/A"}</span>
                  </div>
                  {s.studentCount > 0 && (
                    <div className="flex items-center gap-1">
                      <Users className="h-3 w-3 text-muted-foreground/70" />
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
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
