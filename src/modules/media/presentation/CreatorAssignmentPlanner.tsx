"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  CalendarDays,
  Camera,
  CheckCircle2,
  Heart,
  RefreshCw,
  Save,
  Sparkles,
  UserRound,
  Video,
} from "lucide-react";
import Card, { CardHeader } from "src/app/_components/ui/card";
import Badge from "src/app/_components/ui/badge";
import Button from "src/app/_components/ui/button";
import Select from "src/app/_components/ui/select";
import { authFetch } from "@/lib/client-auth";
import {
  suggestRoundCoverage,
  type CreatorAssignmentRole,
  type CreatorCoverageRole,
} from "@/modules/media/domain/creator-assignment";

type Team = {
  id: string;
  name: string;
  badgeUrl: string | null;
};

type Creator = {
  id: string;
  displayName: string;
  roleLabel: string | null;
  avatarUrl: string | null;
  active: boolean;
  preferredTeamId: string | null;
  preferredTeam: Team | null;
  coverageRole: CreatorCoverageRole;
  weeklyAssignmentLimit: number;
  _count?: { matchAssignments: number };
};

type Match = {
  id: string;
  round: number;
  date: string | null;
  slotEnd: string | null;
  slotWeekStart: string | null;
  lifecycleStatus: string;
  homeTeam: Team;
  awayTeam: Team;
  creatorAssignments: Array<{
    creatorId: string;
    role: CreatorAssignmentRole;
  }>;
};

type AssignmentBoard = {
  veoTeamId: string | null;
  creators: Creator[];
  teams: Team[];
  matches: Match[];
};

