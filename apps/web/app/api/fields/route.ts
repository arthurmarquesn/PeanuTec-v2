import { NextRequest, NextResponse } from "next/server";

import { requireUser, UnauthorizedError } from "@/server/auth/auth.service";
import { prisma } from "@/server/db/prisma";
import { createField, FieldValidationError, listFields } from "@/server/fields/field.service";

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json({ detail: "Autenticação necessária." }, { status: 401 });
}

export async function GET() {
  try {
    const user = await requireUser();
    const ownedRows = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM fields WHERE user_id = ${user.id}
    `;
    const ownedIds = new Set(ownedRows.map((row) => row.id));
    const fields = await listFields();
    return NextResponse.json(fields.filter((field) => ownedIds.has(field.id)));
  } catch (error) {
    if (error instanceof UnauthorizedError) return unauthorized();
    console.error("[GET /api/fields]", error);
    return NextResponse.json({ detail: "Não foi possível carregar os talhões." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = await request.json();
    const field = await createField(body);

    await prisma.$executeRaw`
      UPDATE fields SET user_id = ${user.id} WHERE id = ${field.id}
    `;

    return NextResponse.json(field, { status: 201 });
  } catch (error) {
    if (error instanceof UnauthorizedError) return unauthorized();
    if (error instanceof FieldValidationError) {
      return NextResponse.json({ detail: error.message }, { status: 400 });
    }
    console.error("[POST /api/fields]", error);
    return NextResponse.json({ detail: "Não foi possível cadastrar o talhão." }, { status: 500 });
  }
}
