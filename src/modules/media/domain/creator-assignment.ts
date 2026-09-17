export type TimedCreatorAssignment = {
  matchId: string;
  startsAt: Date | null;
  endsAt: Date | null;
  creatorIds: string[];
};

export type CreatorAssignmentConflict = {
  creatorId: string;
  firstMatchId: string;
  secondMatchId: string;
};

export function normalizeCreatorIds(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return Array.from(
    new Set(
      values
        .map((value) => String(value ?? "").trim())
        .filter((value) => value.length > 0)
    )
  );
}

function overlaps(
  firstStart: Date,
  firstEnd: Date,
  secondStart: Date,
  secondEnd: Date
) {
  return firstStart < secondEnd && secondStart < firstEnd;
}

export function findCreatorAssignmentConflicts(
  assignments: TimedCreatorAssignment[]
): CreatorAssignmentConflict[] {
  const conflicts: CreatorAssignmentConflict[] = [];

  for (let firstIndex = 0; firstIndex < assignments.length; firstIndex += 1) {
    const first = assignments[firstIndex];
    if (!first.startsAt || !first.endsAt || first.endsAt <= first.startsAt) continue;

    for (
      let secondIndex = firstIndex + 1;
      secondIndex < assignments.length;
      secondIndex += 1
    ) {
      const second = assignments[secondIndex];
      if (
        !second.startsAt ||
        !second.endsAt ||
        second.endsAt <= second.startsAt ||
        !overlaps(first.startsAt, first.endsAt, second.startsAt, second.endsAt)
      ) {
        continue;
      }

      const secondCreators = new Set(second.creatorIds);
      for (const creatorId of first.creatorIds) {
        if (!secondCreators.has(creatorId)) continue;
        conflicts.push({
          creatorId,
          firstMatchId: first.matchId,
          secondMatchId: second.matchId,
        });
      }
    }
  }

  return conflicts;
}
