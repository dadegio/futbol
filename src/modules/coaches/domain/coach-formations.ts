export type CoachSlotRole = "GK" | "DEF" | "MID" | "ATT";

export type FormationPoint = {
  x: number;
  y: number;
  role: CoachSlotRole;
};

export const COACH_FORMATIONS = {
  "3-3-1": [
    { x: 50, y: 91, role: "GK" },
    { x: 22, y: 72, role: "DEF" }, { x: 50, y: 68, role: "DEF" }, { x: 78, y: 72, role: "DEF" },
    { x: 22, y: 46, role: "MID" }, { x: 50, y: 42, role: "MID" }, { x: 78, y: 46, role: "MID" },
    { x: 50, y: 17, role: "ATT" },
  ],
  "2-3-2": [
    { x: 50, y: 91, role: "GK" },
    { x: 34, y: 70, role: "DEF" }, { x: 66, y: 70, role: "DEF" },
    { x: 20, y: 46, role: "MID" }, { x: 50, y: 42, role: "MID" }, { x: 80, y: 46, role: "MID" },
    { x: 35, y: 19, role: "ATT" }, { x: 65, y: 19, role: "ATT" },
  ],
  "3-2-2": [
    { x: 50, y: 91, role: "GK" },
    { x: 22, y: 72, role: "DEF" }, { x: 50, y: 68, role: "DEF" }, { x: 78, y: 72, role: "DEF" },
    { x: 35, y: 44, role: "MID" }, { x: 65, y: 44, role: "MID" },
    { x: 35, y: 19, role: "ATT" }, { x: 65, y: 19, role: "ATT" },
  ],
  "2-4-1": [
    { x: 50, y: 91, role: "GK" },
    { x: 34, y: 70, role: "DEF" }, { x: 66, y: 70, role: "DEF" },
    { x: 14, y: 46, role: "MID" }, { x: 38, y: 42, role: "MID" }, { x: 62, y: 42, role: "MID" }, { x: 86, y: 46, role: "MID" },
    { x: 50, y: 17, role: "ATT" },
  ],
  "4-2-1": [
    { x: 50, y: 91, role: "GK" },
    { x: 14, y: 70, role: "DEF" }, { x: 38, y: 66, role: "DEF" }, { x: 62, y: 66, role: "DEF" }, { x: 86, y: 70, role: "DEF" },
    { x: 35, y: 42, role: "MID" }, { x: 65, y: 42, role: "MID" },
    { x: 50, y: 17, role: "ATT" },
  ],
  "3-1-3": [
    { x: 50, y: 91, role: "GK" },
    { x: 22, y: 72, role: "DEF" }, { x: 50, y: 68, role: "DEF" }, { x: 78, y: 72, role: "DEF" },
    { x: 50, y: 47, role: "MID" },
    { x: 20, y: 20, role: "ATT" }, { x: 50, y: 16, role: "ATT" }, { x: 80, y: 20, role: "ATT" },
  ],
  "2-2-3": [
    { x: 50, y: 91, role: "GK" },
    { x: 34, y: 70, role: "DEF" }, { x: 66, y: 70, role: "DEF" },
    { x: 35, y: 46, role: "MID" }, { x: 65, y: 46, role: "MID" },
    { x: 18, y: 20, role: "ATT" }, { x: 50, y: 16, role: "ATT" }, { x: 82, y: 20, role: "ATT" },
  ],
} as const satisfies Record<string, readonly FormationPoint[]>;

export type CoachFormation = keyof typeof COACH_FORMATIONS | "MANUAL";

export const COACH_FORMATION_OPTIONS: CoachFormation[] = [
  "3-3-1",
  "2-3-2",
  "3-2-2",
  "2-4-1",
  "4-2-1",
  "3-1-3",
  "2-2-3",
  "MANUAL",
];

export const COACH_LINEUP_LOCK_MINUTES = 30;

function normalizedPosition(position: string | null | undefined) {
  return String(position ?? "")
    .trim()
    .toUpperCase()
    .replace(/[.\-_]/g, " ");
}

export function coachRolePreferences(
  position: string | null | undefined
): CoachSlotRole[] {
  const value = normalizedPosition(position);

  if (
    value === "POR" ||
    value === "GK" ||
    value.includes("PORTIER")
  ) {
    return ["GK"];
  }

  if (
    value === "DC" ||
    value === "DIF" ||
    value === "CB" ||
    value === "TS" ||
    value === "TD" ||
    value === "DD" ||
    value === "DS" ||
    value.includes("DIFENSOR") ||
    value.includes("TERZIN")
  ) {
    return ["DEF", "MID"];
  }

  if (
    value === "ES" ||
    value === "ED" ||
    value === "AS" ||
    value === "AD" ||
    value.includes("ESTERN") ||
    value.includes("ALA")
  ) {
    return ["MID", "ATT"];
  }

  if (
    value === "CC" ||
    value === "CDC" ||
    value === "COC" ||
    value === "CM" ||
    value === "MID" ||
    value.includes("CENTROCAM") ||
    value.includes("MEDIAN")
  ) {
    return ["MID", "DEF", "ATT"];
  }

  if (
    value === "ATT" ||
    value === "ST" ||
    value === "CF" ||
    value === "P" ||
    value.includes("ATTACC") ||
    value.includes("PUNTA")
  ) {
    return ["ATT", "MID"];
  }

  return ["MID", "DEF", "ATT"];
}

export function isCoachRoleCompatible(
  position: string | null | undefined,
  role: CoachSlotRole
) {
  return coachRolePreferences(position).includes(role);
}

export function fieldZoneRole(y: number): CoachSlotRole {
  if (y >= 82) return "GK";
  if (y >= 57) return "DEF";
  if (y >= 31) return "MID";
  return "ATT";
}

export type AutoFormationPlayer = {
  playerId: string;
  position: string | null | undefined;
};

export function assignPlayersToFormation(
  players: AutoFormationPlayer[],
  formation: Exclude<CoachFormation, "MANUAL">
): Record<string, FormationPoint> | null {
  const slots = COACH_FORMATIONS[formation].map((slot, index) => ({
    ...slot,
    index,
  }));
  const used = new Set<number>();
  const result: Record<string, FormationPoint> = {};

  const ordered = [...players].sort((a, b) => {
    const aPrefs = coachRolePreferences(a.position).length;
    const bPrefs = coachRolePreferences(b.position).length;
    if (aPrefs !== bPrefs) return aPrefs - bPrefs;
    return a.playerId.localeCompare(b.playerId);
  });

  for (const player of ordered) {
    const preferences = coachRolePreferences(player.position);
    let selected:
      | (FormationPoint & { index: number })
      | undefined;

    for (const role of preferences) {
      selected = slots.find(
        (slot) => !used.has(slot.index) && slot.role === role
      );
      if (selected) break;
    }

    if (!selected) return null;

    used.add(selected.index);
    result[player.playerId] = {
      x: selected.x,
      y: selected.y,
      role: selected.role,
    };
  }

  return result;
}

export function isCoachFormation(value: string): value is CoachFormation {
  return COACH_FORMATION_OPTIONS.includes(value as CoachFormation);
}

export function lineupDeadline(date: Date | null) {
  return date
    ? new Date(date.getTime() - COACH_LINEUP_LOCK_MINUTES * 60_000)
    : null;
}
