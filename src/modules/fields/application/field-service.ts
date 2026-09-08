import { prisma } from "@/lib/prisma";
import { AppError } from "@/modules/core/api";

type SlotInput = {
  weekday: number;
  hour: number;
  minute: number;
  durationMinutes?: number;
};

function normalizeSlots(value: unknown): SlotInput[] | null {
  if (!Array.isArray(value)) return null;

  const normalized: SlotInput[] = [];
  const seen = new Set<string>();

  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const raw = item as Record<string, unknown>;
    const weekday = Number(raw.weekday);
    const hour = Number(raw.hour);
    const minute = Number(raw.minute);
    const durationMinutes =
      raw.durationMinutes === undefined ? 60 : Number(raw.durationMinutes);

    if (
      !Number.isInteger(weekday) ||
      weekday < 0 ||
      weekday > 6 ||
      !Number.isInteger(hour) ||
      hour < 0 ||
      hour > 23 ||
      !Number.isInteger(minute) ||
      minute < 0 ||
      minute > 59 ||
      !Number.isInteger(durationMinutes) ||
      durationMinutes < 15 ||
      durationMinutes > 24 * 60
    ) {
      return null;
    }

    const key = `${weekday}:${hour}:${minute}`;
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push({ weekday, hour, minute, durationMinutes });
  }

  return normalized;
}

const fieldSelect = {
  id: true,
  name: true,
  address: true,
  active: true,
  slots: {
    select: {
      id: true,
      weekday: true,
      hour: true,
      minute: true,
      durationMinutes: true,
    },
    orderBy: [
      { weekday: "asc" as const },
      { hour: "asc" as const },
      { minute: "asc" as const },
    ],
  },
};

export async function listLeagueFields({
  leagueId,
  includeInactive,
}: {
  leagueId: string;
  includeInactive: boolean;
}) {
  return prisma.field.findMany({
    where: { leagueId, ...(!includeInactive ? { active: true } : {}) },
    select: fieldSelect,
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });
}

export async function createField({
  leagueId,
  input,
}: {
  leagueId: string;
  input: Record<string, unknown>;
}) {
  const name = String(input.name ?? "").trim().replace(/\s+/g, " ");
  const address = String(input.address ?? "").trim().replace(/\s+/g, " ");

  if (name.length < 2) throw new AppError(400, "Inserisci il nome del campo");
  if (address.length < 3) throw new AppError(400, "Inserisci la via del campo");

  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: { id: true },
  });
  if (!league) throw new AppError(404, "Torneo non trovato");

  try {
    return await prisma.field.create({
      data: { leagueId, name, address },
      select: fieldSelect,
    });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      throw new AppError(409, "Esiste già un campo con questo nome");
    }
    throw error;
  }
}

export async function updateField({
  leagueId,
  input,
}: {
  leagueId: string;
  input: Record<string, unknown>;
}) {
  const id = String(input.id ?? "").trim();
  if (!id) throw new AppError(400, "Campo mancante");

  const existing = await prisma.field.findFirst({
    where: { id, leagueId },
    select: { id: true },
  });
  if (!existing) throw new AppError(404, "Campo non trovato");

  const name =
    input.name === undefined
      ? undefined
      : String(input.name).trim().replace(/\s+/g, " ");
  const address =
    input.address === undefined
      ? undefined
      : String(input.address).trim().replace(/\s+/g, " ");
  const active = input.active === undefined ? undefined : Boolean(input.active);
  const slots = input.slots === undefined ? undefined : normalizeSlots(input.slots);

  if (name !== undefined && name.length < 2) {
    throw new AppError(400, "Nome campo non valido");
  }
  if (address !== undefined && address.length < 3) {
    throw new AppError(400, "Via del campo non valida");
  }
  if (input.slots !== undefined && slots === null) {
    throw new AppError(400, "Uno o più slot non sono validi");
  }

  try {
    return await prisma.$transaction(async (tx) => {
      await tx.field.update({
        where: { id },
        data: {
          ...(name !== undefined ? { name } : {}),
          ...(address !== undefined ? { address } : {}),
          ...(active !== undefined ? { active } : {}),
        },
      });

      if (slots !== undefined && slots !== null) {
        await tx.fieldSlot.deleteMany({ where: { fieldId: id } });
        if (slots.length > 0) {
          await tx.fieldSlot.createMany({
            data: slots.map((slot) => ({
              fieldId: id,
              weekday: slot.weekday,
              hour: slot.hour,
              minute: slot.minute,
              durationMinutes: slot.durationMinutes ?? 60,
            })),
          });
        }
      }

      return tx.field.findUniqueOrThrow({ where: { id }, select: fieldSelect });
    });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      throw new AppError(
        409,
        "Esiste già un campo con questo nome o uno slot duplicato"
      );
    }
    throw error;
  }
}

export async function deleteField({
  leagueId,
  fieldId,
}: {
  leagueId: string;
  fieldId: string;
}) {
  if (!fieldId) throw new AppError(400, "Campo mancante");

  const field = await prisma.field.findFirst({
    where: { id: fieldId, leagueId },
    select: { id: true },
  });
  if (!field) throw new AppError(404, "Campo non trovato");

  const releasedBookings = await prisma.$transaction(async (tx) => {
    const released = await tx.match.updateMany({
      where: {
        leagueId,
        venueKey: fieldId,
        homeGoals: null,
        awayGoals: null,
      },
      data: {
        date: null,
        slotEnd: null,
        venueKey: null,
        venueName: null,
        venueAddress: null,
        bookedByUserId: null,
        bookedAt: null,
      },
    });
    await tx.field.delete({ where: { id: fieldId } });
    return released.count;
  });

  return { ok: true, releasedBookings };
}