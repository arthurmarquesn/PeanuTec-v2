import "server-only";

import { prisma } from "@/server/db/prisma";
import { requireUser, type AuthUser } from "@/server/auth/auth.service";

export class ResourceNotFoundError extends Error {
  constructor(message = "Recurso não encontrado.") {
    super(message);
    this.name = "ResourceNotFoundError";
  }
}

export async function requireOwnedField(fieldId: string): Promise<{
  user: AuthUser;
  field: {
    id: string;
    name: string;
    city: string;
    latitude: number;
    longitude: number;
    crop: string;
    plantingDate: string;
    cropStatus: string;
  };
}> {
  const user = await requireUser();
  const field = await prisma.field.findFirst({
    where: { id: fieldId, userId: user.id },
    select: {
      id: true,
      name: true,
      city: true,
      latitude: true,
      longitude: true,
      crop: true,
      plantingDate: true,
      cropStatus: true,
    },
  });

  if (!field) throw new ResourceNotFoundError("Talhão não encontrado.");
  return { user, field };
}

export async function requireAuthenticated(): Promise<AuthUser> {
  return requireUser();
}

export async function listOwnedFieldIds(): Promise<string[]> {
  const user = await requireUser();
  const fields = await prisma.field.findMany({
    where: { userId: user.id },
    select: { id: true },
  });
  return fields.map((field) => field.id);
}
