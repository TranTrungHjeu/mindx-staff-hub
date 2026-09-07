/**
 * R2 Cloud Storage Service for Monthly Payroll Excel Files
 * Connects to Vite Server API Proxy (/api/r2/*) which performs S3 operations server-side.
 * Fixes browser CORS restrictions and keeps Cloudflare credentials secure on the server.
 */

export interface R2PayrollFile {
  id: string;
  filename: string;
  month: string;
  uploadedAt: string;
  size: string;
  publicUrl: string;
  fileBuffer?: ArrayBuffer;
}

export const PAYROLL_PASSWORD = import.meta.env.VITE_PAYROLL_PASSWORD || "";

/**
 * Extract Month & Year from filename or string
 */
export function extractMonthAndYearFromFilename(filename: string): { month: number; year: number } {
  const now = new Date();
  if (!filename) {
    return { month: now.getMonth() + 1, year: now.getFullYear() };
  }

  // Pattern 1: "Thang 8 2026", "Tháng_08_2026", "Thang8_2026", "tháng 8/2026"
  const thangMatch = filename.match(/Th[áa]ng[_\s-]*0*(\d{1,2})[_\s\/\.-]*(\d{4})/i);
  if (thangMatch) {
    return { month: Number(thangMatch[1]), year: Number(thangMatch[2]) };
  }

  // Pattern 2: "T8 2026", "T08_2026", "T8-2026", "T_8_2026", "T08.2026"
  const tYearMatch = filename.match(/T[_\s-]*0*(\d{1,2})[_\s\/\.-]+(\d{4})/i);
  if (tYearMatch) {
    return { month: Number(tYearMatch[1]), year: Number(tYearMatch[2]) };
  }

  // Pattern 3: "08_2026", "8_2026", "08-2026", "08/2026"
  const monthYearMatch = filename.match(/(?:^|[_\s\.-])0*(\d{1,2})[_\/\.-](\d{4})(?:[_\s\.-]|$)/);
  if (monthYearMatch) {
    const m = Number(monthYearMatch[1]);
    const y = Number(monthYearMatch[2]);
    if (m >= 1 && m <= 12) {
      return { month: m, year: y };
    }
  }

  // Pattern 4: "2026_08", "2026-08"
  const yearMonthMatch = filename.match(/(?:^|[_\s\.-])(\d{4})[_\/\.-]0*(\d{1,2})(?:[_\s\.-]|$)/);
  if (yearMonthMatch) {
    const y = Number(yearMonthMatch[1]);
    const m = Number(yearMonthMatch[2]);
    if (m >= 1 && m <= 12) {
      return { month: m, year: y };
    }
  }

  // Pattern 5: "T8", "T08", "Thang 8" without 4-digit year
  const tOnlyMatch = filename.match(/T[_\s-]*0*(\d{1,2})(?:[_\s\.-]|$)/i) || filename.match(/Th[áa]ng[_\s-]*0*(\d{1,2})/i);
  if (tOnlyMatch) {
    const m = Number(tOnlyMatch[1]);
    if (m >= 1 && m <= 12) {
      return { month: m, year: now.getFullYear() };
    }
  }

  return { month: now.getMonth() + 1, year: now.getFullYear() };
}

export function extractMonthFromFilename(filename: string): string {
  const { month, year } = extractMonthAndYearFromFilename(filename);
  return `Tháng ${month}/${year}`;
}

/**
 * Fetch the list of all monthly payroll files directly from Cloudflare R2 via Vite API Proxy.
 */
export async function getR2FilesFromCloud(): Promise<R2PayrollFile[]> {
  try {
    const res = await fetch("/api/r2/files");
    if (!res.ok) {
      throw new Error(`Mã lỗi danh sách R2: ${res.status}`);
    }
    const files: R2PayrollFile[] = await res.json();
    return files;
  } catch (error) {
    console.error("Failed to list files from Cloudflare R2 API Proxy:", error);
    return [];
  }
}

/**
 * Fetch the binary ArrayBuffer for an R2 file using the API proxy endpoint.
 */
export async function fetchR2FileBuffer(file: R2PayrollFile): Promise<ArrayBuffer> {
  if (file.fileBuffer && file.fileBuffer.byteLength > 0) {
    return file.fileBuffer;
  }
  const url = file.publicUrl || `/api/r2/file-buffer?key=${encodeURIComponent(file.filename)}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Khởi tạo file ${file.filename} từ R2 thất bại (Mã lỗi: ${res.status})`);
  }
  return await res.arrayBuffer();
}

/**
 * Upload a new file directly to Cloudflare R2 via Vite API Proxy.
 * Requires correct PAYROLL_PASSWORD.
 */
export async function uploadFileToR2(
  file: File,
  monthName: string,
  passwordInput: string,
  selectedMonth?: number,
  selectedYear?: number
): Promise<R2PayrollFile> {
  if (PAYROLL_PASSWORD && passwordInput.trim() !== PAYROLL_PASSWORD) {
    throw new Error("Mật khẩu xác thực không chính xác!");
  }

  // Format target filename on R2 with T{month}_{year}_ prefix to ensure cloud persistent month recognition
  let targetFilename = file.name;
  if (selectedMonth && selectedYear) {
    const prefixPattern = new RegExp(`^T0?${selectedMonth}_${selectedYear}_`, "i");
    if (!prefixPattern.test(targetFilename)) {
      const cleaned = targetFilename.replace(/^T\d{1,2}_\d{4}_/i, "");
      targetFilename = `T${selectedMonth}_${selectedYear}_${cleaned}`;
    }
  }

  const arrayBuffer = await file.arrayBuffer();

  const res = await fetch("/api/r2/upload", {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "x-filename": encodeURIComponent(targetFilename),
    },
    body: arrayBuffer,
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Lỗi tải file lên R2 (Mã lỗi: ${res.status})`);
  }

  const uploadedFile: R2PayrollFile = await res.json();
  return {
    ...uploadedFile,
    month: monthName || extractMonthFromFilename(targetFilename),
    fileBuffer: arrayBuffer,
  };
}

/**
 * Delete a file directly from Cloudflare R2 via Vite API Proxy.
 * Requires correct PAYROLL_PASSWORD.
 */
export async function deleteFileFromR2(
  fileKey: string,
  passwordInput: string
): Promise<boolean> {
  if (PAYROLL_PASSWORD && passwordInput.trim() !== PAYROLL_PASSWORD) {
    throw new Error("Mật khẩu xác thực không chính xác!");
  }

  const res = await fetch(`/api/r2/delete?key=${encodeURIComponent(fileKey)}`, {
    method: "DELETE",
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Lỗi xóa file khỏi R2 (Mã lỗi: ${res.status})`);
  }

  return true;
}
