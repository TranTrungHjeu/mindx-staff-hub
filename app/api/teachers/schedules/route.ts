import { NextResponse } from "next/server";
import { LmsClient } from "@/lib/lms/client";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { teacherIds, dateGte, dateLte } = body;

    if (!Array.isArray(teacherIds) || teacherIds.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    const schedules = await LmsClient.getTeacherSchedules(
      teacherIds,
      dateGte,
      dateLte
    );
    return NextResponse.json({
      success: true,
      data: schedules,
    });
  } catch (error: any) {
    console.error("Error in /api/teachers/schedules:", error?.message || error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to fetch schedules" },
      { status: 500 }
    );
  }
}
