import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { sendDueAppointmentReminders } from "@/server/services/whatsapp-reminders";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");

  if (!cronSecret || authorization !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await sendDueAppointmentReminders(prisma);
  return NextResponse.json({ ok: true, ...result });
}
