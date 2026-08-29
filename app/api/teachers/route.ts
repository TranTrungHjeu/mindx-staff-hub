import { NextResponse } from "next/server";
import { LmsClient } from "@/lib/lms/client";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { centers = ["6443460f94300678908f7974"], pageIndex = 0, itemsPerPage = 150 } = body;

    const teachers = await LmsClient.getTeachers(centers, pageIndex, itemsPerPage);
    return NextResponse.json({
      success: true,
      data: teachers || [],
    });
  } catch (error: any) {
    console.error("[API /api/teachers] Error:", error);
    return NextResponse.json(
      { success: false, data: [], error: error.message || "Failed to fetch teachers" },
      { status: 500 }
    );
  }
}
