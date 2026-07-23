// Gedeelde regel voor "de volgende stap in de opvolg-flow".
//
// De reeks gaat NOOIT terug: stappen met een volgorde <= de hoogst al verzonden
// stap tellen niet meer mee. Zonder die bewaking wordt een later (her)geactiveerde
// stap ineens "de volgende" voor leads die de flow al doorlopen hebben — en zou
// runNurture die oude leads alsnog mailen (bv. E1 ná E4).

export type FlowStapBasis = { id: string; volgorde: number };

/** Hoogste volgorde die deze lead al ontvangen heeft; -1 = nog niets. */
export function hoogsteVerzondenVolgorde(
  alleStappen: FlowStapBasis[],
  verzondenStepIds: ReadonlySet<string>,
): number {
  let hoogste = -1;
  for (const s of alleStappen) {
    if (verzondenStepIds.has(s.id) && s.volgorde > hoogste) hoogste = s.volgorde;
  }
  return hoogste;
}

/**
 * Eerstvolgende actieve stap ná wat de lead al kreeg; null = flow afgerond.
 * `alleStappen` bevat óók inactieve stappen, zodat een verzending van een
 * inmiddels uitgezette stap net zo goed meetelt voor de positie in de flow.
 */
export function volgendeStap<T extends FlowStapBasis>(
  actieveStappen: T[],
  alleStappen: FlowStapBasis[],
  verzondenStepIds: ReadonlySet<string>,
): T | null {
  const hoogste = hoogsteVerzondenVolgorde(alleStappen, verzondenStepIds);
  return (
    actieveStappen.find(
      (s) => s.volgorde > hoogste && !verzondenStepIds.has(s.id),
    ) ?? null
  );
}
