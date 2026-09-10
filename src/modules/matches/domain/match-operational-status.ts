import { FUTPOLI_RULES } from "../../players/domain/tournament-rules.ts";

export type MatchOperationalStatus =
  | "NEEDS_SETUP"
  | "BOOKED"
  | "READY"
  | "AWAITING_RESULT"
  | "DRAFT_RESULT"
  | "POSTPONED"
  | "CANCELLED"
  | "COMPLETED"
  | "ISSUE";

export type MatchOperationalIssueCode =
  | "NO_SLOT"
  | "NO_FIELD"
  | "NO_REFEREE"
  | "REFEREE_CONFLICT"
  | "HOME_SHEET_INCOMPLETE"
  | "AWAY_SHEET_INCOMPLETE"
  | "RESULT_OVERDUE"
  | "DRAFT_RESULT"
  | "POSTPONED";

export type MatchOperationalIssue = {
  code: MatchOperationalIssueCode;
  label: string;
  severity: "warning" | "error";
};

export type MatchOperationalInput = {
  date: Date | null;
  venueKey?: string | null;
  refereeId?: string | null;
  homeGoals?: number | null;
  awayGoals?: number | null;
  homeSheetCount?: number;
  awaySheetCount?: number;
  refereeConflict?: boolean;
  now?: Date;
  sheetAttentionHours?: number;
  resultStatus?: "DRAFT" | "FINAL" | null;
  lifecycleStatus?: "SCHEDULED" | "POSTPONED" | "CANCELLED";
};

export type MatchOperationalState = {
  status: MatchOperationalStatus;
  issues: MatchOperationalIssue[];
  completed: boolean;
  scheduled: boolean;
  ready: boolean;
};

const LABELS: Record<MatchOperationalIssueCode, string> = {
  NO_SLOT: "Data e slot da definire",
  NO_FIELD: "Campo non assegnato",
  NO_REFEREE: "Arbitro non assegnato",
  REFEREE_CONFLICT: "Arbitro con conflitto o indisponibilità",
  HOME_SHEET_INCOMPLETE: `Distinta casa sotto ${FUTPOLI_RULES.minPlayersInMatchSheet}`,
  AWAY_SHEET_INCOMPLETE: `Distinta ospite sotto ${FUTPOLI_RULES.minPlayersInMatchSheet}`,
  RESULT_OVERDUE: "Partita passata senza risultato",
  DRAFT_RESULT: "Risultato salvato in bozza",
  POSTPONED: "Partita rinviata da riprogrammare",
};

function issue(code: MatchOperationalIssueCode, severity: "warning" | "error" = "warning") {
  return { code, label: LABELS[code], severity } satisfies MatchOperationalIssue;
}

export function deriveMatchOperationalState(input: MatchOperationalInput): MatchOperationalState {
  const now = input.now ?? new Date();
  const homeGoals = input.homeGoals ?? null;
  const awayGoals = input.awayGoals ?? null;
  const completed = input.resultStatus === "FINAL" && homeGoals !== null && awayGoals !== null;
  const scheduled = Boolean(input.date);

  if (input.lifecycleStatus === "CANCELLED") {
    return { status: "CANCELLED", issues: [], completed: false, scheduled: false, ready: false };
  }
  if (input.lifecycleStatus === "POSTPONED") {
    return { status: "POSTPONED", issues: [issue("POSTPONED")], completed: false, scheduled: false, ready: false };
  }
  if (completed) {
    return { status: "COMPLETED", issues: [], completed: true, scheduled, ready: true };
  }

  const issues: MatchOperationalIssue[] = [];
  if (input.resultStatus === "DRAFT") issues.push(issue("DRAFT_RESULT"));
  const date = input.date;

  if (!date) {
    issues.push(issue("NO_SLOT"));
  } else {
    if (!input.venueKey) issues.push(issue("NO_FIELD"));
    if (!input.refereeId) issues.push(issue("NO_REFEREE"));
    if (input.refereeConflict) issues.push(issue("REFEREE_CONFLICT", "error"));

    const timestamp = date.getTime();
    if (!Number.isNaN(timestamp)) {
      if (timestamp < now.getTime()) {
        issues.push(issue("RESULT_OVERDUE", "error"));
      } else {
        const attentionHours = Math.max(0, input.sheetAttentionHours ?? 6);
        const sheetAttentionAt = timestamp - attentionHours * 60 * 60_000;
        if (now.getTime() >= sheetAttentionAt) {
          if ((input.homeSheetCount ?? 0) < FUTPOLI_RULES.minPlayersInMatchSheet) {
            issues.push(issue("HOME_SHEET_INCOMPLETE"));
          }
          if ((input.awaySheetCount ?? 0) < FUTPOLI_RULES.minPlayersInMatchSheet) {
            issues.push(issue("AWAY_SHEET_INCOMPLETE"));
          }
        }
      }
    }
  }

  const ready = Boolean(
    date &&
      input.venueKey &&
      input.refereeId &&
      !input.refereeConflict &&
      (input.homeSheetCount ?? 0) >= FUTPOLI_RULES.minPlayersInMatchSheet &&
      (input.awaySheetCount ?? 0) >= FUTPOLI_RULES.minPlayersInMatchSheet
  );

  if (input.resultStatus === "DRAFT") {
    return { status: "DRAFT_RESULT", issues, completed: false, scheduled, ready: false };
  }

  if (issues.some((item) => item.code === "RESULT_OVERDUE")) {
    return { status: "AWAITING_RESULT", issues, completed: false, scheduled, ready: false };
  }

  if (issues.some((item) => item.severity === "error")) {
    return { status: "ISSUE", issues, completed: false, scheduled, ready: false };
  }

  if (!date || !input.venueKey) {
    return { status: "NEEDS_SETUP", issues, completed: false, scheduled, ready: false };
  }

  if (ready) {
    return { status: "READY", issues, completed: false, scheduled, ready: true };
  }

  return { status: "BOOKED", issues, completed: false, scheduled, ready: false };
}
