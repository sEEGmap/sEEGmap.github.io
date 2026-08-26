import { useRef, useState } from "react";
import Papa from "papaparse";
import { useStore } from "../store/useStore";
import type { AnatomyRecord } from "../types";
import AnatomyBuilder from "../components/AnatomyBuilder";
import SuperiorInferiorBuilder from "../components/SuperiorInferiorBuilder";

const emptyDraft = {
  electrodeName: "",
  targetName: "",
  preferredEntry: "",
  targetX: 0,
  targetY: 0,
  entryX: 0,
  entryY: 0,
  category: "",
  comments: "",
};

export default function AnatomyLibraryPage() {
  const anatomy = useStore((s) => s.anatomy);
  const addAnatomyRecord = useStore((s) => s.addAnatomyRecord);
  const updateAnatomyRecord = useStore((s) => s.updateAnatomyRecord);
  const removeAnatomyRecord = useStore((s) => s.removeAnatomyRecord);
  const replaceAnatomyLibrary = useStore((s) => s.replaceAnatomyLibrary);

  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"library" | "builder" | "si-builder">("library");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [adding, setAdding] = useState(false);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);

  const filtered = anatomy.filter((a) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      a.targetName.toLowerCase().includes(q) ||
      a.category.toLowerCase().includes(q) ||
      (a.electrodeName || "").toLowerCase().includes(q)
    );
  });

  const startEdit = (record: AnatomyRecord) => {
    setEditingId(record.id);
    setAdding(false);
    setDraft({ ...emptyDraft, ...record });
  };

  const startAdd = () => {
    setAdding(true);
    setEditingId(null);
    setDraft(emptyDraft);
  };

  const cancel = () => {
    setAdding(false);
    setEditingId(null);
  };

  const saveDraft = () => {
    if (!draft.targetName.trim()) return;
    if (editingId) {
      updateAnatomyRecord(editingId, draft);
    } else {
      addAnatomyRecord(draft);
    }
    cancel();
  };

  const exportCsv = () => {
    const csv = Papa.unparse(
      anatomy.map((a) => ({
        ElectrodeName: a.electrodeName,
        TargetName: a.targetName,
        PreferredEntry: a.preferredEntry,
        TargetX: a.targetX,
        TargetY: a.targetY,
        EntryX: a.entryX,
        EntryY: a.entryY,
        Category: a.category,
        Comments: a.comments,
      }))
    );
    downloadBlob(csv, "anatomy-library.csv", "text/csv");
  };

  const exportJson = () => {
    downloadBlob(JSON.stringify(anatomy, null, 2), "anatomy-library.json", "application/json");
  };

  const importCsv = async (file: File) => {
    const text = await file.text();
    const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
    const records = parsed.data.map((row) => ({
      electrodeName: row.ElectrodeName ?? "",
      targetName: row.TargetName ?? "",
      preferredEntry: row.PreferredEntry ?? "",
      targetX: Number(row.TargetX) || 0,
      targetY: Number(row.TargetY) || 0,
      entryX: Number(row.EntryX) || 0,
      entryY: Number(row.EntryY) || 0,
      category: row.Category ?? "",
      comments: row.Comments ?? "",
    }));
    replaceAnatomyLibrary(records);
  };

  const importJson = async (file: File) => {
    const text = await file.text();
    const records = JSON.parse(text) as AnatomyRecord[];
    replaceAnatomyLibrary(records.map(({ id: _id, electrodeName, ...rest }) => ({ electrodeName: electrodeName ?? "", ...rest })));
  };

  return (
    <div style={{ maxWidth: 920, margin: "0 auto", padding: "36px 24px 60px", width: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, margin: 0 }}>Anatomical Library</h1>
          <p style={{ color: "var(--muted)", fontSize: 13.5, margin: "4px 0 0" }}>
            {anatomy.length} record{anatomy.length === 1 ? "" : "s"}. Coordinates are placeholder / best-effort --
            verify against the template before clinical use.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn btn-sm" onClick={() => csvInputRef.current?.click()}>
            Import CSV
          </button>
          <button className="btn btn-sm" onClick={exportCsv}>
            Export CSV
          </button>
          <button className="btn btn-sm" onClick={() => jsonInputRef.current?.click()}>
            Import JSON
          </button>
          <button className="btn btn-sm" onClick={exportJson}>
            Export JSON
          </button>
          <button className="btn btn-sm btn-primary" onClick={startAdd}>
            + Add
          </button>
        </div>
        <input
          ref={csvInputRef}
          type="file"
          accept=".csv"
          style={{ display: "none" }}
          onChange={(e) => e.target.files?.[0] && importCsv(e.target.files[0])}
        />
        <input
          ref={jsonInputRef}
          type="file"
          accept=".json"
          style={{ display: "none" }}
          onChange={(e) => e.target.files?.[0] && importJson(e.target.files[0])}
        />
      </div>

      <div style={{ display: "flex", gap: 4, marginTop: 18, borderBottom: "1px solid var(--line)" }}>
        <button
          className="btn btn-sm"
          onClick={() => setTab("library")}
          style={{
            borderRadius: "8px 8px 0 0",
            borderBottomColor: tab === "library" ? "var(--accent)" : "transparent",
            color: tab === "library" ? "var(--accent)" : "var(--muted)",
          }}
        >
          Library
        </button>
        <button
          className="btn btn-sm"
          onClick={() => setTab("builder")}
          style={{
            borderRadius: "8px 8px 0 0",
            borderBottomColor: tab === "builder" ? "var(--accent)" : "transparent",
            color: tab === "builder" ? "var(--accent)" : "var(--muted)",
          }}
        >
          Click-to-build
        </button>
        <button
          className="btn btn-sm"
          onClick={() => setTab("si-builder")}
          style={{
            borderRadius: "8px 8px 0 0",
            borderBottomColor: tab === "si-builder" ? "var(--accent)" : "transparent",
            color: tab === "si-builder" ? "var(--accent)" : "var(--muted)",
          }}
        >
          Click-to-build (S–I)
        </button>
      </div>

      {tab === "builder" ? (
        <AnatomyBuilder />
      ) : tab === "si-builder" ? (
        <SuperiorInferiorBuilder />
      ) : (
        <>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search target, category, or electrode name"
        style={{
          marginTop: 18,
          width: "100%",
          padding: "9px 12px",
          border: "1px solid var(--line-strong)",
          borderRadius: 8,
          fontSize: 13.5,
        }}
      />

      {(adding || editingId) && (
        <div className="card" style={{ padding: 16, marginTop: 16 }}>
          <strong style={{ fontSize: 13.5 }}>{editingId ? "Edit record" : "New record"}</strong>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
            <div className="field">
              <label>Electrode name (optional)</label>
              <input
                className="mono"
                value={draft.electrodeName}
                onChange={(e) => setDraft({ ...draft, electrodeName: e.target.value.toUpperCase() })}
                placeholder="e.g. LTAI"
              />
            </div>
            <div className="field">
              <label>Target name</label>
              <input value={draft.targetName} onChange={(e) => setDraft({ ...draft, targetName: e.target.value })} />
            </div>
            <div className="field">
              <label>Preferred entry (label)</label>
              <input value={draft.preferredEntry} onChange={(e) => setDraft({ ...draft, preferredEntry: e.target.value })} />
            </div>
            <div className="field">
              <label>Category</label>
              <input value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} />
            </div>
            <div className="field">
              <label>Target X / Y (reference px)</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="number"
                  value={draft.targetX}
                  onChange={(e) => setDraft({ ...draft, targetX: Number(e.target.value) })}
                />
                <input
                  type="number"
                  value={draft.targetY}
                  onChange={(e) => setDraft({ ...draft, targetY: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="field">
              <label>Entry X / Y (reference px)</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="number"
                  value={draft.entryX}
                  onChange={(e) => setDraft({ ...draft, entryX: Number(e.target.value) })}
                />
                <input
                  type="number"
                  value={draft.entryY}
                  onChange={(e) => setDraft({ ...draft, entryY: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label>Comments</label>
              <textarea rows={2} value={draft.comments} onChange={(e) => setDraft({ ...draft, comments: e.target.value })} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button className="btn btn-primary btn-sm" onClick={saveDraft} disabled={!draft.targetName.trim()}>
              Save
            </button>
            <button className="btn btn-sm" onClick={cancel}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 6 }}>
        {filtered.map((a) => (
          <div
            key={a.id}
            className="card"
            style={{
              padding: "10px 14px",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 13.5, display: "flex", alignItems: "center", gap: 8 }}>
                {a.targetName}
                {a.electrodeName && (
                  <span className="mono badge" style={{ fontSize: 10.5 }}>
                    {a.electrodeName}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 11.5, color: "var(--muted)" }}>
                {a.category || "Uncategorized"} · entry: {a.preferredEntry || "--"} · target ({a.targetX}, {a.targetY})
              </div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => startEdit(a)}>
              Edit
            </button>
            <button className="btn btn-ghost btn-sm btn-danger" onClick={() => removeAnatomyRecord(a.id)}>
              Delete
            </button>
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ color: "var(--muted)", fontSize: 13, padding: 20, textAlign: "center" }}>No records found.</div>
        )}
      </div>
        </>
      )}
    </div>
  );
}

function downloadBlob(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
