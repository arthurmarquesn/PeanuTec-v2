import { NextResponse } from "next/server";

import { logoutUser } from "@/server/auth/auth.service";

export const runtime = "nodejs";

export async function POST() {
  await logoutUser();
  return NextResponse.json({ message: "Sessão encerrada." });
}
