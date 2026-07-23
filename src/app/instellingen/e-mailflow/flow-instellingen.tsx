"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { NurtureFlow } from "@/lib/settings";
import { saveFlowSettings, saveStep, addStep, deleteStep, reorderStep } from "./actions";
import { PitchEditor } from "@/app/aanbieders/partners/pitch-editor";

type PitchStep = { subject: string; body: string; ctaLabel: string; ctaUrl: string };
export type PartnerData = {
  step1: PitchStep;
  step2: PitchStep;
  step3: PitchStep;
  delay2: number;
  delay3: number;
};
export type PartnerMetric = {
  stap: string;
  verzonden: number;
  bezorgd: number;
  geklikt: number;
  gebounced: number;
  ctr_pct: number | null;
};

// Volledige stap-vorm (email_sequence_steps + send_condition uit migratie 0031).
type Step = {
  id: string;
  sleutel: string;
  volgorde: number;
  dag_na_start: number;
  onderwerp: string;
  preview: string | null;
  body: string;
  cta_primary_label: string | null;
  cta_primary_url: string | null;
  cta_secondary_label: string | null;
  cta_secondary_url: string | null;
  actief: boolean;
  send_condition: string;
};

const LEAD_GROEPEN = [
  { key: "erfcheck", naam: "Erfcheck-lead", status: "actief", meta: "opvolgflow" },
  { key: "aanbieders", naam: "Aanbieder-werving", status: "actief", meta: "3-mail wervingssequence" },
  { key: "modelofferte", naam: "Modelofferte-lead", status: "doorstuur", meta: "Directe doorstuur — geen nurture" },
  { key: "mijn_erfplan", naam: "Mijn Erfplan", status: "leeg", meta: "Nog niet ingesteld" },
  { key: "tuinkantoor", naam: "Tuinkantoor-ZZP", status: "leeg", meta: "Nog niet ingesteld" },
  { key: "not_answered", naam: "Niet opgenomen", status: "uitgesloten", meta: "Uitgesloten — negatief signaal" },
];

const CONDITIES: [string, string][] = [
  ["altijd", "Altijd versturen"],
  ["niet_geconverteerd", "Alleen als scan nog niet geboekt"],
  ["niet_geklikt_vorige", "Alleen als vorige niet geklikt"],
];

const DAG_KEYS: (keyof NurtureFlow["dagen"])[] = ["ma", "di", "wo", "do", "vr", "za", "zo"];