type DraftAssignment = {
  photoCreatorId: string;
  videoCreatorId: string;
};

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function matchDateLabel(match: Match) {
  if (!match.date) return "Data da definire";
  const date = new Date(match.date);
  if (Number.isNaN(date.getTime())) return "Data da definire";
  return new Intl.DateTimeFormat("it-IT", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function roundWeekLabel(matches: Match[], round: number) {
  const weekStart = matches.find(
    (match) => match.round === round && match.slotWeekStart
  )?.slotWeekStart;
  if (!weekStart) return `Giornata ${round}`;
  const date = new Date(weekStart);
  if (Number.isNaN(date.getTime())) return `Giornata ${round}`;
  return `Giornata ${round} · settimana dal ${new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
  }).format(date)}`;
}

function preferenceMatches(creator: Creator, match: Match) {
  return Boolean(
    creator.preferredTeamId &&
      (creator.preferredTeamId === match.homeTeam.id ||
        creator.preferredTeamId === match.awayTeam.id)
  );
}

function canCover(creator: Creator, role: CreatorAssignmentRole) {
  return creator.coverageRole === "BOTH" || creator.coverageRole === role;
}

function roleLabel(role: CreatorCoverageRole) {
  if (role === "PHOTO") return "Foto";
  if (role === "VIDEO") return "Video";
  return "Foto + video";
}

export default function CreatorAssignmentPlanner({ leagueId }: { leagueId: string }) {
  const [board, setBoard] = useState<AssignmentBoard | null>(null);
  const [draft, setDraft] = useState<Record<string, DraftAssignment>>({});
  const [selectedRound, setSelectedRound] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingKey, setUpdatingKey] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await authFetch(`/api/leagues/${leagueId}/creator-assignments`, {
        cache: "no-store",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.error ?? "Errore caricamento piano creator");
      }
      const nextBoard = body as AssignmentBoard;
      setBoard(nextBoard);
      setDraft(
        Object.fromEntries(
          nextBoard.matches.map((match) => [
            match.id,
            {
              photoCreatorId:
                match.creatorAssignments.find((assignment) => assignment.role === "PHOTO")
                  ?.creatorId ?? "",
              videoCreatorId:
                match.creatorAssignments.find((assignment) => assignment.role === "VIDEO")
                  ?.creatorId ?? "",
            },
          ])
        )
      );
      const nextRounds = Array.from(
        new Set(nextBoard.matches.map((match) => match.round))
      ).sort((a, b) => a - b);
      setSelectedRound((current) =>
        current && nextRounds.includes(current) ? current : nextRounds[0] ?? null
      );
    } catch (error) {
      setErr(getErrorMessage(error, "Errore caricamento piano creator"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [leagueId]);

  const rounds = useMemo(
    () =>
      Array.from(new Set(board?.matches.map((match) => match.round) ?? [])).sort(
        (a, b) => a - b
      ),
    [board?.matches]
  );

  const matches = useMemo(
    () => board?.matches.filter((match) => match.round === selectedRound) ?? [],
    [board?.matches, selectedRound]
  );

  const activeCreators = useMemo(
    () => board?.creators.filter((creator) => creator.active) ?? [],
    [board?.creators]
  );

  const isVeoMatch = (match: Match) =>
    Boolean(
      board?.veoTeamId &&
        (match.homeTeam.id === board.veoTeamId || match.awayTeam.id === board.veoTeamId)
    );

  const summary = useMemo(() => {
    const photoAssigned = matches.filter(
      (match) => Boolean(draft[match.id]?.photoCreatorId)
    ).length;
    const videoRequiredMatches = matches.filter((match) => !isVeoMatch(match));
    const videoAssigned = videoRequiredMatches.filter((match) =>
      Boolean(draft[match.id]?.videoCreatorId)
    ).length;
    const photoCapacity = activeCreators
      .filter((creator) => canCover(creator, "PHOTO"))
      .reduce((sum, creator) => sum + creator.weeklyAssignmentLimit, 0);
    const videoCapacity = activeCreators
      .filter((creator) => canCover(creator, "VIDEO"))
      .reduce((sum, creator) => sum + creator.weeklyAssignmentLimit, 0);

    return {
      photoAssigned,
      photoRequired: matches.length,
      videoAssigned,
      videoRequired: videoRequiredMatches.length,
      veoMatches: matches.length - videoRequiredMatches.length,
      photoCapacity,
      videoCapacity,
    };
  }, [activeCreators, board?.veoTeamId, draft, matches]);

  const usageByCreator = useMemo(() => {
    const usage = new Map<string, number>();
    for (const match of matches) {
      const row = draft[match.id];
      if (!row) continue;
      if (row.photoCreatorId) {
        usage.set(row.photoCreatorId, (usage.get(row.photoCreatorId) ?? 0) + 1);
      }
      if (!isVeoMatch(match) && row.videoCreatorId) {
        usage.set(row.videoCreatorId, (usage.get(row.videoCreatorId) ?? 0) + 1);
      }
    }
    return usage;
  }, [board?.veoTeamId, draft, matches]);

  function setAssignment(
    matchId: string,
    field: keyof DraftAssignment,
    creatorId: string
  ) {
    setMsg(null);
    setDraft((current) => ({
      ...current,
      [matchId]: {
        photoCreatorId: current[matchId]?.photoCreatorId ?? "",
        videoCreatorId: current[matchId]?.videoCreatorId ?? "",
        [field]: creatorId,
      },
    }));
  }

  function generateProposal() {
    if (!board) return;
    const suggestion = suggestRoundCoverage({
      creators: activeCreators.map((creator) => ({
        id: creator.id,
        displayName: creator.displayName,
        coverageRole: creator.coverageRole,
        weeklyAssignmentLimit: creator.weeklyAssignmentLimit,
        preferredTeamId: creator.preferredTeamId,
        seasonAssignmentCount: creator._count?.matchAssignments ?? 0,
      })),
      matches: matches.map((match) => ({
        id: match.id,
        homeTeamId: match.homeTeam.id,
        awayTeamId: match.awayTeam.id,
        startsAt: match.date ? new Date(match.date) : null,
        endsAt: match.slotEnd ? new Date(match.slotEnd) : null,
        videoRequired: !isVeoMatch(match),
      })),
    });

    setDraft((current) => ({
      ...current,
      ...Object.fromEntries(
        suggestion.assignments.map((assignment) => [
          assignment.matchId,
          {
            photoCreatorId: assignment.photoCreatorId ?? "",
            videoCreatorId: assignment.videoCreatorId ?? "",
          },
        ])
      ),
    }));
    setMsg(
      `Proposta generata: foto ${suggestion.photoAssigned}/${suggestion.photoRequired}, video ${suggestion.videoAssigned}/${suggestion.videoRequired}${suggestion.veoMatches ? ` · VEO ${suggestion.veoMatches}` : ""}`
    );
  }

  async function saveRound() {
    if (!selectedRound) return;
    setSaving(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await authFetch(`/api/leagues/${leagueId}/creator-assignments`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          round: selectedRound,
          assignments: matches.map((match) => ({
            matchId: match.id,
            photoCreatorId: draft[match.id]?.photoCreatorId || null,
            videoCreatorId: isVeoMatch(match)
              ? null
              : draft[match.id]?.videoCreatorId || null,
          })),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.error ?? "Errore salvataggio assegnazioni");
      }
      setMsg(
        `Giornata ${selectedRound} salvata · foto ${body.photoAssignments}/${body.matches} · video ${body.videoAssignments}/${body.matches - body.veoMatches}${body.veoMatches ? ` · VEO ${body.veoMatches}` : ""}`
      );
      await load();
    } catch (error) {
      setErr(getErrorMessage(error, "Errore salvataggio assegnazioni"));
    } finally {
      setSaving(false);
    }
  }

  async function updateCreator(
    creatorId: string,
    patch: Partial<
      Pick<Creator, "preferredTeamId" | "coverageRole" | "weeklyAssignmentLimit">
    >
  ) {
    setUpdatingKey(`creator:${creatorId}`);
    setErr(null);
    setMsg(null);
    try {
      const res = await authFetch(
        `/api/leagues/${leagueId}/creators/${creatorId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        }
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.error ?? "Errore aggiornamento creator");
      }
      setMsg(`Impostazioni aggiornate per ${body.displayName ?? "creator"}`);
      await load();
    } catch (error) {
      setErr(getErrorMessage(error, "Errore aggiornamento creator"));
    } finally {
      setUpdatingKey(null);
    }
  }

  async function updateVeoTeam(veoTeamId: string) {
    setUpdatingKey("veo");
    setErr(null);
    setMsg(null);
    try {
      const res = await authFetch(`/api/leagues/${leagueId}/creator-assignments`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ veoTeamId: veoTeamId || null }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? "Errore aggiornamento VEO");
      setMsg(veoTeamId ? "Squadra VEO aggiornata" : "Copertura VEO rimossa");
      await load();
    } catch (error) {
      setErr(getErrorMessage(error, "Errore aggiornamento VEO"));
    } finally {
      setUpdatingKey(null);
    }
  }

  return (
    <Card variant="inner" className="mt-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <CardHeader
          tag="Copertura settimanale"
          title="Crew foto e video"
          description="Ogni partita ha uno slot foto e uno video. Le gare della squadra VEO richiedono solo il fotografo. Genera una proposta usando disponibilità, limiti settimanali e preferenze di squadra."
        />
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={selectedRound ?? ""}
            onChange={(event) => setSelectedRound(Number(event.target.value))}
            disabled={loading || rounds.length === 0}
            className="min-w-[190px]"
          >
            {rounds.length === 0 && (
              <option value="" className="text-black">
                Nessuna giornata
              </option>
            )}
            {rounds.map((round) => (
              <option key={round} value={round} className="text-black">
                {roundWeekLabel(board?.matches ?? [], round)}
              </option>
            ))}
          </Select>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={generateProposal}
            disabled={loading || matches.length === 0}
          >
            <Sparkles size={15} className="mr-1" /> Genera proposta
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={load} disabled={loading}>
            <RefreshCw size={15} className="mr-1" /> Aggiorna
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={saveRound}
            disabled={saving || loading || !selectedRound || matches.length === 0}
          >
            <Save size={15} className="mr-1" />
            {saving ? "Salvataggio…" : "Salva giornata"}
          </Button>
        </div>
      </div>

      {err && (
        <div className="mt-4">
          <Badge variant="error">{err}</Badge>
        </div>
      )}
      {msg && (
        <div className="mt-4">
          <Badge variant="success">
            <CheckCircle2 size={14} /> {msg}
          </Badge>
        </div>
      )}

      {selectedRound && matches.length > 0 && (
        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <CoverageStat
            icon={<Camera size={16} />}
            label="Foto assegnate"
            value={`${summary.photoAssigned}/${summary.photoRequired}`}
            note={`capacità ${summary.photoCapacity}/settimana`}
            warning={summary.photoAssigned < summary.photoRequired}
          />
          <CoverageStat
            icon={<Video size={16} />}
            label="Video assegnati"
            value={`${summary.videoAssigned}/${summary.videoRequired}`}
            note={`capacità ${summary.videoCapacity}/settimana`}
            warning={summary.videoAssigned < summary.videoRequired}
          />
          <CoverageStat
            icon={<CheckCircle2 size={16} />}
            label="VEO"
            value={String(summary.veoMatches)}
            note="video non richiesto"
          />
          <CoverageStat
            icon={<AlertTriangle size={16} />}
            label="Slot scoperti"
            value={String(
              summary.photoRequired - summary.photoAssigned +
                (summary.videoRequired - summary.videoAssigned)
            )}
            note="da coprire manualmente"
            warning={
              summary.photoAssigned < summary.photoRequired ||
              summary.videoAssigned < summary.videoRequired
            }
          />
        </div>
      )}

      <div className="mt-5 grid gap-4 xl:grid-cols-[0.78fr_1.22fr]">
        <section className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-4">
          <div className="flex items-center gap-2">
            <Heart size={16} className="text-[var(--accent)]" />
            <h3 className="text-sm font-black uppercase tracking-[0.14em] text-[var(--foreground)]">
              Regole crew
            </h3>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
            Imposta ruolo, massimo di partite per settimana e preferenza squadra. La preferenza orienta la proposta, ma non è un vincolo.
          </p>

          <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--card-2)] p-3">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--muted)]">
              Squadra con VEO
            </p>
            <Select
              value={board?.veoTeamId ?? ""}
              onChange={(event) => void updateVeoTeam(event.target.value)}
              disabled={updatingKey === "veo"}
              className="mt-2 w-full"
            >
              <option value="" className="text-black">
                Nessuna squadra VEO
              </option>
              {board?.teams.map((team) => (
                <option key={team.id} value={team.id} className="text-black">
                  {team.name}
                </option>
              ))}
            </Select>
            <p className="mt-2 text-xs text-[var(--muted)]">
              Le partite che coinvolgono questa squadra non richiedono un videomaker.
            </p>
          </div>

          <div className="mt-3 space-y-2">
            {board?.creators.length === 0 && !loading && (
              <p className="text-sm text-[var(--muted)]">Nessun creator configurato.</p>
            )}
            {board?.creators.map((creator) => (
              <div
                key={creator.id}
                className="rounded-2xl border border-[var(--border)] bg-[var(--card-2)] p-3"
              >
                <div className="flex items-center gap-3">
                  {creator.avatarUrl ? (
                    <img
                      src={creator.avatarUrl}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="h-10 w-10 rounded-xl object-cover"
                    />
                  ) : (
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                      <UserRound size={18} />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black text-[var(--foreground)]">
                      {creator.displayName}
                    </p>
                    <p className="truncate text-xs text-[var(--muted)]">
                      {roleLabel(creator.coverageRole)} · {usageByCreator.get(creator.id) ?? 0}/{creator.weeklyAssignmentLimit} questa giornata
                      {!creator.active ? " · disattivato" : ""}
                    </p>
                  </div>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <Select
                    value={creator.coverageRole}
                    onChange={(event) =>
                      void updateCreator(creator.id, {
                        coverageRole: event.target.value as CreatorCoverageRole,
                      })
                    }
                    disabled={updatingKey === `creator:${creator.id}`}
                  >
                    <option value="PHOTO" className="text-black">Foto</option>
                    <option value="VIDEO" className="text-black">Video</option>
                    <option value="BOTH" className="text-black">Foto + video</option>
                  </Select>
                  <Select
                    value={creator.weeklyAssignmentLimit}
                    onChange={(event) =>
                      void updateCreator(creator.id, {
                        weeklyAssignmentLimit: Number(event.target.value),
                      })
                    }
                    disabled={updatingKey === `creator:${creator.id}`}
                  >
                    {[1, 2, 3, 4, 5, 6].map((limit) => (
                      <option key={limit} value={limit} className="text-black">
                        Max {limit} {limit === 1 ? "partita" : "partite"}/settimana
                      </option>
                    ))}
                  </Select>
                </div>
                <Select
                  value={creator.preferredTeamId ?? ""}
                  onChange={(event) =>
                    void updateCreator(creator.id, {
                      preferredTeamId: event.target.value || null,
                    })
                  }
                  disabled={updatingKey === `creator:${creator.id}`}
                  className="mt-2 w-full"
                >
                  <option value="" className="text-black">
                    Nessuna squadra preferita
                  </option>
                  {board?.teams.map((team) => (
                    <option key={team.id} value={team.id} className="text-black">
                      {team.name}
                    </option>
                  ))}
                </Select>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-4">
          <div className="flex items-center gap-2">
            <CalendarDays size={16} className="text-[var(--accent)]" />
            <h3 className="text-sm font-black uppercase tracking-[0.14em] text-[var(--foreground)]">
              {selectedRound ? `Accoppiamenti · Giornata ${selectedRound}` : "Partite"}
            </h3>
          </div>

          {loading ? (
            <p className="mt-4 text-sm text-[var(--muted)]">Caricamento piano creator…</p>
          ) : matches.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--muted)]">
              Nessuna partita disponibile per questa giornata.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {matches.map((match) => {
                const row = draft[match.id] ?? {
                  photoCreatorId: "",
                  videoCreatorId: "",
                };
                const veo = isVeoMatch(match);
                const photoCreators = activeCreators.filter((creator) =>
                  canCover(creator, "PHOTO")
                );
                const videoCreators = activeCreators.filter((creator) =>
                  canCover(creator, "VIDEO")
                );

                return (
                  <article
                    key={match.id}
                    className="rounded-3xl border border-[var(--border)] bg-[var(--card-2)] p-4"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-sm font-black text-[var(--foreground)]">
                          {match.homeTeam.name}{" "}
                          <span className="text-[var(--muted)]">vs</span>{" "}
                          {match.awayTeam.name}
                        </p>
                        <p className="mt-1 text-xs font-bold text-[var(--muted)]">
                          {matchDateLabel(match)}
                        </p>
                      </div>
                      {veo && <Badge variant="success">VEO · video coperto</Badge>}
                    </div>

                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <label className="block">
                        <span className="mb-1.5 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-[var(--muted)]">
                          <Camera size={13} /> Fotografo
                        </span>
                        <Select
                          value={row.photoCreatorId}
                          onChange={(event) =>
                            setAssignment(match.id, "photoCreatorId", event.target.value)
                          }
                          className="w-full"
                        >
                          <option value="" className="text-black">Da assegnare</option>
                          {photoCreators.map((creator) => (
                            <option key={creator.id} value={creator.id} className="text-black">
                              {preferenceMatches(creator, match) ? "♥ " : ""}
                              {creator.displayName} · {usageByCreator.get(creator.id) ?? 0}/{creator.weeklyAssignmentLimit}
                            </option>
                          ))}
                        </Select>
                      </label>

                      <label className="block">
                        <span className="mb-1.5 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-[var(--muted)]">
                          <Video size={13} /> Video
                        </span>
                        {veo ? (
                          <div className="flex h-10 items-center rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 text-xs font-black text-[var(--muted)]">
                            VEO · nessun videomaker necessario
                          </div>
                        ) : (
                          <Select
                            value={row.videoCreatorId}
                            onChange={(event) =>
                              setAssignment(match.id, "videoCreatorId", event.target.value)
                            }
                            className="w-full"
                          >
                            <option value="" className="text-black">Da assegnare</option>
                            {videoCreators.map((creator) => (
                              <option key={creator.id} value={creator.id} className="text-black">
                                {preferenceMatches(creator, match) ? "♥ " : ""}
                                {creator.displayName} · {usageByCreator.get(creator.id) ?? 0}/{creator.weeklyAssignmentLimit}
                              </option>
                            ))}
                          </Select>
                        )}
                      </label>
                    </div>

                    {(!row.photoCreatorId || (!veo && !row.videoCreatorId)) && (
                      <p className="mt-3 flex items-center gap-1.5 text-xs font-bold text-amber-400">
                        <AlertTriangle size={13} /> Copertura incompleta
                      </p>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </Card>
  );
}

function CoverageStat({
  icon,
  label,
  value,
  note,
  warning = false,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  note: string;
  warning?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-2)] p-3">
      <div className="flex items-center gap-2 text-[var(--muted)]">
        {icon}
        <p className="text-[10px] font-black uppercase tracking-[0.14em]">{label}</p>
      </div>
      <p className={`mt-1 text-2xl font-black ${warning ? "text-amber-400" : "text-[var(--foreground)]"}`}>
        {value}
      </p>
      <p className="text-xs text-[var(--muted)]">{note}</p>
    </div>
  );
}
