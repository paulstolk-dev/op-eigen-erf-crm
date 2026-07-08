import React from 'react';
import {
  AbsoluteFill, Img, Sequence, interpolate, spring, staticFile,
  useCurrentFrame, useVideoConfig, continueRender, delayRender,
} from 'remotion';
import { loadFont } from '@remotion/fonts';
import { z } from 'zod';
import { brand } from './brand';

// --- Carlito laden (metric-compatible met Calibri) ---
const fontHandle = delayRender('Carlito laden');
Promise.all([
  loadFont({ family: 'Carlito', url: staticFile('Carlito-Regular.ttf'), weight: '400' }),
  loadFont({ family: 'Carlito', url: staticFile('Carlito-Bold.ttf'), weight: '700' }),
]).then(() => continueRender(fontHandle)).catch(() => continueRender(fontHandle));

// --- Timings (gedeeld met Root voor duurberekening) ---
export const SECONDS = { intro: 2, perScene: 4.5, outro: 3 };

// --- Props-schema: dit is óók je contract met de generatie-stap ---
export const regelgevingSchema = z.object({
  kicker: z.string(),
  titel: z.string(),
  scenes: z.array(z.object({ kop: z.string(), tekst: z.string() })).min(1).max(4),
  nogNietDefinitief: z.boolean(),   // true → amber badge in beeld
  bron: z.string(),                 // verplicht, bijv. "Bron: DSO omgevingsplan / Kadaster"
  laatstBijgewerkt: z.string(),     // bijv. "jul 2026"
  cta: z.string(),
});
export type RegelgevingProps = z.infer<typeof regelgevingSchema>;

export const RegelgevingShort: React.FC<RegelgevingProps> = ({
  kicker, titel, scenes, nogNietDefinitief, bron, laatstBijgewerkt, cta,
}) => {
  const { fps } = useVideoConfig();
  const introF = Math.round(SECONDS.intro * fps);
  const sceneF = Math.round(SECONDS.perScene * fps);
  const outroF = Math.round(SECONDS.outro * fps);

  return (
    <AbsoluteFill style={{ backgroundColor: brand.navy, fontFamily: brand.font }}>
      <BackgroundAccent />
      <ProgressBar />
      <Img src={staticFile('oe-monogram.png')}
           style={{ position: 'absolute', bottom: 64, right: 64, width: 120, opacity: 0.55 }} />
      {nogNietDefinitief && <DisclaimerBadge />}

      <Sequence durationInFrames={introF}>
        <Intro kicker={kicker} titel={titel} />
      </Sequence>

      {scenes.map((s, i) => (
        <Sequence key={i} from={introF + i * sceneF} durationInFrames={sceneF}>
          <Scene index={i} kop={s.kop} tekst={s.tekst} />
        </Sequence>
      ))}

      <Sequence from={introF + scenes.length * sceneF} durationInFrames={outroF}>
        <Outro cta={cta} bron={bron} laatstBijgewerkt={laatstBijgewerkt} />
      </Sequence>
    </AbsoluteFill>
  );
};

// ---------- subcomponenten ----------

const Intro: React.FC<{ kicker: string; titel: string }> = ({ kicker, titel }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const e = spring({ frame, fps, config: { damping: 200 } });
  const y = interpolate(e, [0, 1], [40, 0]);
  return (
    <AbsoluteFill style={{ justifyContent: 'center', padding: 90 }}>
      <div style={{ opacity: e, transform: `translateY(${y}px)` }}>
        <div style={{ color: brand.sage, fontSize: 44, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase' }}>
          {kicker}
        </div>
        <div style={{ color: brand.white, fontSize: 96, fontWeight: 700, lineHeight: 1.05, marginTop: 24 }}>
          {titel}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Scene: React.FC<{ index: number; kop: string; tekst: string }> = ({ index, kop, tekst }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig(); // binnen Sequence = duur van deze scene
  const e = spring({ frame, fps, config: { damping: 200 } });
  const exit = interpolate(frame, [durationInFrames - 12, durationInFrames], [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const x = interpolate(e, [0, 1], [60, 0]);
  return (
    <AbsoluteFill style={{ justifyContent: 'center', padding: 90 }}>
      <div style={{ opacity: Math.min(e, exit), transform: `translateX(${x}px)` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 28 }}>
          <div style={{ width: 64, height: 64, borderRadius: 12, backgroundColor: brand.sage,
            color: brand.navy, fontSize: 40, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{index + 1}</div>
          <div style={{ color: brand.sage, fontSize: 52, fontWeight: 700 }}>{kop}</div>
        </div>
        <div style={{ color: brand.white, fontSize: 64, lineHeight: 1.25 }}>{tekst}</div>
      </div>
    </AbsoluteFill>
  );
};

const Outro: React.FC<{ cta: string; bron: string; laatstBijgewerkt: string }> =
  ({ cta, bron, laatstBijgewerkt }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const e = spring({ frame, fps, config: { damping: 200 } });
  const scale = interpolate(e, [0, 1], [0.9, 1]);
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', padding: 90, textAlign: 'center' }}>
      <Img src={staticFile('wordmark-wit.png')} style={{ width: 620, marginBottom: 48, opacity: e }} />
      <div style={{ opacity: e, transform: `scale(${scale})`, color: brand.white, fontSize: 64, fontWeight: 700, lineHeight: 1.15 }}>
        {cta}
      </div>
      <div style={{ position: 'absolute', bottom: 130, left: 90, right: 90, textAlign: 'center',
        color: 'rgba(255,255,255,0.6)', fontSize: 30 }}>
        {bron} · bijgewerkt {laatstBijgewerkt}
      </div>
    </AbsoluteFill>
  );
};

const ProgressBar: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig(); // top-level = hele video
  const w = interpolate(frame, [0, durationInFrames], [0, 100], { extrapolateRight: 'clamp' });
  return <div style={{ position: 'absolute', top: 0, left: 0, height: 10, width: `${w}%`, backgroundColor: brand.sage }} />;
};

const DisclaimerBadge: React.FC = () => (
  <div style={{ position: 'absolute', top: 60, left: 60, backgroundColor: brand.amber, color: brand.navy,
    padding: '14px 26px', borderRadius: 999, fontSize: 30, fontWeight: 700 }}>
    ⚠ Nog niet definitief
  </div>
);

const BackgroundAccent: React.FC = () => (
  <AbsoluteFill>
    <div style={{ position: 'absolute', top: -200, right: -200, width: 700, height: 700, borderRadius: '50%', backgroundColor: brand.sage, opacity: 0.08 }} />
    <div style={{ position: 'absolute', bottom: -300, left: -250, width: 800, height: 800, borderRadius: '50%', backgroundColor: brand.sage, opacity: 0.06 }} />
  </AbsoluteFill>
);
