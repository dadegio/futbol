import { prisma } from "@/lib/prisma";

type SchemaProbeRow = {
  missingCount: number;
};

export async function getApplicationHealth() {
  const startedAt = Date.now();
  await prisma.$queryRaw`SELECT 1`;

  // Il probe usa information_schema invece dei model Prisma, così continua a
  // funzionare anche quando il codice è più nuovo del DB. È proprio il caso che
  // vogliamo distinguere da un database completamente irraggiungibile.
  const rows = await prisma.$queryRaw<SchemaProbeRow[]>`
    SELECT COUNT(*)::int AS "missingCount"
    FROM (
      VALUES
        ('Match', 'lifecycleStatus'),
        ('Match', 'resultStatus'),
        ('Match', 'homeSheetConfirmed'),
        ('Match', 'awaySheetConfirmed'),
        ('Match', 'mvpPlayerId'),
        ('TeamFeePayment', 'id')
    ) AS required("tableName", "columnName")
    WHERE NOT EXISTS (
      SELECT 1
      FROM information_schema.columns c
      WHERE c.table_schema = current_schema()
        AND c.table_name = required."tableName"
        AND c.column_name = required."columnName"
    )
  `;

  const schemaOk = (rows[0]?.missingCount ?? 1) === 0;

  return {
    status: schemaOk ? ("ok" as const) : ("degraded" as const),
    database: "ok" as const,
    schema: schemaOk ? ("ok" as const) : ("outdated" as const),
    latencyMs: Date.now() - startedAt,
    timestamp: new Date().toISOString(),
  };
}
