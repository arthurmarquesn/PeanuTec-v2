import { NextRequest, NextResponse } from "next/server";

import {
  AuthValidationError,
  InvalidCredentialsError,
  loginUser,
} from "@/server/auth/auth.service";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const user = await loginUser({
      email: body?.email,
      senha: body?.senha,
    });

    return NextResponse.json({ user });
  } catch (error) {
    if (error instanceof InvalidCredentialsError) {
      return NextResponse.json({ detail: error.message }, { status: 401 });
    }
    if (error instanceof AuthValidationError) {
      return NextResponse.json({ detail: error.message }, { status: 400 });
    }

    console.error("[POST /api/auth/login]", error);
    return NextResponse.json(
      { detail: "Não foi possível entrar." },
      { status: 500 },
    );
  }
}
