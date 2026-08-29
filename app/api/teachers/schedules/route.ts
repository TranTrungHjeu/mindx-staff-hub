import { NextResponse } from "next/server";
import { LmsClient } from "@/lib/lms/client";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { teacherIds, dateGte, dateLte } = body;

    if (!Array.isArray(teacherIds) || teacherIds.length === 0) {
      return NextResponse.json(
        { success: false, error: "teacherIds array is required" },
        { status: 400 }
      );
    }

    if (!dateGte || !dateLte) {
      return NextResponse.json(
        { success: false, error: "dateGte and dateLte are required" },
        { status: 400 }
      );
    }

    const schedules = await LmsClient.getTeacherSchedules(teacherIds, dateGte, dateLte);
    return NextResponse.json({
      success: true,
      data: schedules || [],
    });
  } catch (error: any) {
    console.error("[API /api/teachers/schedules] Error:", error);
    return NextResponse.json(
      { success: false, data: [], error: error.message || "Failed to fetch teacher schedules" },
      { status: 500 }
    );
  }
}
