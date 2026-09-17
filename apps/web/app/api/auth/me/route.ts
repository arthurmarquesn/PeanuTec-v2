import { NextResponse } from "next/server";

import {
  getCurrentUser,
  UnauthorizedError,
} from "@/server/auth/auth.service";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { detail: new UnauthorizedError().message },
      { status: 401 },
    );
  }

  return NextResponse.json({ user });
}
