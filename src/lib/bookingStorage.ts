/**
 * Booking Records Data Model & Storage Management
 * Handles persistent storage of teacher booking requests (Substitute, Trial, Examiner)
 * with LocalStorage fallback and Cloudflare R2 JSON synchronization.
 */

export type BookingType = "substitute" | "trial" | "examiner";

export interface BookingRecord {
  id: string;
  type: BookingType;
  scheduleId?: string;
  className: string;
  dateStr: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  centreId?: string;
  centreName: string;
  assignedTeacherId: string;
  assignedTeacherName: string;
  assignedTeacherCode: string;
  notes?: string;
  status: "CONFIRMED" | "CANCELLED";
  createdAt: string;
}

const STORAGE_KEY = "mindx_teacher_booking_records";

/**
 * Read all booking records from LocalStorage
 */
export function getLocalBookings(): BookingRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (error) {
    console.error("Failed to parse local booking records:", error);
    return [];
  }
}

/**
 * Save a new booking record
 */
export function saveBookingRecord(record: Omit<BookingRecord, "id" | "createdAt">): BookingRecord {
  const newRecord: BookingRecord = {
    ...record,
    id: `book_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    createdAt: new Date().toISOString(),
  };

  const existing = getLocalBookings();
  const updated = [newRecord, ...existing];

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error("Failed to save booking record to LocalStorage:", error);
  }

  // Background Cloud R2 Sync (Best effort)
  syncBookingsToCloud(updated).catch(() => {});

  return newRecord;
}

/**
 * Cancel a booking record by ID
 */
export function cancelBookingRecord(bookingId: string): boolean {
  const existing = getLocalBookings();
  const updated = existing.map((rec) =>
    rec.id === bookingId ? { ...rec, status: "CANCELLED" as const } : rec
  );

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    syncBookingsToCloud(updated).catch(() => {});
    return true;
  } catch {
    return false;
  }
}

/**
 * Permanently delete a booking record by ID
 */
export function deleteBookingRecord(bookingId: string): boolean {
  const existing = getLocalBookings();
  const updated = existing.filter((rec) => rec.id !== bookingId);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    syncBookingsToCloud(updated).catch(() => {});
    return true;
  } catch {
    return false;
  }
}

/**
 * Permanently clear all cancelled booking records
 */
export function clearCancelledBookings(): boolean {
  const existing = getLocalBookings();
  const updated = existing.filter((rec) => rec.status !== "CANCELLED");

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    syncBookingsToCloud(updated).catch(() => {});
    return true;
  } catch {
    return false;
  }
}

/**
 * Best-effort Cloud R2 JSON Payload sync
 */
async function syncBookingsToCloud(bookings: BookingRecord[]): Promise<void> {
  try {
    const jsonBlob = new Blob([JSON.stringify(bookings, null, 2)], { type: "application/json" });
    const file = new File([jsonBlob], "bookings_data.json", { type: "application/json" });

    await fetch("/api/r2/upload", {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "x-filename": encodeURIComponent(file.name),
      },
      body: await file.arrayBuffer(),
    });
  } catch {
    // Cloud sync failure is silently ignored to ensure smooth offline UX
  }
}
