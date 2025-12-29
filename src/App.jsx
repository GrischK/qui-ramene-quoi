import {useEffect, useMemo, useState} from "react";
import GoogleWord from "./GoogleWord.jsx";

function splitCSVLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0;
       i <
       line.length;
       i++) {
    const c = line[i];

    if (c ===
      '"') {
      if (inQuotes &&
        line[i +
        1] ===
        '"') {
        cur +=
          '"';
        i++;
      } else {
        inQuotes =
          !inQuotes;
      }
    } else if (c ===
      "," &&
      !inQuotes) {
      out.push(cur);
      cur =
        "";
    } else {
      cur +=
        c;
    }
  }
  out.push(cur);
  return out;
}

function parseCSV(text) {
  const lines = text.trim()
    .split(/\r?\n/);
  if (lines.length <=
    1) return [];

  const headers = splitCSVLine(lines[0])
    .map((h) => h.trim());
  const rows = lines.slice(1)
    .map((line) => {
      const values = splitCSVLine(line);
      const obj = {};
      headers.forEach((h,
                       i) => (obj[h] =
        (values[i] ??
          "").trim()));
      return obj;
    });

  return rows
    .filter((r) => r.name ||
      r.item)
    .map((r) => ({
      name: r.name ||
        "",
      item: r.item ||
        "",
      qty: r.qty ||
        "",
      note: r.note ||
        "",
      createdAt: r.createdAt ||
        "",
    }))
    .reverse();
}

function normalizeKey(r) {
  const norm = (v) => String(v ??
    "")
    .trim()
    .toLowerCase();
  return `${norm(r.name)}|${norm(r.item)}|${norm(r.qty)}|${norm(r.note)}`;
}

function sortByCreatedAtDesc(a,
                             b) {
  const ta = Date.parse(a.createdAt ||
      "") ||
    0;
  const tb = Date.parse(b.createdAt ||
      "") ||
    0;
  return tb -
    ta;
}

function cx(...classes) {
  return classes.filter(Boolean)
    .join(" ");
}

