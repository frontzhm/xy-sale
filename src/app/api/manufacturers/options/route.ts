import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export async function GET() {
  const rows = await prisma.manufacturer.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  return NextResponse.json({
    data: rows.map((r) => ({ label: r.name, value: r.id })),
    success: true,
  });
}
