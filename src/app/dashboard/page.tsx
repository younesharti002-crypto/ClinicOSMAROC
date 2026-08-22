import { Role } from "@prisma/client";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/context";

export default async function DashboardPage() {
  const user = await requireUser();

  if (user.role === Role.DOCTOR) {
    redirect("/doctor");
  }

  redirect("/reception");
}
