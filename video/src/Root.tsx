import React from 'react';
import { Composition } from 'remotion';
import { RegelgevingShort, regelgevingSchema, SECONDS } from './RegelgevingShort';

export const RemotionRoot: React.FC = () => (
  <Composition
    id="RegelgevingShort"
    component={RegelgevingShort}
    schema={regelgevingSchema}
    fps={30}
    width={1080}
    height={1920}
    defaultProps={{
      kicker: 'Nieuwe regelgeving',
      titel: 'Mantelzorgwoning bouwen in 2026',
      scenes: [
        { kop: 'Wat verandert er?', tekst: 'Vanaf juli 2026 gelden nieuwe regels voor bouwen op eigen erf.' },
        { kop: 'Vergunningvrij?', tekst: 'Op het achtererf mag je onder voorwaarden bouwen zonder omgevingsvergunning.' },
        { kop: 'Let op', tekst: 'De familiewoning-regels zijn nog niet definitief — verwacht rond januari 2027.' },
      ],
      nogNietDefinitief: true,
      bron: 'Bron: DSO omgevingsplan / Kadaster',
      laatstBijgewerkt: 'jul 2026',
      cta: 'Doe de gratis erfcheck op opeigenerf.nl',
    }}
    calculateMetadata={({ props }) => {
      const total = SECONDS.intro + props.scenes.length * SECONDS.perScene + SECONDS.outro;
      return { durationInFrames: Math.round(total * 30) };
    }}
  />
);
