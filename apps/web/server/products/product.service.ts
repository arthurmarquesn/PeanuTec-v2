import "server-only";

import type {
  Product as PrismaProduct,
} from "@/generated/prisma/client";

import { prisma } from "@/server/db/prisma";

import type {
  Product,
  ProductRequest,
  ProductType,
} from "@/types/analysis";

/* =========================================================
 * Errors
 * ========================================================= */

export class ProductValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProductValidationError";
  }
}

export class ProductNotFoundError extends Error {
  constructor() {
    super("Produto não encontrado.");
    this.name = "ProductNotFoundError";
  }
}

/* =========================================================
 * Validation
 * ========================================================= */

const VALID_PRODUCT_TYPES =
  new Set<ProductType>([
    "fungicida",
    "inseticida",
    "acaricida",
    "herbicida",
    "outro",
  ]);

function optionalText(
  value: unknown,
): string | null {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  if (typeof value !== "string") {
    throw new ProductValidationError(
      "Campo textual inválido.",
    );
  }

  const trimmed = value.trim();

  return trimmed || null;
}

function parseProductType(
  value: unknown,
): ProductType {
  if (
    typeof value !== "string" ||
    !VALID_PRODUCT_TYPES.has(
      value as ProductType,
    )
  ) {
    throw new ProductValidationError(
      "Tipo de produto inválido.",
    );
  }

  return value as ProductType;
}

function parseDefaultDefenseDays(
  value: unknown,
): number | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > 365
  ) {
    throw new ProductValidationError(
      "A duração padrão deve ser um número inteiro entre 1 e 365 dias.",
    );
  }

  return value;
}

function parseProductRequest(
  input: unknown,
): ProductRequest {
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input)
  ) {
    throw new ProductValidationError(
      "Dados do produto inválidos.",
    );
  }

  const body =
    input as Record<
      string,
      unknown
    >;

  const rawName =
    body.name;

  if (
    typeof rawName !== "string" ||
    !rawName.trim()
  ) {
    throw new ProductValidationError(
      "Informe o nome do produto.",
    );
  }

  const isActive =
    body.is_active === undefined
      ? true
      : body.is_active;

  if (
    typeof isActive !==
    "boolean"
  ) {
    throw new ProductValidationError(
      "Status do produto inválido.",
    );
  }

  return {
    name:
      rawName.trim(),

    product_type:
      parseProductType(
        body.product_type,
      ),

    active_ingredient:
      optionalText(
        body.active_ingredient,
      ),

    main_target:
      optionalText(
        body.main_target,
      ),

    default_defense_days:
      parseDefaultDefenseDays(
        body.default_defense_days,
      ),

    notes:
      optionalText(
        body.notes,
      ),

    is_active:
      isActive,
  };
}

/* =========================================================
 * Mapper
 * ========================================================= */

function mapProduct(
  product: PrismaProduct,
): Product {
  return {
    id:
      product.id,

    name:
      product.name,

    product_type:
      product.productType as ProductType,

    active_ingredient:
      product.activeIngredient,

    main_target:
      product.mainTarget,

    default_defense_days:
      product.defaultDefenseDays,

    notes:
      product.notes,

    is_active:
      product.isActive,

    created_at:
      product.createdAt.toISOString(),

    updated_at:
      product.updatedAt.toISOString(),
  };
}

/* =========================================================
 * Queries
 * ========================================================= */

export async function listProducts(
  activeOnly = false,
): Promise<Product[]> {
  const products =
    await prisma.product.findMany({
      where:
        activeOnly
          ? {
              isActive: true,
            }
          : undefined,

      orderBy: [
        {
          isActive: "desc",
        },
        {
          name: "asc",
        },
      ],
    });

  return products.map(
    mapProduct,
  );
}

export async function getProductById(
  productId: string,
): Promise<Product> {
  const product =
    await prisma.product.findUnique({
      where: {
        id: productId,
      },
    });

  if (!product) {
    throw new ProductNotFoundError();
  }

  return mapProduct(product);
}

/* =========================================================
 * Commands
 * ========================================================= */

export async function createProduct(
  input: unknown,
): Promise<Product> {
  const payload =
    parseProductRequest(input);

  const product =
    await prisma.product.create({
      data: {
        name:
          payload.name,

        productType:
          payload.product_type,

        activeIngredient:
          payload.active_ingredient,

        mainTarget:
          payload.main_target,

        defaultDefenseDays:
          payload.default_defense_days,

        notes:
          payload.notes,

        isActive:
          payload.is_active ??
          true,
      },
    });

  return mapProduct(product);
}

export async function updateProduct(
  productId: string,
  input: unknown,
): Promise<Product> {
  await getProductById(
    productId,
  );

  const payload =
    parseProductRequest(input);

  const product =
    await prisma.product.update({
      where: {
        id: productId,
      },

      data: {
        name:
          payload.name,

        productType:
          payload.product_type,

        activeIngredient:
          payload.active_ingredient,

        mainTarget:
          payload.main_target,

        defaultDefenseDays:
          payload.default_defense_days,

        notes:
          payload.notes,

        isActive:
          payload.is_active ??
          true,
      },
    });

  return mapProduct(product);
}

export async function deactivateProduct(
  productId: string,
): Promise<Product> {
  await getProductById(
    productId,
  );

  const product =
    await prisma.product.update({
      where: {
        id: productId,
      },

      data: {
        isActive: false,
      },
    });

  return mapProduct(product);
}