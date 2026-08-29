import { NextResponse } from "next/server";
import { LmsClient } from "@/lib/lms/client";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const centers = body.centers || ["6443460f94300678908f7974"];

    const teachers = await LmsClient.getTeachers(centers);
    
    // Sort teachers alphabetically by Tên (First Name) then Họ và Tên lót
    teachers.sort((a: any, b: any) => {
      const getSortable = (fullName = "") => {
        const parts = fullName.trim().split(/\s+/);
        if (parts.length <= 1) return fullName;
        const firstName = parts[parts.length - 1];
        const rest = parts.slice(0, parts.length - 1).join(" ");
        return `${firstName} ${rest}`;
      };
      return getSortable(a.fullName).localeCompare(getSortable(b.fullName), "vi", { sensitivity: "base" });
    });

    return NextResponse.json({
      success: true,
      data: teachers,
      pagination: { total: teachers.length },
    });
  } catch (error: any) {
    console.error("Error in /api/teachers:", error?.message || error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to fetch teachers" },
      { status: 500 }
    );
  }
}
