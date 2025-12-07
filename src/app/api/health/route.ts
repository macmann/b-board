import { NextResponse } from "next/server";

import prisma from "../../../lib/db";

export async function GET() {
  try {
    await prisma.project.count();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