export function FlowInstellingen({
  steps,
  flow,
  partner,
  partnerMetrics,
  initialGroep,
}: {
  steps: Step[];
  flow: NurtureFlow;
  partner: PartnerData;
  partnerMetrics: PartnerMetric[];
  initialGroep?: string;
}) {
  const router = useRouter();
  const [groep, setGroep] = useState(
    LEAD_GROEPEN.some((g) => g.key === initialGroep) ? (initialGroep as string) : "erfcheck",
  );
  const [f, setF] = useState<NurtureFlow>(flow);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isSaving, startSave] = useTransition();
  const [isStruct, startStruct] = useTransition();

  const upd = <K extends keyof NurtureFlow>(k: K, v: NurtureFlow[K]) => {
    setF((p) => ({ ...p, [k]: v }));
    setDirty(true);
    setSaved(false);
  };
  const toggleDag = (d: keyof NurtureFlow["dagen"]) => {
    setF((p) => ({ ...p, dagen: { ...p.dagen, [d]: !p.dagen[d] } }));
    setDirty(true);
    setSaved(false);
  };

  function saveFlow() {
    startSave(async () => {
      const r = await saveFlowSettings(f);
      if (r.ok) {
        setDirty(false);
        setSaved(true);
        router.refresh();
      }
    });
  }
  function struct(fn: () => Promise<unknown>) {
    startStruct(async () => {
      await fn();
      router.refresh();
    });
  }

  const actieveGroep = LEAD_GROEPEN.find((g) => g.key === groep)!;

  return (
    <div className="oe-root">
      <style>{css}</style>

      <div className="oe-bar">
        <div>
          <div className="oe-bar-title">Flow-instellingen</div>
          <div className="oe-bar-sub">Nurture per lead-groep</div>
        </div>
        <button className={"oe-save" + (saved ? " done" : "")} onClick={saveFlow} disabled={isSaving || !dirty}>
          {saved ? "✓ Opgeslagen" : isSaving ? "Opslaan…" : "Wijzigingen opslaan"}
        </button>
      </div>

      <div className="oe-layout">
        <aside className="oe-groups">
          <div className="oe-eyebrow">Lead-groepen</div>
          {LEAD_GROEPEN.map((g) => (
            <button key={g.key} className={"oe-group" + (groep === g.key ? " is-active" : "")} onClick={() => setGroep(g.key)}>
              <span className="oe-group-top">
                <span className="oe-group-naam">{g.naam}</span>
                <StatusDot status={g.status} />
              </span>
              <span className="oe-group-meta">{g.meta}</span>
            </button>
          ))}
        </aside>

        <main className="oe-editor">
          {groep === "erfcheck" ? (
            <>
              {/* Flow-basis */}
              <div className="oe-panel">
                <div className="oe-panel-row">
                  <div className="oe-field grow">
                    <label className="oe-label" htmlFor="fn">Naam van de flow</label>
                    <input id="fn" className="oe-input" value={f.naam} onChange={(e) => upd("naam", e.target.value)} />
                  </div>
                  <div className="oe-field">
                    <span className="oe-label">Conversiedoel</span>
                    <span className="oe-goal">Haalbaarheidsscan · €99</span>
                  </div>
                  <div className="oe-field">
                    <span className="oe-label">Status</span>
                    <Switch on={f.actief} onChange={(v) => upd("actief", v)} label={f.actief ? "Actief" : "Uit"} />
                  </div>
                </div>
              </div>

              {/* Doelgroep */}
              <div className="oe-panel">
                <h2 className="oe-h2">Wie komt in deze flow</h2>
                <p className="oe-help">Trigger: lead heeft de gratis erfcheck voltooid (rapport verstuurd).</p>
                <div className="oe-field">
                  <span className="oe-label">Erf-verdict</span>
                  <Segmented
                    value={f.verdict}
                    onChange={(v) => upd("verdict", v as NurtureFlow["verdict"])}
                    options={[["alle", "Alle"], ["geschikt_twijfel", "Geschikt + twijfel"], ["alleen_geschikt", "Alleen geschikt"]]}
                  />
                  <p className="oe-hint">Erf-ongeschikte leads (rood) richting de scan sturen levert geen conversie op — standaard uitgesloten.</p>
                </div>
                <div className="oe-excl">
                  <Toggle on={f.excl_klant} onChange={(v) => upd("excl_klant", v)} label="Betalende adviesklanten uitsluiten" />
                  <Toggle on={f.excl_andere} onChange={(v) => upd("excl_andere", v)} label="Leads in een andere actieve flow uitsluiten" />
                </div>
              </div>

              {/* Stappen */}
              <div className="oe-panel">
                <div className="oe-panel-head">
                  <h2 className="oe-h2">Stappen</h2>
                  <span className="oe-count">{steps.length} e-mails</span>
                </div>
                <div className="oe-steps">
                  {steps.map((st, i) => (
                    <StepRow
                      key={st.id}
                      step={st}
                      first={i === 0}
                      last={i === steps.length - 1}
                      onMove={(dir) => struct(() => reorderStep(st.id, dir))}
                      onDelete={() => struct(() => deleteStep(st.id))}
                      busy={isStruct}
                    />
                  ))}
                </div>
                <button className="oe-add" onClick={() => struct(() => addStep())} disabled={isStruct}>+ Stap toevoegen</button>
                <div className="oe-stop">
                  <span className="oe-stop-dot" />
                  Stopt automatisch bij afmelding, bounce, klacht of status gewonnen/verloren. Deze regels staan vast.
                </div>
              </div>

              {/* Verzendvenster */}
              <div className="oe-panel">
                <h2 className="oe-h2">Verzendvenster</h2>
                <p className="oe-help">Tijdzone Europe/Amsterdam. Buiten het venster wacht de dagelijkse verzendjob tot een geldig moment.</p>
                <div className="oe-window">
                  <div className="oe-days">
                    {DAG_KEYS.map((k) => (
                      <button key={k} className={"oe-daybtn" + (f.dagen[k] ? " on" : "")} onClick={() => toggleDag(k)} aria-pressed={f.dagen[k]}>{k}</button>
                    ))}
                  </div>
                  <div className="oe-times">
                    <label className="oe-mini"><span>Van</span>
                      <input type="time" className="oe-select" value={f.venster_van} onChange={(e) => upd("venster_van", e.target.value)} /></label>
                    <label className="oe-mini"><span>Tot</span>
                      <input type="time" className="oe-select" value={f.venster_tot} onChange={(e) => upd("venster_tot", e.target.value)} /></label>
                  </div>
                </div>
              </div>
            </>
          ) : groep === "aanbieders" ? (
            <PartnerView partner={partner} metrics={partnerMetrics} />
          ) : (
            <EmptyState groep={actieveGroep} />
          )}
        </main>
      </div>
    </div>
  );
}

