"use client";

// OpEigenErf — Nurture-overzicht. Leest de echte meetlaag (nurture_flow_overview):
// twee flows — Erfcheck-opvolging en Aanbieder-werving. Open-ratio is bewust geen
// stuurmetric (Apple/Gmail prefetchen de pixel); CTR staat op bezorgd.

export type FlowRow = {
  stroom: string;
  naam: string;
  doel: string;
  waarde_per_conversie: number | null;
  enrolled: number;
  verzonden: number;
  bezorgd: number;
  geopend: number;
  geklikt: number;
  afgemeld: number;
  gebounced: number;
  geconverteerd: number;
};

const C = {
  navy: "#0C1C30", navy2: "#26384B", sage: "#6A8463", sageDeep: "#4E6349",
  paper: "#FBFBF9", card: "#FFFFFF", line: "#E7E9E6", muted: "#8A94A0", mutedInk: "#5C6470",
  fSent: "#C9D2DC", fDeliver: "#6E8196", fOpen: "#AEB6AC", fClick: "#6A8463", fConv: "#0C1C30",
};
const MIN_N = 30;

const nf = new Intl.NumberFormat("nl-NL");
const eur = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const pct = (x: number | null) =>
  x == null ? "—" : (x * 100).toLocaleString("nl-NL", { maximumFractionDigits: 1 }) + "%";

function computeFlow(f: FlowRow) {
  const ctr = f.bezorgd ? f.geklikt / f.bezorgd : null;
  const openR = f.bezorgd ? f.geopend / f.bezorgd : null;
  const conv = f.enrolled ? f.geconverteerd / f.enrolled : null;
  const waarde = f.waarde_per_conversie == null ? null : f.geconverteerd * f.waarde_per_conversie;
  const betrouwbaar = f.enrolled >= MIN_N;
  return { ...f, ctr, openR, conv, waarde, betrouwbaar };
}
type Computed = ReturnType<typeof computeFlow>;

