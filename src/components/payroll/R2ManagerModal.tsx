import { useState, useRef } from "react";
import {
  Cloud,
  Upload,
  Trash2,
  Lock,
  FileSpreadsheet,
  Check,
  AlertCircle,
  Calendar,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { R2PayrollFile, uploadFileToR2, deleteFileFromR2 } from "@/lib/r2Storage";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface R2ManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  filesList: R2PayrollFile[];
  activeFileId: string;
  onSelectFile: (file: R2PayrollFile) => void;
  onFilesUpdated: () => void;
}

export function R2ManagerModal({
  isOpen,
  onClose,
  filesList,
  activeFileId,
  onSelectFile,
  onFilesUpdated,
}: R2ManagerModalProps) {
  const [actionType, setActionType] = useState<"upload" | "delete" | null>(null);
  const [targetDeleteFile, setTargetDeleteFile] = useState<R2PayrollFile | null>(null);
  const [selectedUploadFile, setSelectedUploadFile] = useState<File | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number>(8);
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedUploadFile(file);
      const match = file.name.match(/T(\d{1,2})[_\s](\d{4})/i);
      if (match) {
        setSelectedMonth(Number(match[1]));
        setSelectedYear(Number(match[2]));
      } else {
        const now = new Date();
        setSelectedMonth(now.getMonth() + 1);
        setSelectedYear(now.getFullYear());
      }
      setActionType("upload");
      setPasswordInput("");
      setPasswordError(null);
    }
  };

  const handleConfirmAction = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    if (!passwordInput) {
      setPasswordError("Vui lòng nhập mật khẩu xác thực");
      return;
    }

    setIsSubmitting(true);
    try {
      if (actionType === "upload" && selectedUploadFile) {
        const periodName = `Tháng ${selectedMonth}/${selectedYear}`;
        const newFile = await uploadFileToR2(selectedUploadFile, periodName, passwordInput);
        onFilesUpdated();
        onSelectFile(newFile);
        setActionType(null);
        setSelectedUploadFile(null);
        setPasswordInput("");
      } else if (actionType === "delete" && targetDeleteFile) {
        await deleteFileFromR2(targetDeleteFile.id, passwordInput);
        onFilesUpdated();
        setActionType(null);
        setTargetDeleteFile(null);
        setPasswordInput("");
      }
    } catch (err: any) {
      setPasswordError(err.message || "Mật khẩu không đúng!");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="max-w-xl rounded-2xl p-0 overflow-hidden bg-card border-border shadow-2xl">
        {/* Top Header */}
        <div className="p-4 bg-muted/80 backdrop-blur-md border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
              <Cloud className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-sm font-bold text-foreground">
                Quản Lý Kho File Công Lương
              </DialogTitle>
              <DialogDescription className="text-[11px] text-muted-foreground">
                Lưu trữ và chuyển đổi file Excel công lương giảng viên giữa các tháng
              </DialogDescription>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Action Trigger Banner */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-primary/5 border border-primary/20">
            <div>
              <p className="text-xs font-bold text-foreground">Upload File Công Tháng Mới</p>
              <p className="text-[11px] text-muted-foreground">
                Yêu cầu mật khẩu xác thực để thực hiện
              </p>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFilePicked}
              accept=".xlsx, .xls"
              className="hidden"
            />

            <Button
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="h-8 gap-1.5 text-xs font-bold bg-primary text-white rounded-lg shadow-xs hover:bg-primary/90"
            >
              <Upload className="h-3.5 w-3.5" />
              <span>Upload File</span>
            </Button>
          </div>

          {/* Password Action Form Overlay when Uploading or Deleting */}
          {actionType && (
            <form
              onSubmit={handleConfirmAction}
              className="p-4 rounded-xl bg-amber-500/10 border-2 border-amber-500/30 space-y-3 animate-in fade-in duration-200"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-2">
                  <Lock className="h-4 w-4 text-amber-600" />
                  <span>
                    Xác Thực Mật Khẩu ({actionType === "upload" ? "Upload File" : "Xóa File"})
                  </span>
                </h4>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setActionType(null);
                    setPasswordError(null);
                  }}
                  className="h-6 text-[10px] text-muted-foreground hover:text-foreground"
                >
                  Hủy thao tác
                </Button>
              </div>

              {actionType === "upload" && selectedUploadFile && (
                <div className="space-y-2.5">
                  <p className="text-[11.5px] text-muted-foreground">
                    File đã chọn: <strong className="text-foreground font-mono">{selectedUploadFile.name}</strong>
                  </p>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-[10.5px] font-bold text-muted-foreground block mb-1">
                        Chọn Tháng Công Lương:
                      </label>
                      <Select
                        value={String(selectedMonth)}
                        onValueChange={(val) => setSelectedMonth(Number(val))}
                      >
                        <SelectTrigger className="h-8 text-xs font-semibold bg-background">
                          <SelectValue placeholder="Chọn tháng" />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                            <SelectItem key={m} value={String(m)}>
                              Tháng {m}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="text-[10.5px] font-bold text-muted-foreground block mb-1">
                        Chọn Năm Công Lương:
                      </label>
                      <Select
                        value={String(selectedYear)}
                        onValueChange={(val) => setSelectedYear(Number(val))}
                      >
                        <SelectTrigger className="h-8 text-xs font-semibold bg-background">
                          <SelectValue placeholder="Chọn năm" />
                        </SelectTrigger>
                        <SelectContent>
                          {[2024, 2025, 2026, 2027, 2028, 2029, 2030].map((y) => (
                            <SelectItem key={y} value={String(y)}>
                              Năm {y}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}

              {actionType === "delete" && targetDeleteFile && (
                <p className="text-[11.5px] text-amber-900 dark:text-amber-200">
                  Bạn có chắc muốn xóa dữ liệu công <strong className="font-mono">{targetDeleteFile.month}</strong> khỏi kho lưu trữ?
                </p>
              )}

              <div>
                <label className="text-[10.5px] font-bold text-muted-foreground block mb-1">
                  Nhập mật khẩu xác thực:
                </label>
                <Input
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Mật khẩu xác thực..."
                  className="h-8 text-xs bg-background font-mono"
                  autoFocus
                  required
                />
              </div>

              {passwordError && (
                <div className="text-[11px] font-bold text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5" />
                  <span>{passwordError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setActionType(null)}
                  className="h-7 text-xs"
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  size="sm"
                  className={`h-7 text-xs font-bold text-white ${
                    actionType === "delete" ? "bg-rose-600 hover:bg-rose-700" : "bg-primary hover:bg-primary/90"
                  }`}
                >
                  {isSubmitting ? "Đang xác thực..." : "Xác nhận & Thực hiện"}
                </Button>
              </div>
            </form>
          )}

          {/* R2 Monthly Files List */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">
              Danh sách File Công theo Tháng ({filesList.length} file)
            </h4>

            {filesList.length === 0 ? (
              <p className="text-center py-6 text-xs text-muted-foreground italic">
                Chưa có file công nào trên hệ thống. Hãy bấm Upload File.
              </p>
            ) : (
              filesList.map((f) => {
                const isActive = f.id === activeFileId;

                return (
                  <div
                    key={f.id}
                    className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                      isActive
                        ? "bg-primary/10 border-primary/40 shadow-2xs"
                        : "bg-card border-border hover:border-border/80"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`h-9 w-9 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                          isActive ? "bg-primary text-white" : "bg-muted text-muted-foreground"
                        }`}
                      >
                        <FileSpreadsheet className="h-4.5 w-4.5" />
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h5 className="text-xs font-bold text-foreground truncate">{f.month}</h5>
                          {isActive && (
                            <span className="px-1.5 py-0.2 rounded-md bg-primary text-white text-[9px] font-black uppercase">
                              Đang xem
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground font-medium truncate">
                          Dung lượng: {f.size}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {!isActive && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onSelectFile(f)}
                          className="h-7 px-2.5 text-xs font-bold text-primary border-primary/30 hover:bg-primary/10"
                        >
                          <Check className="h-3.5 w-3.5 mr-1" />
                          Xem Công
                        </Button>
                      )}

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setTargetDeleteFile(f);
                          setActionType("delete");
                          setPasswordInput("");
                          setPasswordError(null);
                        }}
                        className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"
                        title="Xóa file công lương (Yêu cầu mật khẩu xác thực)"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