function StepRow({
  step, first, last, onMove, onDelete, busy,
}: {
  step: Step;
  first: boolean;
  last: boolean;
  onMove: (dir: -1 | 1) => void;
  onDelete: () => void;
  busy: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isSaving, startSave] = useTransition();
  const [msg, setMsg] = useState("");
  const [s, setS] = useState({
    onderwerp: step.onderwerp,
    dag_na_start: String(step.dag_na_start),
    send_condition: step.send_condition || "altijd",
    actief: step.actief,
    preview: step.preview ?? "",
    body: step.body,
    cta_primary_label: step.cta_primary_label ?? "",
    cta_primary_url: step.cta_primary_url ?? "",
    cta_secondary_label: step.cta_secondary_label ?? "",
    cta_secondary_url: step.cta_secondary_url ?? "",
  });
  const set = <K extends keyof typeof s>(k: K, v: (typeof s)[K]) => setS((p) => ({ ...p, [k]: v }));

  function save() {
    setMsg("");
    startSave(async () => {
      const r = await saveStep(step.id, {
        ...s,
        dag_na_start: Number(s.dag_na_start),
        send_condition: s.send_condition as "altijd" | "niet_geconverteerd" | "niet_geklikt_vorige",
      });
      setMsg(r.ok ? "✓ opgeslagen" : r.error ?? "mislukt");
      if (r.ok) router.refresh();
    });
  }

  return (
    <div className="oe-step">
      <div className="oe-step-rail">
        <span className="oe-day">Dag {step.dag_na_start}</span>
        <div className="oe-move">
          <button className="oe-icon" onClick={() => onMove(-1)} disabled={first || busy} aria-label="Omhoog">↑</button>
          <button className="oe-icon" onClick={() => onMove(1)} disabled={last || busy} aria-label="Omlaag">↓</button>
        </div>
      </div>

      <div className="oe-step-body">
        <input className="oe-input onderwerp" value={s.onderwerp} placeholder="Onderwerpregel…" onChange={(e) => set("onderwerp", e.target.value)} />
        <div className="oe-step-controls">
          <label className="oe-mini"><span>Voorwaarde</span>
            <select className="oe-select" value={s.send_condition} onChange={(e) => set("send_condition", e.target.value)}>
              {CONDITIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <label className="oe-mini"><span>Dag na start</span>
            <input type="number" min={0} className="oe-num" value={s.dag_na_start} onChange={(e) => set("dag_na_start", e.target.value)} />
          </label>
          <label className="oe-mini act"><span>Actief</span>
            <Switch on={s.actief} onChange={(v) => set("actief", v)} label={s.actief ? "Aan" : "Uit"} />
          </label>
        </div>

        <button className="oe-editlink" onClick={() => setOpen((o) => !o)}>
          {open ? "▾ Mail-inhoud verbergen" : "▸ Mail bewerken"}
        </button>

        {open && (
          <div className="oe-mailedit">
            <label className="oe-mini2"><span>Preview (preheader)</span>
              <input className="oe-input" value={s.preview} onChange={(e) => set("preview", e.target.value)} /></label>
            <label className="oe-mini2"><span>Body</span>
              <textarea rows={9} className="oe-input mono" value={s.body} onChange={(e) => set("body", e.target.value)} /></label>
            <div className="oe-cta-grid">
              <label className="oe-mini2"><span>Primaire knop — tekst</span>
                <input className="oe-input" value={s.cta_primary_label} onChange={(e) => set("cta_primary_label", e.target.value)} /></label>
              <label className="oe-mini2"><span>Primaire knop — URL</span>
                <input className="oe-input" value={s.cta_primary_url} onChange={(e) => set("cta_primary_url", e.target.value)} /></label>
              <label className="oe-mini2"><span>Secundaire link — tekst</span>
                <input className="oe-input" value={s.cta_secondary_label} onChange={(e) => set("cta_secondary_label", e.target.value)} /></label>
              <label className="oe-mini2"><span>Secundaire link — URL</span>
                <input className="oe-input" value={s.cta_secondary_url} onChange={(e) => set("cta_secondary_url", e.target.value)} /></label>
            </div>
            <p className="oe-hint">Merge: {"{{voornaam}} {{adres}} {{verdict}} {{perceel_m2}} {{erfcheck_url}}"}.</p>
          </div>
        )}

        <div className="oe-step-save">
          <button className="oe-save sm" onClick={save} disabled={isSaving}>{isSaving ? "Opslaan…" : "Mail opslaan"}</button>
          {msg && <span className={msg.startsWith("✓") ? "oe-ok" : "oe-err"}>{msg}</span>}
        </div>
      </div>

      <button className="oe-icon danger" onClick={onDelete} disabled={busy} aria-label="Stap verwijderen">✕</button>
    </div>
  );
}

function PartnerView({ partner, metrics }: { partner: PartnerData; metrics: PartnerMetric[] }) {
  const totVerzonden = metrics.reduce((s, m) => s + Number(m.verzonden), 0);
  return (
    <>
      <div className="oe-panel">
        <div className="oe-panel-row">
          <div className="oe-field grow">
            <span className="oe-label">Naam van de flow</span>
            <div className="oe-input" style={{ background: "#fff" }}>Aanbieder-werving</div>
          </div>
          <div className="oe-field">
            <span className="oe-label">Conversiedoel</span>
            <span className="oe-goal">Afspraak gepland</span>
          </div>
        </div>
        <p className="oe-help" style={{ margin: "12px 0 0" }}>
          Werving van aanbieders. Mail 1 stuur je handmatig per aanbieder (knop “Pitch sturen” bij
          Aanbieders → Partners); mail 2 en 3 gaan daarna automatisch — mits de aanbieder op status
          <strong> Benaderd</strong> staat. Reageert iemand (Afspraak gepland/Partner/Afgewezen), dan stopt de reeks.
        </p>
      </div>

      <div className="oe-panel">
        <div className="oe-panel-head">
          <h2 className="oe-h2">Stappen &amp; mails</h2>
          <span className="oe-count">3 e-mails</span>
        </div>
        <PitchEditor
          step1={partner.step1}
          step2={partner.step2}
          step3={partner.step3}
          delay2={partner.delay2}
          delay3={partner.delay3}
        />
      </div>

      <div className="oe-panel">
        <div className="oe-panel-head">
          <h2 className="oe-h2">Prestaties per pitch</h2>
          <span className="oe-count">meetlaag (Resend)</span>
        </div>
        {totVerzonden === 0 ? (
          <p className="oe-help" style={{ margin: 0 }}>
            Nog geen gemeten pitch-verzendingen. Zodra de webhook events levert, verschijnen hier
            bezorgd/geklikt/bounced per pitch-stap.
          </p>
        ) : (
          <table className="oe-mtable">
            <thead>
              <tr><th>Stap</th><th>Verzonden</th><th>Bezorgd</th><th>Geklikt</th><th>Bounced</th><th>CTR</th></tr>
            </thead>
            <tbody>
              {metrics.map((m) => (
                <tr key={m.stap}>
                  <td className="strong">{m.stap}</td>
                  <td>{m.verzonden}</td>
                  <td>{m.bezorgd}</td>
                  <td className="click">{m.geklikt}</td>
                  <td className={m.gebounced > 0 ? "bad" : ""}>{m.gebounced}</td>
                  <td>{m.ctr_pct != null ? `${m.ctr_pct}%` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function EmptyState({ groep }: { groep: { naam: string; status: string } }) {
  return (
    <div className="oe-empty">
      <div className="oe-empty-title">{groep.naam}</div>
      {groep.status === "doorstuur" ? (
        <p className="oe-empty-txt">Deze groep gaat via directe doorstuur naar partners (aanvraag = toestemming) en krijgt geen nurture-flow.</p>
      ) : groep.status === "uitgesloten" ? (
        <p className="oe-empty-txt">Niet-opgenomen leads dragen een negatief signaal en blijven bewust buiten nurture.</p>
      ) : (
        <p className="oe-empty-txt">Voor deze lead-groep is nog geen flow ingericht. (Multi-flow volgt in een latere fase.)</p>
      )}
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const map: Record<string, string> = { actief: "#6A8463", doorstuur: "#26384B", leeg: "#8A94A0", uitgesloten: "#B7452E" };
  return <span className="oe-sdot" style={{ background: map[status] ?? "#8A94A0" }} />;
}
function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" className={"oe-switch" + (on ? " on" : "")} onClick={() => onChange(!on)} aria-pressed={on}>
      <span className="oe-knob" /><span className="oe-switch-label">{label}</span>
    </button>
  );
}
function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" className="oe-toggle" onClick={() => onChange(!on)} aria-pressed={on}>
      <span className={"oe-check" + (on ? " on" : "")}>{on ? "✓" : ""}</span><span>{label}</span>
    </button>
  );
}
function Segmented({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <div className="oe-seg" role="group">
      {options.map(([v, l]) => (
        <button type="button" key={v} className={"oe-seg-btn" + (value === v ? " on" : "")} onClick={() => onChange(v)} aria-pressed={value === v}>{l}</button>
      ))}
    </div>
  );
}

const C = { navy: "#0C1C30", navy2: "#26384B", sage: "#6A8463", sageDeep: "#4E6349", paper: "#FBFBF9", card: "#FFFFFF", line: "#E7E9E6", muted: "#8A94A0", mutedInk: "#5C6470", sageTint: "#EAEFE7", field: "#F6F7F5" };
const css = `
.oe-root{color:${C.navy};}
.oe-root *{box-sizing:border-box;}
.oe-bar{display:flex;justify-content:space-between;align-items:center;gap:16px;background:${C.navy};border-radius:14px;padding:16px 22px;color:#fff;margin-bottom:18px;}
.oe-bar-title{font-size:18px;font-weight:700;line-height:1.1;}
.oe-bar-sub{font-size:12.5px;color:#B7C1CC;margin-top:2px;}
.oe-save{border:0;background:${C.sage};color:#fff;font:inherit;font-weight:600;font-size:14px;padding:10px 18px;border-radius:9px;cursor:pointer;transition:background .15s;}
.oe-save:hover{background:${C.sageDeep};}
.oe-save.done{background:#233A26;}
.oe-save:disabled{opacity:.55;cursor:default;}
.oe-save.sm{padding:7px 14px;font-size:13px;}
.oe-layout{display:grid;grid-template-columns:230px 1fr;gap:16px;align-items:start;}
.oe-eyebrow{font-size:11px;font-weight:700;letter-spacing:1.3px;text-transform:uppercase;color:${C.sageDeep};margin-bottom:10px;}
.oe-groups{position:sticky;top:12px;}
.oe-group{display:flex;flex-direction:column;gap:5px;width:100%;text-align:left;cursor:pointer;background:${C.card};border:1px solid ${C.line};border-radius:11px;padding:12px 14px;margin-bottom:8px;transition:border-color .15s,box-shadow .15s;}
.oe-group:hover{border-color:#CFD6CB;}
.oe-group.is-active{border-color:${C.sage};box-shadow:0 0 0 1px ${C.sage};}
.oe-group-top{display:flex;justify-content:space-between;align-items:center;}
.oe-group-naam{font-size:13.5px;font-weight:600;}
.oe-group-meta{font-size:11px;color:${C.muted};}
.oe-sdot{width:8px;height:8px;border-radius:50%;flex:none;}
.oe-editor{display:flex;flex-direction:column;gap:14px;}
.oe-panel{background:${C.card};border:1px solid ${C.line};border-radius:13px;padding:18px 20px;}
.oe-panel-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;}
.oe-panel-row{display:flex;gap:16px;align-items:flex-end;flex-wrap:wrap;}
.oe-h2{font-size:15px;font-weight:700;margin:0 0 4px;}
.oe-help{font-size:12.5px;color:${C.mutedInk};margin:0 0 14px;}
.oe-count{font-size:12px;color:${C.muted};}
.oe-field{display:flex;flex-direction:column;gap:6px;}
.oe-field.grow{flex:1;min-width:200px;}
.oe-label{font-size:12px;font-weight:600;color:${C.mutedInk};}
.oe-input{font:inherit;font-size:14px;color:${C.navy};background:${C.field};border:1px solid ${C.line};border-radius:9px;padding:9px 12px;width:100%;}
.oe-input:focus{outline:2px solid ${C.sage};outline-offset:1px;border-color:transparent;}
.oe-input.mono{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12.5px;line-height:1.5;}
.oe-goal{font-size:14px;font-weight:600;color:${C.sageDeep};background:${C.sageTint};padding:8px 12px;border-radius:9px;white-space:nowrap;}
.oe-hint{font-size:11.5px;color:${C.muted};margin:8px 0 0;max-width:560px;line-height:1.5;}
.oe-seg{display:inline-flex;background:${C.field};border:1px solid ${C.line};border-radius:10px;padding:3px;}
.oe-seg-btn{border:0;background:transparent;font:inherit;font-size:13px;color:${C.mutedInk};padding:7px 15px;border-radius:7px;cursor:pointer;}
.oe-seg-btn.on{background:#fff;color:${C.navy};font-weight:600;box-shadow:0 1px 2px rgba(12,28,48,.08);}
.oe-excl{display:flex;flex-direction:column;gap:10px;margin-top:16px;padding-top:14px;border-top:1px solid ${C.line};}
.oe-toggle{display:inline-flex;align-items:center;gap:10px;background:none;border:0;font:inherit;font-size:13.5px;color:${C.navy};cursor:pointer;padding:0;}
.oe-check{width:20px;height:20px;border-radius:6px;border:1.5px solid ${C.line};display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;flex:none;}
.oe-check.on{background:${C.sage};border-color:${C.sage};}
.oe-switch{display:inline-flex;align-items:center;gap:9px;background:none;border:0;font:inherit;cursor:pointer;padding:0;}
.oe-switch .oe-knob{width:38px;height:22px;border-radius:20px;background:#CBD1CC;position:relative;transition:background .18s;flex:none;}
.oe-switch .oe-knob::after{content:"";position:absolute;top:2.5px;left:2.5px;width:17px;height:17px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.2);transition:transform .18s;}
.oe-switch.on .oe-knob{background:${C.sage};}
.oe-switch.on .oe-knob::after{transform:translateX(16px);}
.oe-switch-label{font-size:13px;font-weight:600;}
.oe-steps{display:flex;flex-direction:column;gap:10px;}
.oe-step{display:grid;grid-template-columns:74px 1fr 30px;gap:12px;align-items:start;background:${C.paper};border:1px solid ${C.line};border-radius:12px;padding:13px;}
.oe-step-rail{display:flex;flex-direction:column;gap:8px;align-items:flex-start;}
.oe-day{font-size:12px;font-weight:700;color:${C.sageDeep};background:${C.sageTint};padding:4px 8px;border-radius:7px;white-space:nowrap;}
.oe-move{display:flex;gap:3px;}
.oe-step-body{display:flex;flex-direction:column;gap:10px;min-width:0;}
.oe-input.onderwerp{background:#fff;font-weight:600;}
.oe-step-controls{display:flex;gap:14px;flex-wrap:wrap;align-items:flex-end;}
.oe-mini{display:flex;flex-direction:column;gap:5px;font-size:11px;color:${C.mutedInk};font-weight:600;}
.oe-mini.act{margin-left:auto;}
.oe-mini2{display:flex;flex-direction:column;gap:5px;font-size:11px;color:${C.mutedInk};font-weight:600;}
.oe-select{font:inherit;font-size:13px;color:${C.navy};background:#fff;border:1px solid ${C.line};border-radius:8px;padding:7px 10px;cursor:pointer;}
.oe-num{font:inherit;font-size:13px;width:56px;text-align:center;background:#fff;border:1px solid ${C.line};border-radius:8px;padding:7px 6px;}
.oe-editlink{align-self:flex-start;background:none;border:0;color:${C.sageDeep};font:inherit;font-weight:600;font-size:12.5px;cursor:pointer;padding:0;}
.oe-mailedit{display:flex;flex-direction:column;gap:10px;background:#fff;border:1px solid ${C.line};border-radius:10px;padding:14px;}
.oe-cta-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
.oe-step-save{display:flex;align-items:center;gap:10px;}
.oe-ok{font-size:12.5px;color:#2f7d3b;font-weight:600;}
.oe-err{font-size:12.5px;color:#b7452e;font-weight:600;}
.oe-icon{width:26px;height:26px;border:1px solid ${C.line};background:#fff;border-radius:7px;cursor:pointer;color:${C.mutedInk};font-size:14px;line-height:1;}
.oe-icon:hover{background:${C.field};}
.oe-icon:disabled{opacity:.35;cursor:not-allowed;}
.oe-icon.danger:hover{background:#FBEAE6;color:#B7452E;border-color:#F0C9BF;}
.oe-add{margin-top:12px;background:#fff;border:1.5px dashed #C7CFC4;color:${C.sageDeep};font:inherit;font-weight:600;font-size:13.5px;padding:10px 16px;border-radius:10px;cursor:pointer;}
.oe-add:hover{background:${C.sageTint};border-color:${C.sage};}
.oe-add:disabled{opacity:.5;}
.oe-stop{display:flex;align-items:center;gap:9px;margin-top:14px;padding:10px 13px;background:${C.field};border-radius:9px;font-size:12px;color:${C.mutedInk};line-height:1.4;}
.oe-stop-dot{width:8px;height:8px;border-radius:50%;background:${C.navy2};flex:none;}
.oe-window{display:flex;justify-content:space-between;align-items:flex-end;gap:20px;flex-wrap:wrap;}
.oe-days{display:flex;gap:6px;}
.oe-daybtn{width:38px;height:38px;border-radius:9px;border:1px solid ${C.line};background:#fff;font:inherit;font-size:13px;color:${C.muted};cursor:pointer;text-transform:capitalize;}
.oe-daybtn.on{background:${C.navy};color:#fff;border-color:${C.navy};font-weight:600;}
.oe-times{display:flex;gap:12px;}
.oe-empty{background:${C.card};border:1px solid ${C.line};border-radius:13px;padding:40px 28px;text-align:center;}
.oe-empty-title{font-size:16px;font-weight:700;margin-bottom:8px;}
.oe-empty-txt{font-size:13.5px;color:${C.mutedInk};max-width:460px;margin:0 auto;line-height:1.6;}
.oe-mtable{width:100%;border-collapse:collapse;font-size:13px;}
.oe-mtable th{text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.4px;color:${C.muted};font-weight:600;padding:6px 10px 6px 0;}
.oe-mtable td{padding:8px 10px 8px 0;border-top:1px solid ${C.line};color:${C.navy};}
.oe-mtable td.strong{font-weight:600;}
.oe-mtable td.click{font-weight:700;color:${C.sageDeep};}
.oe-mtable td.bad{color:#B7452E;font-weight:600;}
@media (max-width:820px){.oe-layout{grid-template-columns:1fr;}.oe-groups{position:static;}.oe-cta-grid{grid-template-columns:1fr;}}
`;
