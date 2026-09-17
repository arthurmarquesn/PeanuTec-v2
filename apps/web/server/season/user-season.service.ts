import "server-only";

import { prisma } from "@/server/db/prisma";
import { listOwnedFieldIds } from "@/server/auth/authorization";
import { getSaoPauloDateKey } from "@/server/time/sao-paulo";
import type { ProductMetric, SeasonMetrics, TargetMetric } from "@/types/analysis";

function increment(map: Map<string, number>, key: string | null) {
  if (!key) return;
  map.set(key, (map.get(key) ?? 0) + 1);
}

function sortRows<T extends { applications_count: number }>(rows: T[], label: (row: T) => string) {
  rows.sort((a, b) => b.applications_count - a.applications_count || label(a).localeCompare(label(b), "pt-BR"));
  return rows;
}

export async function getUserSeasonMetrics(): Promise<SeasonMetrics> {
  const ownedIds = await listOwnedFieldIds();
  const [fields, sprays] = await Promise.all([
    ownedIds.length
      ? prisma.field.findMany({
          where: { id: { in: ownedIds } },
          select: { id: true, name: true, cropStatus: true },
        })
      : Promise.resolve([]),
    ownedIds.length
      ? prisma.sprayApplication.findMany({
          where: { fieldId: { in: ownedIds } },
          include: { productRef: { select: { id: true, name: true, productType: true } } },
          orderBy: { applicationDate: "asc" },
        })
      : Promise.resolve([]),
  ]);

  const productCounts = new Map<string, number>();
  const productData = new Map<string, { product_id: string | null; product: string; product_type: string | null }>();
  const productTypeCounts = new Map<string, number>();
  const fieldCounts = new Map<string, number>();
  const fieldNames = new Map<string, string>();
  const targetCounts = new Map<string, number>();
  const monthCounts = new Map<string, number>();
  const validIntervals: number[] = [];

  for (const field of fields) fieldNames.set(field.id, field.name);

  for (const spray of sprays) {
    const selectedProduct = spray.productRef;
    const productId = selectedProduct?.id ?? spray.productId ?? null;
    const productName = (selectedProduct?.name ?? spray.product).trim();
    const productType = (spray.productType ?? selectedProduct?.productType ?? "").trim() || null;

    if (productName) {
      const key = productId ? `id:${productId}` : `name:${productName.toLowerCase()}`;
      increment(productCounts, key);
      productData.set(key, { product_id: productId, product: productName, product_type: productType });
    }

    increment(productTypeCounts, productType);
    increment(fieldCounts, spray.fieldId);
    if (spray.fieldName) fieldNames.set(spray.fieldId, spray.fieldName);
    increment(targetCounts, spray.target.trim() || null);
    increment(monthCounts, getSaoPauloDateKey(spray.applicationDate).slice(0, 7));
    if (spray.plannedIntervalDays > 0) validIntervals.push(spray.plannedIntervalDays);
  }

  const topProducts: ProductMetric[] = sortRows(
    Array.from(productCounts.entries()).map(([key, count]) => ({
      product_id: productData.get(key)?.product_id ?? null,
      product: productData.get(key)?.product ?? key,
      product_type: productData.get(key)?.product_type ?? null,
      applications_count: count,
    })),
    (row) => row.product,
  );

  const productTypeDistribution = sortRows(
    Array.from(productTypeCounts.entries()).map(([product_type, applications_count]) => ({ product_type, applications_count })),
    (row) => row.product_type,
  );

  const topFieldsByApplications = sortRows(
    Array.from(fieldCounts.entries()).map(([field_id, applications_count]) => ({
      field_id,
      field_name: fieldNames.get(field_id) ?? field_id,
      applications_count,
    })),
    (row) => row.field_name,
  );

  const topTargets: TargetMetric[] = sortRows(
    Array.from(targetCounts.entries()).map(([target, applications_count]) => ({ target, applications_count })),
    (row) => row.target,
  );

  const sprayApplicationsByMonth = Array.from(monthCounts.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, applications_count]) => ({ month, applications_count }));

  const averageInterval = validIntervals.length
    ? Math.round((validIntervals.reduce((sum, value) => sum + value, 0) / validIntervals.length) * 100) / 100
    : 0;

  return {
    summary: {
      total_fields: fields.length,
      active_fields: fields.filter((field) => field.cropStatus === "em_campo").length,
      total_spray_applications: sprays.length,
      total_products_used: productCounts.size,
      average_planned_interval_days: averageInterval,
    },
    top_products: topProducts,
    product_type_distribution: productTypeDistribution,
    top_fields_by_applications: topFieldsByApplications,
    top_targets: topTargets,
    spray_applications_by_month: sprayApplicationsByMonth,
  };
}
