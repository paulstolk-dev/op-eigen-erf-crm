import React from 'react';
import {
  AbsoluteFill, Img, Sequence, Series, Loop, OffthreadVideo,
  interpolate, spring, staticFile,
  useCurrentFrame, useVideoConfig, continueRender, delayRender,
} from 'remotion';
import { loadFont } from '@remotion/fonts';
import { z } from 'zod';
import { settingsSchema, defaultSettings, type VideoSettings } from './settings';

// --- Carlito laden (metric-compatible met Calibri) ---
const fontHandle = delayRender('Carlito laden');
Promise.all([
  loadFont({ family: 'Carlito', url: staticFile('Carlito-Regular.ttf'), weight: '400' }),
  loadFont({ family: 'Carlito', url: staticFile('Carlito-Bold.ttf'), weight: '700' }),
]).then(() => continueRender(fontHandle)).catch(() => continueRender(fontHandle));

const FONT = 'Carlito, Calibri, sans-serif';
const AMBER = '#C98A2B';

// --- Props-schema (settings optioneel; render-core merget ze in) ---
export const regelgevingSchema = z.object({
  kicker: z.string(),
  titel: z.string(),
  scenes: z.array(z.object({ kop: z.string(), tekst: z.string() })).min(1).max(4),
  nogNietDefinitief: z.boolean(),
  bron: z.string(),
  laatstBijgewerkt: z.string(),
  cta: z.string(),
  settings: settingsSchema.optional(),
  // Optionele Veo-beeldlaag: publieke URLs van de b-roll-clips. Leeg = de
  // klassieke egale achtergrond (bestaand gedrag).
  broll: z.array(z.string()).optional(),
  brollSeconds: z.number().optional(),
});
export type RegelgevingProps = z.infer<typeof regelgevingSchema>;

// Metadata (afmeting/fps/duur) uit de settings + het aantal scenes.
export function computeMeta(props: RegelgevingProps) {
  const s: VideoSettings = { ...defaultSettings, ...(props.settings ?? {}) };
  const scenes = props.scenes?.length ?? 1;
  const total = s.intro + scenes * s.perScene + s.outro;
  return {
    width: s.width,
    height: s.height,
    fps: s.fps,
    durationInFrames: Math.max(1, Math.round(total * s.fps)),
  };
}

export const RegelgevingShort: React.FC<RegelgevingProps> = (props) => {
  const s: VideoSettings = { ...defaultSettings, ...(props.settings ?? {}) };
  const { kicker, titel, scenes, nogNietDefinitief, bron, laatstBijgewerkt, cta, broll } = props;
  const { fps } = useVideoConfig();
  const introF = Math.round(s.intro * fps);
  const sceneF = Math.round(s.perScene * fps);
  const outroF = Math.round(s.outro * fps);
  const overBroll = Boolean(broll && broll.length > 0);

  return (
    <AbsoluteFill style={{ backgroundColor: overBroll ? '#1c1a16' : s.bg, fontFamily: FONT }}>
      {overBroll && <BrollLaag urls={broll!} seconds={props.brollSeconds ?? 8} />}
      <ProgressBar accent={s.accent} />
      <Logo s={s} />
      {nogNietDefinitief && <DisclaimerBadge />}

      <Sequence durationInFrames={introF}>
        <Intro kicker={kicker} titel={titel} s={s} overBroll={overBroll} />
      </Sequence>

      {scenes.map((sc, i) => (
        <Sequence key={i} from={introF + i * sceneF} durationInFrames={sceneF}>
          <Scene index={i} kop={sc.kop} tekst={sc.tekst} s={s} />
        </Sequence>
      ))}

      <Sequence from={introF + scenes.length * sceneF} durationInFrames={outroF}>
        <Outro cta={cta} bron={bron} laatstBijgewerkt={laatstBijgewerkt} s={s} />
      </Sequence>
    </AbsoluteFill>
  );
};

// ---------- subcomponenten ----------

// Veo-beeldlaag: 3 clips achter elkaar (Series), geloopt over de hele duur, met
// een donkere scrim zodat de tekst/cards leesbaar blijven.
const BrollLaag: React.FC<{ urls: string[]; seconds: number }> = ({ urls, seconds }) => {
  const { fps, durationInFrames } = useVideoConfig();
  const clipF = Math.max(1, Math.round(seconds * fps));
  return (
    <AbsoluteFill>
      <Loop durationInFrames={durationInFrames}>
        <Series>
          {urls.map((url, i) => (
            <Series.Sequence key={i} durationInFrames={clipF}>
              <OffthreadVideo
                src={url}
                muted
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </Series.Sequence>
          ))}
        </Series>
      </Loop>
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(180deg, rgba(20,18,14,0.42), rgba(20,18,14,0.18) 38%, rgba(20,18,14,0.42))',
        }}
      />
    </AbsoluteFill>
  );
};

