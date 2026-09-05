import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShieldCheck, KeyRound, Eye, EyeOff, AlertCircle } from "lucide-react";

interface PayrollSecurityDialogProps {
  isOpen: boolean;
  onUnlock: (password: string) => Promise<boolean>;
}

export function PayrollSecurityDialog({ isOpen, onUnlock }: PayrollSecurityDialogProps) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setErrorMsg("Vui lòng nhập mật khẩu mở khóa.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const success = await onUnlock(password.trim());
      if (!success) {
        setErrorMsg("Mật khẩu bảo mật không chính xác!");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Lỗi xác thực mật khẩu.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="w-[92vw] sm:max-w-[420px] p-5 sm:p-6 rounded-2xl border-border bg-card shadow-2xl animate-in zoom-in-95 duration-200">
        <DialogHeader className="text-center space-y-2 flex flex-col items-center">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shadow-glow mb-1">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <DialogTitle className="text-lg font-bold text-foreground tracking-tight">
            Xác Thực Bảo Mật Công Dạy
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground text-center">
            Nhập mật khẩu mở khóa (.env VITE_PAYROLL_PASSWORD) để xem dữ liệu Bảng Công & Thù Lao Giảng Viên.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-xs text-destructive flex items-center gap-2 font-medium animate-in fade-in duration-150">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <KeyRound className="h-3.5 w-3.5 text-primary" />
              Mật khẩu truy cập:
            </label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Nhập mật khẩu..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-10 pr-10 text-sm font-mono rounded-xl bg-background border-border focus-visible:ring-primary/30"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-10 font-semibold text-xs rounded-xl bg-gradient-to-r from-[#000056] via-[#1E3A8A] to-[#2563EB] text-white shadow-glow hover:opacity-95 transition-all"
          >
            {isSubmitting ? "Đang mở khóa..." : "Mở Khóa Dữ Liệu Công"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
