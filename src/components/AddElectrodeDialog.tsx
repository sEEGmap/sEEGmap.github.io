import { useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import type { AnatomyRecord } from "../types";
import {
  AMP_CODES,
  LOBE_CODES,
  SMI_CODES,
  buildLateralMedialName,
  buildSuperiorInferiorName,
  isNameTaken,
} from "../lib/nomenclature";

type Tab = "name" | "anatomy" | "library" | "manual";

export default function AddElectrodeDialog({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("name");

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(24,36,48,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{ width: 480, maxWidth: "100%", maxHeight: "86vh", display: "flex", flexDirection: "column" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: "1px solid var(--line)" }}>
          <strong style={{ fontSize: 15 }}>Add Electrode</strong>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            Close
          </button>
        </div>
        <div style={{ display: "flex", gap: 4, padding: "10px 18px 0" }}>
          <TabButton active={tab === "name"} onClick={() => setTab("name")}>
            By Name
          </TabButton>
          <TabButton active={tab === "anatomy"} onClick={() => setTab("anatomy")}>
            By Target
          </TabButton>
          <TabButton active={tab === "library"} onClick={() => setTab("library")}>
            Library
          </TabButton>
          <TabButton active={tab === "manual"} onClick={() => setTab("manual")}>
            Manual
          </TabButton>
        </div>
        <div className="scroll" style={{ padding: 18, flex: 1 }}>
          {tab === "name" && <ByNameTab onDone={onClose} />}
          {tab === "anatomy" && <ByAnatomyTab onDone={onClose} />}
          {tab === "library" && <LibraryTab onDone={onClose} />}
          {tab === "manual" && <ManualTab onDone={onClose} />}
        </div>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      className="btn btn-ghost btn-sm"
      onClick={onClick}
      style={{
        borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent",
        borderRadius: "6px 6px 0 0",
        color: active ? "var(--accent)" : "var(--muted)",
        fontWeight: active ? 600 : 500,
      }}
    >
      {children}
    </button>
  );
}

function ByNameTab({ onDone }: { onDone: () => void }) {
  const addByName = useStore((s) => s.addByName);
  const [name, setName] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const submit = () => {
    const res = addByName(name);
    setMessage({ ok: res.ok, text: res.message });
    if (res.ok) {
      setName("");
      setTimeout(onDone, 400);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <p style={{ margin: 0, fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>
        If the name matches the anatomical library (e.g. <span className="mono">LTAI</span>), entry/target are
        placed precisely and labeled automatically. Otherwise a lateral-medial code (e.g.{" "}
        <span className="mono">LTMI</span>) or superior-inferior code (e.g. <span className="mono">LAI</span>)
        is placed from the region configuration -- verify placement afterward.
      </p>
      <div className="field">
        <label>Electrode name</label>
        <input
          className="mono"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="LTMI"
        />
      </div>
      {message && (
        <div style={{ fontSize: 12.5, color: message.ok ? "var(--accent)" : "var(--danger)" }}>{message.text}</div>
      )}
      <button className="btn btn-primary" onClick={submit} disabled={!name.trim()}>
        Place Electrode
      </button>
    </div>
  );
}

function ByAnatomyTab({ onDone }: { onDone: () => void }) {
  const anatomy = useStore((s) => s.anatomy);
  const addByAnatomy = useStore((s) => s.addByAnatomy);
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return anatomy.slice(0, 12);
    return anatomy.filter((a) => a.targetName.toLowerCase().includes(q) || a.category.toLowerCase().includes(q)).slice(0, 20);
  }, [anatomy, query]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <p style={{ margin: 0, fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>
        Search the anatomical library. Selecting a target places both the target and its preferred entry, and
        suggests a name you can edit afterward.
      </p>
      <div className="field">
        <label>Search target</label>
        <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Amygdala" />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 280, overflowY: "auto" }}>
        {results.length === 0 && (
          <div style={{ fontSize: 13, color: "var(--muted)" }}>No matches. Add entries in Settings → Anatomical Library.</div>
        )}
        {results.map((r) => (
          <button
            key={r.id}
            className="btn"
            style={{ justifyContent: "flex-start", textAlign: "left" }}
            onClick={() => {
              addByAnatomy(r);
              onDone();
            }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: 13.5 }}>{r.targetName}</div>
              <div style={{ fontSize: 11.5, color: "var(--muted)" }}>
                {r.category} · entry: {r.preferredEntry}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function LibraryTab({ onDone }: { onDone: () => void }) {
  const anatomy = useStore((s) => s.anatomy);
  const electrodes = useStore((s) => s.electrodes);
  const addByName = useStore((s) => s.addByName);
  const addByAnatomy = useStore((s) => s.addByAnatomy);
  const [query, setQuery] = useState("");

  const sorted = useMemo(
    () => [...anatomy].sort((a, b) => a.targetName.localeCompare(b.targetName)),
    [anatomy]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter(
      (a) =>
        a.targetName.toLowerCase().includes(q) ||
        a.preferredEntry.toLowerCase().includes(q) ||
        (a.electrodeName || "").toLowerCase().includes(q)
    );
  }, [sorted, query]);

  const place = (record: AnatomyRecord) => {
    const code = (record.electrodeName || "").trim().toUpperCase();
    // Prefer the library's own electrode code (goes through the same lookup as "By Name",
    // so it lands at the exact curated position) as long as it isn't already used.
    if (code && !isNameTaken(code, electrodes)) {
      addByName(code);
    } else {
      addByAnatomy(record);
    }
    onDone();
  };

  const isAlreadyPlaced = (record: AnatomyRecord) => {
    const code = (record.electrodeName || "").trim().toUpperCase();
    return electrodes.some(
      (e) => (code && e.name.trim().toUpperCase() === code) || (e.targetName && e.targetName === record.targetName)
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <p style={{ margin: 0, fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>
        Browse the full anatomical library, A–Z. Selecting an entry places its target and preferred
        entry directly. Entries already in your plan are marked "Added" -- you can still add another.
      </p>
      <div className="field">
        <label>Filter</label>
        <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter by target, entry, or code" />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 340, overflowY: "auto" }}>
        {filtered.length === 0 && (
          <div style={{ fontSize: 13, color: "var(--muted)" }}>No matches. Add entries in Settings → Anatomical Library.</div>
        )}
        {filtered.map((r) => {
          const added = isAlreadyPlaced(r);
          return (
            <button
              key={r.id}
              className="btn"
              style={{ justifyContent: "flex-start", textAlign: "left", opacity: added ? 0.6 : 1 }}
              onClick={() => place(r)}
            >
              <div style={{ width: "100%" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontWeight: 600, fontSize: 13.5 }}>{r.targetName}</span>
                  {r.electrodeName && (
                    <span className="mono badge" style={{ fontSize: 10.5 }}>
                      {r.electrodeName}
                    </span>
                  )}
                  {added && (
                    <span className="badge" style={{ fontSize: 10.5, color: "var(--accent)", borderColor: "var(--accent)" }}>
                      ✓ Added
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11.5, color: "var(--muted)" }}>
                  Entry: {r.preferredEntry || "--"} · Target: {r.targetName}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ManualTab({ onDone }: { onDone: () => void }) {
  const addLateralMedial = useStore((s) => s.addLateralMedial);
  const addSuperiorInferior = useStore((s) => s.addSuperiorInferior);
  const setSelected = useStore((s) => s.setSelected);
  const electrodes = useStore((s) => s.electrodes);

  const [kind, setKind] = useState<"lateral-medial" | "superior-inferior">("lateral-medial");
  const [side, setSide] = useState<"L" | "R">("L");
  const [lobe, setLobe] = useState("T");
  const [amp, setAmp] = useState<"A" | "M" | "P">("M");
  const [smi, setSmi] = useState<"S" | "M" | "I">("M");
  const [structure, setStructure] = useState("I");
  const [ap, setAp] = useState<"A" | "P">("A");

  const generatedName =
    kind === "lateral-medial"
      ? buildLateralMedialName(side, lobe, amp, smi)
      : buildSuperiorInferiorName(side, ap, structure);

  const taken = isNameTaken(generatedName, electrodes);

  const submit = () => {
    const created =
      kind === "lateral-medial"
        ? addLateralMedial({ name: generatedName })
        : addSuperiorInferior({ name: generatedName });
    // Select it immediately so it's obviously highlighted in both the list and on the
    // canvas -- otherwise a freshly-added electrode at the default position can be easy to miss.
    setSelected(created.id);
    onDone();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <p style={{ margin: 0, fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>
        Build a name from its parts, then place both markers manually by dragging them on the canvas.
        The electrode is added at a default position near the top-left of the canvas -- it's
        already selected (highlighted) in the list so it's easy to find. Entry/Target labels start
        blank; type them directly in the spreadsheet cells.
      </p>

      <div style={{ display: "flex", gap: 4 }}>
        <TabButton active={kind === "lateral-medial"} onClick={() => setKind("lateral-medial")}>
          Lateral–Medial
        </TabButton>
        <TabButton active={kind === "superior-inferior"} onClick={() => setKind("superior-inferior")}>
          Superior–Inferior
        </TabButton>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <div className="field" style={{ width: 90 }}>
          <label>Side</label>
          <select value={side} onChange={(e) => setSide(e.target.value as "L" | "R")}>
            <option value="L">Left</option>
            <option value="R">Right</option>
          </select>
        </div>

        {kind === "lateral-medial" ? (
          <>
            <div className="field" style={{ width: 130 }}>
              <label>Lobe</label>
              <select value={lobe} onChange={(e) => setLobe(e.target.value)}>
                {Object.entries(LOBE_CODES).map(([code, label]) => (
                  <option key={code} value={code}>
                    {label} ({code})
                  </option>
                ))}
              </select>
            </div>
            <div className="field" style={{ width: 130 }}>
              <label>A / M / P</label>
              <select value={amp} onChange={(e) => setAmp(e.target.value as "A" | "M" | "P")}>
                {Object.entries(AMP_CODES).map(([code, label]) => (
                  <option key={code} value={code}>
                    {label} ({code})
                  </option>
                ))}
              </select>
            </div>
            <div className="field" style={{ width: 130 }}>
              <label>S / M / I</label>
              <select value={smi} onChange={(e) => setSmi(e.target.value as "S" | "M" | "I")}>
                {Object.entries(SMI_CODES).map(([code, label]) => (
                  <option key={code} value={code}>
                    {label} ({code})
                  </option>
                ))}
              </select>
            </div>
          </>
        ) : (
          <>
            <div className="field" style={{ width: 130 }}>
              <label>Anterior / Posterior</label>
              <select value={ap} onChange={(e) => setAp(e.target.value as "A" | "P")}>
                <option value="A">Anterior</option>
                <option value="P">Posterior</option>
              </select>
            </div>
            <div className="field" style={{ width: 130 }}>
              <label>Structure code</label>
              <input value={structure} onChange={(e) => setStructure(e.target.value.toUpperCase().slice(0, 2))} />
            </div>
          </>
        )}
      </div>

      <div className="field">
        <label>Generated name</label>
        <input className="mono" value={generatedName} readOnly style={{ fontWeight: 700, background: "var(--surface-2)" }} />
      </div>
      {taken && <div style={{ color: "var(--danger)", fontSize: 12.5 }}>That name is already in use -- adjust the parts above.</div>}

      <button className="btn btn-primary" onClick={submit} disabled={taken}>
        Add & Place Manually
      </button>
    </div>
  );
}