export default function App() {
  const CSV_URL = import.meta.env.VITE_SHEET_CSV_URL;
  const SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL;

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [titleDone, setTitleDone] = useState(false)

  const [form, setForm] = useState({name: "", item: "", qty: "", note: ""});

  async function fetchRows({showSpinner = false} = {}) {
    setError("");

    if (showSpinner) setRefreshing(true);
    if (rows.length ===
      0) setLoading(true);

    try {
      const url = `${CSV_URL}${CSV_URL.includes("?") ?
        "&" :
        "?"}t=${Date.now()}`;
      const res = await fetch(url, {cache: "no-store"});
      if (!res.ok) throw new Error("Lecture impossible. Vérifie l’URL CSV publiée.");
      const text = await res.text();

      const incoming = parseCSV(text);

      setRows((prev) => {
        const map = new Map();

        for (const r of
          incoming) map.set(normalizeKey(r), r);
        for (const r of
          prev) {
          const k = normalizeKey(r);
          if (!map.has(k)) map.set(k, r);
        }

        return Array.from(map.values())
          .sort(sortByCreatedAtDesc);
      });
    } catch (e) {
      setError(String(e.message ||
        e));
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

    for (const r of
      rows) {
      const key = r.item.toLowerCase()
        .trim();
      if (!key) continue;

      const prev = map.get(key) ||
        {
          item: r.item,
          qty: "",
          people: [],
        };

      // On garde la première quantité trouvée
      if (!prev.qty &&
        r.qty) {
        prev.qty =
          r.qty;
      }

      prev.people.push({
        name: r.name,
        note: r.note,
      });

      map.set(key, prev);
    }

    return Array.from(map.values())
      .sort((a,
             b) =>
        a.item.localeCompare(b.item, "fr")
      );
  }, [rows]);


  async function onSubmit(e) {
    e.preventDefault();
    setError("");

    if (!form.name.trim() ||
      !form.item.trim()) {
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
        headers: {"Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"},
        body,
      });

      const txt = await res.text();
      if (!res.ok ||
        txt.trim()
          .toLowerCase() !==
        "ok") {
        throw new Error(txt ||
          "Ajout impossible.");
      }

      const newRow = {
        name: form.name.trim(),
        item: form.item.trim(),
        qty: form.qty.trim(),
        note: form.note.trim(),
        createdAt: new Date().toISOString(),
      };

      setRows((prev) => [newRow,
        ...prev]);
      setForm((f) => ({...f, item: "", qty: "", note: ""}));

      setTimeout(() => fetchRows(), 1200);
    } catch (e2) {
      setError(String(e2.message ||
        e2));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-dvh bg-white text-zinc-900">
      <header className="border-b border-zinc-200">
        <div className="mx-auto max-w-5xl px-4 py-4">
          <GoogleWord text="Qui ramène quoi ?" onDone={() => setTitleDone(true)}/>
          <p className="mt-1 text-sm text-zinc-600">
            Ajoute ta participation. La liste se met à jour automatiquement.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="grid gap-6 lg:grid-cols-5">
          <section className="lg:col-span-2">
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-zinc-900">Ajouter</h2>
                <span className="text-xs text-zinc-500">Simple et rapide</span>
              </div>

              <form onSubmit={onSubmit} className="mt-4 grid gap-3">
                <Field label="Ton nom">
                  <input
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none ring-0 placeholder:text-zinc-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({...f, name: e.target.value}))}
                    placeholder="Alex"
                    autoComplete="name"
                  />
                </Field>

                <Field label="Tu ramènes quoi">
                  <input
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none placeholder:text-zinc-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                    value={form.item}
                    onChange={(e) => setForm((f) => ({...f, item: e.target.value}))}
                    placeholder="Raclette, bière, dessert..."
                  />
                </Field>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="sm:col-span-1">
                    <Field label="Quantité">
                      <input
                        className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none placeholder:text-zinc-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                        value={form.qty}
                        onChange={(e) => setForm((f) => ({...f, qty: e.target.value}))}
                        placeholder="2 paquets"
                      />
                    </Field>
                  </div>
                  <div className="sm:col-span-2">
                    <Field label="Note">
                      <input
                        className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none placeholder:text-zinc-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                        value={form.note}
                        onChange={(e) => setForm((f) => ({...f, note: e.target.value}))}
                        placeholder="Sans gluten, sans alcool..."
                      />
                    </Field>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className={cx(
                    "mt-1 inline-flex items-center justify-center rounded-xl px-3 py-2 text-sm font-medium",
                    "bg-blue-600 text-white shadow-sm hover:bg-blue-700",
                    "disabled:cursor-not-allowed disabled:opacity-60"
                  )}
                >
                  {submitting ?
                    "Ajout..." :
                    "Ajouter"}
                </button>

                {error ?
                  (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                      {error}
                    </div>
                  ) :
                  null}
              </form>
            </div>

            <div className="mt-3 text-xs text-zinc-500">
              Astuce : Mets ton prénom en premier. Exemple: “Alex”. Pas “Moi”.
            </div>
          </section>

          <section className="lg:col-span-3">
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-zinc-900">Liste</h2>
                  <p className="mt-1 text-xs text-zinc-500">
                    {loading &&
                    rows.length ===
                    0 ?
                      "Chargement..." :
                      `${rows.length} contribution(s)`}
                  </p>
                </div>

                <button
                  onClick={() => fetchRows({showSpinner: true})}
                  disabled={refreshing}
                  className={cx(
                    "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium",
                    "border border-blue-200 bg-blue-50 text-blue-700",
                    "hover:bg-blue-100 hover:border-blue-300",
                    "focus:outline-none focus:ring-2 focus:ring-blue-200",
                    "disabled:cursor-not-allowed disabled:opacity-60"
                  )}
                >
                  <span
                    className={cx(
                      "inline-block h-3.5 w-3.5 rounded-full border border-blue-300",
                      refreshing
                        ?
                        "animate-spin border-t-transparent"
                        :
                        "border-t-blue-300"
                    )}
                    aria-hidden="true"
                  />
                  {refreshing ?
                    "Actualisation..." :
                    "Rafraîchir"}
                </button>
              </div>

              <div className="mt-4">
                {loading &&
                rows.length ===
                0 ?
                  (
                    <SkeletonList/>
                  ) :
                  grouped.length ===
                  0 ?
                    (
                      <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3 text-sm text-zinc-600">
                        Rien pour l’instant.
                      </div>
                    ) :
                    (
                      <div className="grid gap-3">
                        {grouped.map((g) => (
                          <div key={g.item} className="
                          relative overflow-hidden rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-blue-500/20 shadow hover:shadow-md transition"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="text-sm font-semibold text-zinc-900">
                                {g.item}
                                {g.qty ?
                                  (
                                    <span className="ml-1 text-xs font-normal text-zinc-500">
                                      ({g.qty})
                                    </span>
                                  ) :
                                  null}
                              </div>
                              {/*<div className="text-xs text-zinc-500">{g.people.length} personne(s)</div>*/}
                            </div>
                            <ul className="mt-2 space-y-1.5">
                              {g.people.map((p,
                                             idx) => (
                                <li key={idx} className="text-sm text-zinc-700">
                                  <span className="font-semibold text-zinc-900">{p.name ||
                                    "Anonyme"}</span>
                                  {p.note ?
                                    <span className="text-zinc-600"> . {p.note}</span> :
                                    null}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    )}
              </div>
            </div>

            <footer className="mt-3 text-xs text-zinc-500">
              La liste se rafraîchit environ toutes les 15 secondes.
            </footer>
          </section>
        </div>
      </main>
    </div>
  );
}

function Field({label, children}) {
  return (
    <label className="grid gap-1">
      <span className="text-xs font-medium text-zinc-700">{label}</span>
      {children}
    </label>
  );
}

function SkeletonList() {
  return (
    <div className="grid gap-3">
      <div className="rounded-2xl border border-zinc-200 p-4">
        <div className="h-4 w-40 animate-pulse rounded bg-zinc-100"/>
        <div className="mt-3 space-y-2">
          <div className="h-3 w-2/3 animate-pulse rounded bg-zinc-100"/>
          <div className="h-3 w-1/2 animate-pulse rounded bg-zinc-100"/>
        </div>
      </div>
      <div className="rounded-2xl border border-zinc-200 p-4">
        <div className="h-4 w-32 animate-pulse rounded bg-zinc-100"/>
        <div className="mt-3 space-y-2">
          <div className="h-3 w-3/4 animate-pulse rounded bg-zinc-100"/>
          <div className="h-3 w-1/3 animate-pulse rounded bg-zinc-100"/>
        </div>
      </div>
    </div>
  );
}
