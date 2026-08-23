import { Link, useNavigate } from "react-router-dom";
import { useStore } from "../store/useStore";
import { clearSession } from "../db/db";

export default function Settings() {
  const navigate = useNavigate();
  const newPlan = useStore((s) => s.newPlan);
  const electrodeCount = useStore((s) => s.electrodes.length);
  const sketchCount = useStore((s) => s.sketches.length);

  const handleDiscardSession = async () => {
    if (!window.confirm("This clears the saved plan from this browser. Continue?")) return;
    await clearSession();
    await newPlan();
  };

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "36px 24px 60px", width: "100%" }}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Settings</h1>
      <p style={{ color: "var(--muted)", fontSize: 13.5, marginTop: 0 }}>
        Everything here is stored locally in this browser. Nothing is sent to a server.
      </p>

      <section className="card" style={{ padding: 20, marginTop: 20 }}>
        <h2 style={{ fontSize: 15, margin: "0 0 8px" }}>Anatomical library</h2>
        <p style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 0, marginBottom: 12 }}>
          Manage the searchable target/entry list used by the "By Target" add workflow.
        </p>
        <Link to="/settings/anatomy" className="btn btn-sm">
          Open Anatomical Library →
        </Link>
      </section>

      <section className="card" style={{ padding: 20, marginTop: 16 }}>
        <h2 style={{ fontSize: 15, margin: "0 0 8px" }}>Session</h2>
        <p style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 0, marginBottom: 12 }}>
          {electrodeCount} electrode{electrodeCount === 1 ? "" : "s"} and {sketchCount} sketched area
          {sketchCount === 1 ? "" : "s"} currently saved in this browser's storage.
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-sm" onClick={() => navigate("/planner")}>
            Go to Planner
          </button>
          <button className="btn btn-sm btn-danger" onClick={handleDiscardSession}>
            Discard Saved Plan
          </button>
        </div>
      </section>

      <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 20 }}>
        Contact / institution details on the Home screen are configured in{" "}
        <span className="mono">public/app-config.json</span> at deploy time.
      </p>
    </div>
  );
}
