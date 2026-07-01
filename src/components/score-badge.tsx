import { SCORE_STYLES, type ScoreLabel } from "@/lib/lead-score";

const LABEL_TEXT: Record<ScoreLabel, string> = {
  groen: "Groen",
  oranje: "Oranje",
  rood: "Rood",
};

export function ScoreBadge({
  score,
  label,
}: {
  score: number;
  label: ScoreLabel;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${SCORE_STYLES[label]}`}
    >
      {score} · {LABEL_TEXT[label]}
    </span>
  );
}