const Intro: React.FC<{ kicker: string; titel: string; s: VideoSettings; overBroll: boolean }> = ({ kicker, titel, s, overBroll }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const e = spring({ frame, fps, config: { damping: 200 } }); // rustig, geen overshoot
  const y = interpolate(e, [0, 1], [24, 0]);
  const titelKleur = overBroll ? '#ffffff' : s.text;
  const schaduw = overBroll ? '0 2px 18px rgba(0,0,0,0.55)' : 'none';
  return (
    <AbsoluteFill style={{ justifyContent: 'center', padding: 96 }}>
      <div style={{ opacity: e, transform: `translateY(${y}px)`, textShadow: schaduw }}>
        <div style={{ color: overBroll ? '#efe4cf' : s.accent, fontSize: 42, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase' }}>
          {kicker}
        </div>
        <div style={{ color: titelKleur, fontSize: 92, fontWeight: 700, lineHeight: 1.06, marginTop: 22 }}>
          {titel}
        </div>
        <div style={{ marginTop: 28, width: 120, height: 8, borderRadius: 999, backgroundColor: s.accent }} />
      </div>
    </AbsoluteFill>
  );
};

const Scene: React.FC<{ index: number; kop: string; tekst: string; s: VideoSettings }> = ({ index, kop, tekst, s }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const e = spring({ frame, fps, config: { damping: 200 } });
  const exit = interpolate(frame, [durationInFrames - 14, durationInFrames], [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const y = interpolate(e, [0, 1], [28, 0]); // subtiele opkomst, geen slide
  return (
    <AbsoluteFill style={{ justifyContent: 'center', padding: 72 }}>
      <div
        style={{
          opacity: Math.min(e, exit),
          transform: `translateY(${y}px)`,
          backgroundColor: s.card,
          borderRadius: s.radius,
          padding: 64,
          boxShadow: '0 24px 60px rgba(0,0,0,0.06)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 22, marginBottom: 30 }}>
          <div style={{
            width: 68, height: 68, borderRadius: 18, backgroundColor: s.accent,
            color: '#fff', fontSize: 40, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{index + 1}</div>
          <div style={{ color: s.accent, fontSize: 50, fontWeight: 700 }}>{kop}</div>
        </div>
        <div style={{ color: s.text, fontSize: 60, lineHeight: 1.28 }}>{tekst}</div>
      </div>
    </AbsoluteFill>
  );
};

const Outro: React.FC<{ cta: string; bron: string; laatstBijgewerkt: string; s: VideoSettings }> =
  ({ cta, bron, laatstBijgewerkt, s }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const e = spring({ frame, fps, config: { damping: 200 } });
  const y = interpolate(e, [0, 1], [24, 0]);
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', padding: 96, textAlign: 'center' }}>
      <div
        style={{
          opacity: e,
          transform: `translateY(${y}px)`,
          backgroundColor: s.card,
          borderRadius: s.radius,
          padding: 72,
          maxWidth: 900,
          boxShadow: '0 24px 60px rgba(0,0,0,0.06)',
        }}
      >
        {s.logoUrl ? (
          <Img
            src={s.logoUrl}
            style={{
              maxHeight: Math.round(s.logoSize * 1.4),
              maxWidth: Math.round(s.width * 0.62),
              marginBottom: 40,
              objectFit: 'contain',
            }}
          />
        ) : null}
        <div style={{ color: s.text, fontSize: 62, fontWeight: 700, lineHeight: 1.15 }}>{cta}</div>
        <div style={{ marginTop: 28, color: s.accent, fontSize: 28, fontWeight: 700 }}>
          {bron} · bijgewerkt {laatstBijgewerkt}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const ProgressBar: React.FC<{ accent: string }> = ({ accent }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const w = interpolate(frame, [0, durationInFrames], [0, 100], { extrapolateRight: 'clamp' });
  return <div style={{ position: 'absolute', top: 0, left: 0, height: 8, width: `${w}%`, backgroundColor: accent }} />;
};

const Logo: React.FC<{ s: VideoSettings }> = ({ s }) => {
  if (!s.logoUrl) return null;
  const pos: React.CSSProperties =
    s.logoPosition === 'linksboven'
      ? { top: 64, left: 64 }
      : { bottom: 64, right: 64 };
  return (
    <Img
      src={s.logoUrl}
      style={{
        position: 'absolute',
        ...pos,
        maxHeight: s.logoSize,
        maxWidth: Math.round(s.width * 0.42), // nooit buiten beeld (brede wordmark)
        objectFit: 'contain',
        opacity: 0.9,
      }}
    />
  );
};

const DisclaimerBadge: React.FC = () => (
  <div style={{ position: 'absolute', top: 64, left: '50%', transform: 'translateX(-50%)',
    backgroundColor: AMBER, color: '#fff', padding: '14px 28px', borderRadius: 999, fontSize: 30, fontWeight: 700 }}>
    ⚠ Nog niet definitief
  </div>
);
