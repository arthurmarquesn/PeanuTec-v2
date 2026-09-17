import { NextRequest, NextResponse } from "next/server";

import {
  AuthValidationError,
  DuplicateEmailError,
  registerUser,
} from "@/server/auth/auth.service";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const user = await registerUser({
      nome: body?.nome,
      email: body?.email,
      senha: body?.senha,
    });

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    if (error instanceof DuplicateEmailError) {
      return NextResponse.json({ detail: error.message }, { status: 409 });
    }
    if (error instanceof AuthValidationError) {
      return NextResponse.json({ detail: error.message }, { status: 400 });
    }

    console.error("[POST /api/auth/register]", error);
    return NextResponse.json(
      { detail: "Não foi possível criar a conta." },
      { status: 500 },
    );
  }
}
