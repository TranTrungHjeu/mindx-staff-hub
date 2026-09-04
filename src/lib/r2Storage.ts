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
  passwordInput: string
): Promise<R2PayrollFile> {
  if (PAYROLL_PASSWORD && passwordInput.trim() !== PAYROLL_PASSWORD) {
    throw new Error("Mật khẩu xác thực không chính xác!");
  }

  const arrayBuffer = await file.arrayBuffer();

  const res = await fetch("/api/r2/upload", {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "x-filename": encodeURIComponent(file.name),
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
    month: monthName || uploadedFile.month,
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
