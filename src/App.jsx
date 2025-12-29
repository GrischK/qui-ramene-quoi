import { useEffect, useMemo, useState } from "react";

function splitCSVLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const c = line[i];

    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length <= 1) return [];

  const headers = splitCSVLine(lines[0]).map((h) => h.trim());
  const rows = lines.slice(1).map((line) => {
    const values = splitCSVLine(line);
    const obj = {};
    headers.forEach((h, i) => (obj[h] = (values[i] ?? "").trim()));
    return obj;
  });

  return rows
    .filter((r) => r.name || r.item)
    .map((r) => ({
      name: r.name || "",
      item: r.item || "",
      qty: r.qty || "",
      note: r.note || "",
      createdAt: r.createdAt || "",
    }))
    .reverse();
}

function normalizeKey(r) {
  const norm = (v) => String(v ?? "").trim().toLowerCase();
  // On n'inclut pas createdAt car Google peut le reformater
  return `${norm(r.name)}|${norm(r.item)}|${norm(r.qty)}|${norm(r.note)}`;
}

function sortByCreatedAtDesc(a, b) {
  const ta = Date.parse(a.createdAt || "") || 0;
  const tb = Date.parse(b.createdAt || "") || 0;
  return tb - ta;
}

export default function App() {
  const CSV_URL = import.meta.env.VITE_SHEET_CSV_URL;
  const SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL;

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const [form, setForm] = useState({ name: "", item: "", qty: "", note: "" });

  async function fetchRows({ showSpinner = false } = {}) {
    setError("");

    if (showSpinner) setRefreshing(true);
    if (rows.length === 0) setLoading(true);

    try {
      const url = `${CSV_URL}${CSV_URL.includes("?") ? "&" : "?"}t=${Date.now()}`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error("Lecture impossible. Vérifie l’URL CSV publiée.");
      const text = await res.text();

      const incoming = parseCSV(text);

      // Merge: on garde les lignes locales non encore visibles dans le CSV
      setRows((prev) => {
        const map = new Map();

        for (const r of incoming) map.set(normalizeKey(r), r);
        for (const r of prev) {
          const k = normalizeKey(r);
          if (!map.has(k)) map.set(k, r);
        }

        return Array.from(map.values()).sort(sortByCreatedAtDesc);
      });
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      if (showSpinner) setRefreshing(false);
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchRows();
    const t = setInterval(() => {
      if (!submitting) fetchRows();
    }, 15000);
    return () => clearInterval(t);
  }, [submitting]);

  const grouped = useMemo(() => {
    const map = new Map();
    for (const r of rows) {
      const key = r.item.toLowerCase().trim();
      if (!key) continue;
      const prev = map.get(key) || { item: r.item, people: [] };
      prev.people.push({ name: r.name, qty: r.qty, note: r.note });
      map.set(key, prev);
    }
    return Array.from(map.values()).sort((a, b) => a.item.localeCompare(b.item, "fr"));
  }, [rows]);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");

    if (!form.name.trim() || !form.item.trim()) {
      setError("Nom et objet sont obligatoires.");
      return;
    }

    setSubmitting(true);
    try {
      const body = new URLSearchParams({
        name: form.name,
        item: form.item,
        qty: form.qty,
        note: form.note,
      });

      const res = await fetch(SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
        body,
      });

      const txt = await res.text();
      if (!res.ok || txt.trim().toLowerCase() !== "ok") {
        throw new Error(txt || "Ajout impossible.");
      }

      // Optimistic update
      const newRow = {
        name: form.name.trim(),
        item: form.item.trim(),
        qty: form.qty.trim(),
        note: form.note.trim(),
        createdAt: new Date().toISOString(),
      };

      setRows((prev) => [newRow, ...prev]);

      setForm((f) => ({ ...f, item: "", qty: "", note: "" }));

      // Resync léger après un petit délai pour laisser le CSV se mettre à jour
      setTimeout(() => fetchRows(), 1200);
    } catch (e2) {
      setError(String(e2.message || e2));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        maxWidth: 900,
        margin: "0 auto",
        padding: 16,
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
      }}
    >
      <h1 style={{ margin: 0 }}>Qui ramène quoi</h1>
      <p style={{ marginTop: 6, opacity: 0.75 }}>
        Ajoute ta participation. La liste se met à jour automatiquement.
      </p>

      <div style={{ display: "grid", gap: 14 }}>
        <section style={card}>
          <h2 style={h2}>Ajouter</h2>

          <form onSubmit={onSubmit} style={{ display: "grid", gap: 10 }}>
            <label style={label}>Ton nom</label>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Alex"
              style={input}
            />

            <label style={label}>Tu ramènes quoi</label>
            <input
              value={form.item}
              onChange={(e) => setForm((f) => ({ ...f, item: e.target.value }))}
              placeholder="Chips, houmous, dessert..."
              style={input}
            />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 10 }}>
              <div>
                <label style={label}>Quantité</label>
                <input
                  value={form.qty}
                  onChange={(e) => setForm((f) => ({ ...f, qty: e.target.value }))}
                  placeholder="2 paquets"
                  style={input}
                />
              </div>
              <div>
                <label style={label}>Note</label>
                <input
                  value={form.note}
                  onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                  placeholder="Sans gluten. j’arrive à 21h..."
                  style={input}
                />
              </div>
            </div>

            <button disabled={submitting} style={btn}>
              {submitting ? "Ajout..." : "Ajouter"}
            </button>

            {error ? <div style={{ color: "crimson" }}>{error}</div> : null}
          </form>
        </section>

        <section style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <h2 style={{ ...h2, margin: 0 }}>Liste</h2>
            <button
              onClick={() => fetchRows({ showSpinner: true })}
              disabled={refreshing}
              style={btn2}
            >
              {refreshing ? "Chargement..." : "Rafraîchir"}
            </button>
          </div>

          <div style={{ marginTop: 12 }}>
            {loading && rows.length === 0 ? (
              <p style={{ opacity: 0.7 }}>Chargement...</p>
            ) : grouped.length === 0 ? (
              <p style={{ opacity: 0.7 }}>Rien pour l’instant.</p>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {grouped.map((g) => (
                  <div key={g.item} style={{ padding: 12, border: "1px solid #eee", borderRadius: 12 }}>
                    <div style={{ fontWeight: 700 }}>{g.item}</div>
                    <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
                      {g.people.map((p, idx) => (
                        <li key={idx}>
                          <strong>{p.name || "Anonyme"}</strong>
                          {p.qty ? `, ${p.qty}` : ""}
                          {p.note ? ` . ${p.note}` : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

const card = { padding: 14, border: "1px solid #e5e5e5", borderRadius: 12 };
const h2 = { fontSize: 16, marginTop: 0 };
const label = { display: "block", marginBottom: 6, fontSize: 13, opacity: 0.8 };
const input = { width: "100%", padding: "10px 12px", border: "1px solid #ddd", borderRadius: 10, fontSize: 14 };
const btn = { padding: "10px 12px", border: "none", borderRadius: 10, fontSize: 14, cursor: "pointer" };
const btn2 = {
  padding: "8px 10px",
  border: "1px solid #ddd",
  borderRadius: 10,
  fontSize: 13,
  cursor: "pointer",
  background: "white",
  color: "black",
};