export function NurtureDashboard({ rows }: { rows: FlowRow[] }) {
  const flows = rows.map(computeFlow);
  const leeg = flows.every((f) => f.verzonden === 0);

  const sum = (k: keyof FlowRow) => flows.reduce((a, f) => a + Number(f[k] ?? 0), 0);
  const totaal = {
    enrolled: sum("enrolled"),
    bezorgd: sum("bezorgd"),
    geklikt: sum("geklikt"),
    geconverteerd: sum("geconverteerd"),
    afgemeld: sum("afgemeld"),
    waarde: flows.reduce((a, f) => a + (f.waarde || 0), 0),
    ctr: sum("bezorgd") ? sum("geklikt") / sum("bezorgd") : null,
    conv: sum("enrolled") ? sum("geconverteerd") / sum("enrolled") : null,
  };

  const metWaarde = flows.filter((f) => f.waarde != null && (f.waarde as number) > 0) as Computed[];
  const maxWaarde = Math.max(1, ...metWaarde.map((f) => f.waarde as number));

  return (
    <div className="oe-root">
      <style>{css}</style>

      <header className="oe-header">
        <div className="oe-brand">
          <div className="oe-mono" aria-hidden="true">OE</div>
          <div>
            <h1 className="oe-title">Nurture-overzicht</h1>
            <p className="oe-sub">E-mailflows · meetlaag (Resend) · sinds start meten</p>
          </div>
        </div>
        <div className="oe-watermark" aria-hidden="true">OE</div>
      </header>

      {leeg ? (
        <div className="oe-empty">
          <div className="oe-empty-title">Nog geen gemeten verzendingen</div>
          <p className="oe-empty-txt">
            Zodra er nurture-mails uitgaan (Erfcheck-opvolging of Aanbieder-werving) en de
            Resend-webhook events levert, vullen hier de cijfers per flow — bezorgd, geklikt,
            bounces en conversie.
          </p>
        </div>
      ) : (
        <>
          <section className="oe-section">
            <div className="oe-eyebrow">Totaal · beide flows</div>
            <div className="oe-total-grid">
              <div className="oe-hero-card">
                <span className="oe-hero-label">Toegewezen pipeline-waarde uit nurture</span>
                <span className="oe-hero-value">{eur.format(totaal.waarde)}</span>
                <span className="oe-hero-foot">
                  Laatste-touch · indicatief · {nf.format(totaal.geconverteerd)} conversies
                </span>
              </div>
              <div className="oe-kpi-grid">
                <Kpi label="In flow" value={nf.format(totaal.enrolled)} />
                <Kpi label="Bezorgd" value={nf.format(totaal.bezorgd)} />
                <Kpi label="Klik-ratio" hint="clicks ÷ bezorgd" value={pct(totaal.ctr)} accent />
                <Kpi label="Geklikt" value={nf.format(totaal.geklikt)} />
                <Kpi label="Conversie" value={pct(totaal.conv)} />
                <Kpi label="Afgemeld" value={nf.format(totaal.afgemeld)} subtle />
              </div>
            </div>
            <div className="oe-note">
              <InfoIcon />
              <span>
                Open-ratio is bewust geen stuurmetric: Apple Mail Privacy en Gmail's image-proxy
                laden de tracking-pixel vooraf, dus &quot;opens&quot; tellen mee die geen mens
                triggerde. Stuur op <strong>clicks</strong> en replies.
              </span>
            </div>
          </section>

          {metWaarde.length > 0 && (
            <section className="oe-section">
              <div className="oe-eyebrow">Pipeline-waarde per flow</div>
              <div className="oe-chart">
                {metWaarde.map((f) => (
                  <div className="oe-wbar-row" key={f.stroom}>
                    <span className="oe-wbar-label">{f.naam}</span>
                    <div className="oe-wbar-track">
                      <div
                        className="oe-wbar-fill"
                        style={{
                          width: `${Math.max(((f.waarde as number) / maxWaarde) * 100, 6)}%`,
                          background: f.betrouwbaar ? C.sage : C.fSent,
                        }}
                      >
                        {eur.format(f.waarde as number)}
                      </div>
                    </div>
                  </div>
                ))}
                <p className="oe-chart-foot">
                  Gedempte staven markeren flows met te weinig volume (n&nbsp;&lt;&nbsp;{MIN_N}) voor
                  een betrouwbare ratio.
                </p>
              </div>
            </section>
          )}

          <section className="oe-section">
            <div className="oe-eyebrow">Per flow</div>
            <div className="oe-flows">
              {flows.map((f) => (
                <FlowCard key={f.stroom} f={f} />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, hint, accent, subtle }: { label: string; value: string; hint?: string; accent?: boolean; subtle?: boolean }) {
  return (
    <div className="oe-kpi">
      <span className="oe-kpi-label">{label}{hint ? <span className="oe-kpi-hint"> · {hint}</span> : null}</span>
      <span className="oe-kpi-value" style={{ color: accent ? C.sageDeep : subtle ? C.mutedInk : C.navy }}>{value}</span>
    </div>
  );
}

function FlowCard({ f }: { f: Computed }) {
  const max = f.verzonden || 1;
  const stages = [
    { label: "Verzonden", n: f.verzonden, color: C.fSent, ink: C.navy },
    { label: "Bezorgd", n: f.bezorgd, color: C.fDeliver, ink: "#fff" },
    { label: "Geopend", n: f.geopend, color: C.fOpen, ink: C.navy, soft: true },
    { label: "Geklikt", n: f.geklikt, color: C.fClick, ink: "#fff" },
    { label: "Geconverteerd", n: f.geconverteerd, color: C.fConv, ink: "#fff" },
  ];
  return (
    <article className="oe-flow">
      <div className="oe-flow-head">
        <div className="oe-flow-name">
          <span>{f.naam}</span>
          <span className="oe-doel">{f.doel}</span>
        </div>
        <span className={"oe-badge" + (f.betrouwbaar ? " ok" : " low")}>
          <span className="oe-dot" aria-hidden="true" />
          {f.betrouwbaar ? `n = ${f.enrolled}` : `n = ${f.enrolled} · te mager`}
        </span>
      </div>
      <div className="oe-flow-body">
        <div className="oe-funnel">
          {stages.map((s) => {
            const w = Math.max((s.n / max) * 100, 3);
            return (
              <div className="oe-funnel-row" key={s.label}>
                <span className="oe-funnel-label">{s.label}{s.soft ? <span className="oe-soft"> ~</span> : null}</span>
                <div className="oe-funnel-track">
                  <div className="oe-funnel-fill" style={{ width: w + "%", background: s.color }}>
                    <span className="oe-funnel-inline" style={{ color: s.ink }}>{nf.format(s.n)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="oe-flow-stats">
          <Stat label="Klik-ratio" value={pct(f.ctr)} reliable={f.betrouwbaar} strong />
          <Stat label="Conversie" value={pct(f.conv)} reliable={f.betrouwbaar} />
          <Stat label="Bounces" value={nf.format(f.gebounced)} reliable muted={f.gebounced === 0} />
          <Stat label="Waarde" value={f.waarde == null ? "n.v.t." : eur.format(f.waarde)} reliable muted={f.waarde == null} />
        </div>
      </div>
    </article>
  );
}

function Stat({ label, value, reliable, strong, muted }: { label: string; value: string; reliable: boolean; strong?: boolean; muted?: boolean }) {
  const color = muted ? C.muted : !reliable ? C.muted : strong ? C.sageDeep : C.navy;
  return (
    <div className="oe-stat">
      <span className="oe-stat-label">{label}</span>
      <span className="oe-stat-value" style={{ color }}>
        {value}{!reliable && !muted ? <span className="oe-flag" title="statistisch te mager"> ⚑</span> : null}
      </span>
    </div>
  );
}

function InfoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.sage} strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" strokeLinecap="round" />
    </svg>
  );
}

const css = `
.oe-root{color:${C.navy};}
.oe-root *{box-sizing:border-box;}
.oe-header{position:relative;display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;background:${C.navy};border-radius:16px;padding:20px 26px;overflow:hidden;color:#fff;}
.oe-brand{display:flex;align-items:center;gap:14px;z-index:1;}
.oe-mono{width:44px;height:44px;flex:none;border:1.5px solid ${C.sage};border-radius:11px;display:flex;align-items:center;justify-content:center;font-weight:700;letter-spacing:1px;color:#fff;font-size:16px;}
.oe-title{margin:0;font-size:22px;font-weight:700;letter-spacing:-.2px;line-height:1.1;}
.oe-sub{margin:3px 0 0;font-size:13px;color:#B7C1CC;}
.oe-watermark{position:absolute;right:-14px;bottom:-38px;font-size:150px;font-weight:800;letter-spacing:-6px;color:rgba(106,132,99,.12);line-height:1;user-select:none;z-index:0;}
.oe-section{margin-top:24px;}
.oe-eyebrow{font-size:11.5px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:${C.sageDeep};margin-bottom:12px;}
.oe-total-grid{display:grid;grid-template-columns:minmax(260px,1fr) 2fr;gap:16px;}
.oe-hero-card{background:linear-gradient(160deg,${C.navy},${C.navy2});color:#fff;border-radius:14px;padding:22px 24px;display:flex;flex-direction:column;justify-content:center;gap:8px;}
.oe-hero-label{font-size:13px;color:#B7C1CC;}
.oe-hero-value{font-size:36px;font-weight:750;letter-spacing:-1px;font-variant-numeric:tabular-nums;}
.oe-hero-foot{font-size:12px;color:#94A0AC;}
.oe-kpi-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;}
.oe-kpi{background:${C.card};border:1px solid ${C.line};border-radius:12px;padding:14px 16px;display:flex;flex-direction:column;gap:6px;}
.oe-kpi-label{font-size:12px;color:${C.mutedInk};}
.oe-kpi-hint{color:${C.muted};font-size:11px;}
.oe-kpi-value{font-size:24px;font-weight:700;letter-spacing:-.3px;font-variant-numeric:tabular-nums;}
.oe-note{display:flex;gap:9px;align-items:flex-start;margin-top:14px;padding:11px 14px;background:#F1F4F0;border:1px solid ${C.line};border-radius:10px;font-size:12.5px;color:${C.mutedInk};line-height:1.5;}
.oe-note svg{flex:none;margin-top:2px;}
.oe-note strong{color:${C.navy};}
.oe-chart{background:${C.card};border:1px solid ${C.line};border-radius:14px;padding:16px 18px;display:flex;flex-direction:column;gap:10px;}
.oe-wbar-row{display:flex;align-items:center;gap:14px;}
.oe-wbar-label{width:150px;flex:none;font-size:13px;color:${C.mutedInk};}
.oe-wbar-track{flex:1;background:#F3F4F2;border-radius:7px;overflow:hidden;height:30px;}
.oe-wbar-fill{height:100%;border-radius:7px;display:flex;align-items:center;justify-content:flex-end;padding:0 10px;color:#fff;font-size:12.5px;font-weight:700;font-variant-numeric:tabular-nums;min-width:60px;}
.oe-chart-foot{font-size:11.5px;color:${C.muted};margin:2px 0 0;}
.oe-flows{display:flex;flex-direction:column;gap:12px;}
.oe-flow{background:${C.card};border:1px solid ${C.line};border-radius:14px;padding:18px 20px;}
.oe-flow-head{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:14px;}
.oe-flow-name{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;}
.oe-flow-name>span:first-child{font-size:16px;font-weight:700;}
.oe-doel{font-size:11px;color:${C.sageDeep};background:#EAEFE7;padding:3px 9px;border-radius:20px;font-weight:600;}
.oe-badge{display:inline-flex;align-items:center;gap:7px;font-size:11.5px;font-weight:600;padding:5px 11px;border-radius:20px;white-space:nowrap;}
.oe-badge .oe-dot{width:7px;height:7px;border-radius:50%;}
.oe-badge.ok{background:#EAEFE7;color:${C.sageDeep};}
.oe-badge.ok .oe-dot{background:${C.sage};}
.oe-badge.low{background:#F0F1F2;color:${C.mutedInk};}
.oe-badge.low .oe-dot{background:${C.muted};}
.oe-flow-body{display:grid;grid-template-columns:1fr 240px;gap:24px;align-items:center;}
.oe-funnel{display:flex;flex-direction:column;gap:7px;}
.oe-funnel-row{display:flex;align-items:center;gap:12px;}
.oe-funnel-label{width:110px;flex:none;font-size:12px;color:${C.mutedInk};text-align:right;}
.oe-soft{color:${C.muted};}
.oe-funnel-track{flex:1;background:#F3F4F2;border-radius:6px;overflow:hidden;height:22px;}
.oe-funnel-fill{height:100%;border-radius:6px;display:flex;align-items:center;justify-content:flex-end;padding:0 8px;min-width:34px;}
.oe-funnel-inline{font-size:11.5px;font-weight:700;font-variant-numeric:tabular-nums;}
.oe-flow-stats{display:flex;flex-direction:column;gap:9px;border-left:1px solid ${C.line};padding-left:22px;}
.oe-stat{display:flex;justify-content:space-between;align-items:baseline;gap:10px;}
.oe-stat-label{font-size:12.5px;color:${C.mutedInk};}
.oe-stat-value{font-size:17px;font-weight:700;font-variant-numeric:tabular-nums;letter-spacing:-.2px;}
.oe-flag{color:${C.muted};font-size:13px;}
.oe-empty{margin-top:24px;background:${C.card};border:1px solid ${C.line};border-radius:14px;padding:44px 32px;text-align:center;}
.oe-empty-title{font-size:17px;font-weight:700;margin-bottom:8px;}
.oe-empty-txt{font-size:13.5px;color:${C.mutedInk};max-width:480px;margin:0 auto;line-height:1.6;}
@media (max-width:820px){
  .oe-total-grid{grid-template-columns:1fr;}
  .oe-kpi-grid{grid-template-columns:repeat(2,1fr);}
  .oe-flow-body{grid-template-columns:1fr;gap:16px;}
  .oe-flow-stats{border-left:0;border-top:1px solid ${C.line};padding-left:0;padding-top:14px;flex-direction:row;justify-content:space-between;flex-wrap:wrap;}
  .oe-wbar-label{width:110px;}
}
`;
