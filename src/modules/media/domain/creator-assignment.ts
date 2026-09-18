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

export type CreatorCoverageRole = "PHOTO" | "VIDEO" | "BOTH";
export type CreatorAssignmentRole = "PHOTO" | "VIDEO";

export type CoverageCreatorInput = {
  id: string;
  displayName: string;
  coverageRole: CreatorCoverageRole;
  weeklyAssignmentLimit: number;
  preferredTeamId: string | null;
  seasonAssignmentCount?: number;
};

export type CoverageMatchInput = {
  id: string;
  homeTeamId: string;
  awayTeamId: string;
  startsAt: Date | null;
  endsAt: Date | null;
  videoRequired: boolean;
};

export type SuggestedCoverageAssignment = {
  matchId: string;
  photoCreatorId: string | null;
  videoCreatorId: string | null;
};

export type CoverageSuggestion = {
  assignments: SuggestedCoverageAssignment[];
  photoRequired: number;
  photoAssigned: number;
  videoRequired: number;
  videoAssigned: number;
  veoMatches: number;
  missingPhoto: number;
  missingVideo: number;
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

function timedMatchesOverlap(first: CoverageMatchInput, second: CoverageMatchInput) {
  if (
    !first.startsAt ||
    !first.endsAt ||
    !second.startsAt ||
    !second.endsAt ||
    first.endsAt <= first.startsAt ||
    second.endsAt <= second.startsAt
  ) {
    return false;
  }
  return overlaps(first.startsAt, first.endsAt, second.startsAt, second.endsAt);
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

function canCoverRole(creator: CoverageCreatorInput, role: CreatorAssignmentRole) {
  return creator.coverageRole === "BOTH" || creator.coverageRole === role;
}

function prefersMatch(creator: CoverageCreatorInput, match: CoverageMatchInput) {
  return Boolean(
    creator.preferredTeamId &&
      (creator.preferredTeamId === match.homeTeamId ||
        creator.preferredTeamId === match.awayTeamId)
  );
}

/**
 * Builds a deterministic draft for one tournament round. The function never
 * exceeds a creator's weekly limit, never uses the same person twice on the
 * same match and avoids known time overlaps. Missing staff are intentionally
 * left null so the admin can immediately see real coverage gaps.
 */
export function suggestRoundCoverage({
  creators,
  matches,
}: {
  creators: CoverageCreatorInput[];
  matches: CoverageMatchInput[];
}): CoverageSuggestion {
  const usage = new Map(creators.map((creator) => [creator.id, 0]));
  const selectedMatches = new Map<string, CoverageMatchInput[]>();
  const result = new Map<string, SuggestedCoverageAssignment>(
    matches.map((match) => [
      match.id,
      { matchId: match.id, photoCreatorId: null, videoCreatorId: null },
    ])
  );

  const pickCreator = (
    match: CoverageMatchInput,
    role: CreatorAssignmentRole,
    alreadyOnMatch: string | null
  ) => {
    const candidates = creators
      .filter((creator) => {
        if (!canCoverRole(creator, role)) return false;
        if (creator.id === alreadyOnMatch) return false;
        const used = usage.get(creator.id) ?? 0;
        if (used >= creator.weeklyAssignmentLimit) return false;
        return !(selectedMatches.get(creator.id) ?? []).some((otherMatch) =>
          timedMatchesOverlap(match, otherMatch)
        );
      })
      .sort((first, second) => {
        const firstPreference = prefersMatch(first, match) ? 1 : 0;
        const secondPreference = prefersMatch(second, match) ? 1 : 0;
        if (firstPreference !== secondPreference) {
          return secondPreference - firstPreference;
        }

        const firstUsed = usage.get(first.id) ?? 0;
        const secondUsed = usage.get(second.id) ?? 0;
        if (firstUsed !== secondUsed) return firstUsed - secondUsed;

        const firstSeason = first.seasonAssignmentCount ?? 0;
        const secondSeason = second.seasonAssignmentCount ?? 0;
        if (firstSeason !== secondSeason) return firstSeason - secondSeason;

        return first.displayName.localeCompare(second.displayName, "it");
      });

    const creator = candidates[0] ?? null;
    if (!creator) return null;
    usage.set(creator.id, (usage.get(creator.id) ?? 0) + 1);
    selectedMatches.set(creator.id, [
      ...(selectedMatches.get(creator.id) ?? []),
      match,
    ]);
    return creator.id;
  };

  for (const match of matches) {
    const assignment = result.get(match.id)!;
    assignment.photoCreatorId = pickCreator(match, "PHOTO", null);
  }

  for (const match of matches) {
    if (!match.videoRequired) continue;
    const assignment = result.get(match.id)!;
    assignment.videoCreatorId = pickCreator(
      match,
      "VIDEO",
      assignment.photoCreatorId
    );
  }

  const assignments = matches.map((match) => result.get(match.id)!);
  const photoAssigned = assignments.filter(
    (assignment) => assignment.photoCreatorId
  ).length;
  const videoRequired = matches.filter((match) => match.videoRequired).length;
  const videoAssigned = assignments.filter(
    (assignment, index) => matches[index]?.videoRequired && assignment.videoCreatorId
  ).length;

  return {
    assignments,
    photoRequired: matches.length,
    photoAssigned,
    videoRequired,
    videoAssigned,
    veoMatches: matches.length - videoRequired,
    missingPhoto: matches.length - photoAssigned,
    missingVideo: videoRequired - videoAssigned,
  };
}
