import { useState, useEffect } from "react";
import { Sidebar, ViewMode } from "@/components/navigation/Sidebar";
import { SchedulesView } from "@/components/schedules/SchedulesView";
import { PayrollView } from "@/components/payroll/PayrollView";

function getViewFromPath(path: string): ViewMode {
  if (path.startsWith("/payroll")) {
    return "payroll";
  }
  return "schedules";
}

function getPathFromView(view: ViewMode): string {
  if (view === "payroll") {
    return "/payroll";
  }
  return "/schedules";
}

export default function App() {
  const [currentView, setCurrentView] = useState<ViewMode>(() =>
    getViewFromPath(window.location.pathname)
  );

  useEffect(() => {
    const handlePopState = () => {
      setCurrentView(getViewFromPath(window.location.pathname));
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const handleViewChange = (view: ViewMode) => {
    setCurrentView(view);
    const newPath = getPathFromView(view);
    if (window.location.pathname !== newPath) {
      window.history.pushState({}, "", newPath);
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-[100dvh] w-full bg-background text-foreground font-sans overflow-hidden">
      {/* Collapsible Left Sidebar (Desktop) + Top Bar & Drawer (Mobile) */}
      <Sidebar
        currentView={currentView}
        onViewChange={handleViewChange}
      />

      {/* Main Workspace Area */}
      <main className="flex-1 flex flex-col min-h-0 h-full overflow-hidden relative">
        {currentView === "schedules" ? (
          <SchedulesView onSwitchToPayroll={() => handleViewChange("payroll")} />
        ) : (
          <PayrollView onSwitchToSchedules={() => handleViewChange("schedules")} />
        )}
      </main>
    </div>
  );
}
