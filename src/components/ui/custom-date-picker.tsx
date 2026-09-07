import { useState, useRef, useEffect } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  startOfWeek,
  endOfWeek,
  isSameDay,
  isSameMonth,
  addMonths,
  subMonths,
} from "date-fns";
import { vi } from "date-fns/locale/vi";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CustomDatePickerProps {
  selectedDate: Date;
  onSelect: (date: Date) => void;
  onClose?: () => void;
}

export function CustomDatePicker({
  selectedDate,
  onSelect,
  onClose,
}: CustomDatePickerProps) {
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(selectedDate));

  useEffect(() => {
    setCurrentMonth(startOfMonth(selectedDate));
  }, [selectedDate]);

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
    <div className="p-3 bg-card rounded-xl shadow-xl border border-border w-[280px] animate-in fade-in zoom-in-95 duration-200 text-foreground">
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
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelect(day);
                if (onClose) onClose();
              }}
              className={`h-8 w-8 rounded-md flex items-center justify-center text-xs transition-all ${
                !isCurrentMonth ? "text-muted-foreground/70" : "text-foreground hover:bg-muted"
              } ${
                isSelected ? "bg-primary text-white hover:bg-primary/90 font-bold shadow-md" : ""
              } ${
                isToday && !isSelected ? "text-primary font-bold bg-primary/10" : ""
              }`}
            >
              {format(day, "d")}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface DatePickerDropdownProps {
  selectedDate: Date;
  onSelect: (date: Date) => void;
  placeholder?: string;
  className?: string;
}

export function DatePickerDropdown({
  selectedDate,
  onSelect,
  className = "",
}: DatePickerDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative inline-block" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 px-3 py-1.5 h-8 bg-card border border-border rounded-lg text-xs font-bold text-foreground hover:bg-muted/60 transition-colors shadow-2xs ${
          isOpen ? "ring-1 ring-primary border-primary" : ""
        } ${className}`}
      >
        <Calendar className="h-3.5 w-3.5 text-primary shrink-0" />
        <span>{format(selectedDate, "dd/MM/yyyy")}</span>
      </button>

      {isOpen && (
        <div className="absolute top-[calc(100%+6px)] right-0 z-50">
          <CustomDatePicker
            selectedDate={selectedDate}
            onSelect={(d) => {
              onSelect(d);
              setIsOpen(false);
            }}
            onClose={() => setIsOpen(false)}
          />
        </div>
      )}
    </div>
  );
}
