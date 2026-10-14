import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "../utils/api";

async function fetchHistoryPage(page) {
  return apiRequest(`/api/analysis?page=${page}&limit=10`);
}

function formatRiskLevel(level) {
  return ({ lower: "Low", moderate: "Moderate", elevated: "High", "very-high": "Very High" })[level] || level;
}

function HistoryPage() {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const loadPage = useCallback(async (nextPage) => {
    try {
      const data = await fetchHistoryPage(nextPage);
      setItems(data.items);
      setPage(data.page);
      setPages(data.pages || 1);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await fetchHistoryPage(page);
        if (!active) return;
        setItems(data.items);
        setPage(data.page);
        setPages(data.pages || 1);
      } catch (err) {
        if (active) setError(err.message);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [page]);

  async function openItem(id) {
    try { const data = await apiRequest(`/api/analysis/${id}`); setSelected(data.analysis); setError(""); }
    catch (err) { setError(err.message); }
  }

  async function removeItem(id) {
    if (!window.confirm("Delete this saved analysis?")) return;
    try {
      await apiRequest(`/api/analysis/${id}`, { method: "DELETE" });
      setSelected(null);
      setLoading(true);
      setError("");
      await loadPage(page);
    } catch (err) { setError(err.message); }
  }

  return (
    <main className="min-h-[70vh] bg-[#F8F5FC] px-5 py-12">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-3xl font-bold text-[#2E164B]">Your analysis history</h1>
        <p className="mt-2 text-sm text-slate-600">Saved records include scores, findings, recommendations, and time. Original messages and uploaded files are not stored.</p>
        {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {selected && <section className="mt-6 rounded-2xl border border-purple-200 bg-white p-5"><div className="flex items-start justify-between gap-3"><div><h2 className="text-xl font-bold text-[#2E164B]">Saved result · {selected.score}/100</h2><p className="mt-1 text-sm text-slate-500">{new Date(selected.createdAt).toLocaleString()} · {formatRiskLevel(selected.level)}</p></div><button onClick={() => setSelected(null)} className="text-sm font-semibold text-[#593580] underline">Close</button></div><ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-slate-700">{selected.findings.map((finding, i) => <li key={`${finding.category}-${i}`}><strong>{finding.category}:</strong> {finding.reason}</li>)}</ul>{selected.findings.length === 0 && <p className="mt-4 text-sm text-slate-600">No configured warning patterns were detected.</p>}{selected.recommendations?.length > 0 && <><h3 className="mt-5 font-semibold text-[#2E164B]">Recommended next steps</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">{selected.recommendations.map((item, i) => <li key={i}>{item}</li>)}</ul></>}<button onClick={() => removeItem(selected._id)} className="mt-5 rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700">Delete saved result</button></section>}
        {loading ? <p role="status" className="mt-8 text-slate-600">Loading saved results…</p> : items.length === 0 ? <p className="mt-8 rounded-2xl bg-white p-6 text-slate-600">No saved analyses yet. Analyze an offer and choose “Save to history”.</p> : <div className="mt-6 space-y-3">{items.map((item) => <article key={item._id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-purple-100 bg-white p-5"><div><p className="font-semibold text-[#2E164B]">{item.type[0].toUpperCase() + item.type.slice(1)} analysis · {item.score}/100</p><p className="mt-1 text-sm text-slate-500">{new Date(item.createdAt).toLocaleString()} · {item.findings.length} finding(s)</p></div><button onClick={() => openItem(item._id)} className="rounded-lg bg-[#2E164B] px-4 py-2 text-sm font-semibold text-white">Open result</button></article>)}</div>}
        {!loading && pages > 1 && <div className="mt-6 flex items-center justify-between"><button disabled={page <= 1} onClick={() => { setLoading(true); setError(""); setPage(page - 1); }} className="rounded-lg border border-purple-200 px-4 py-2 disabled:opacity-50">Previous</button><span className="text-sm text-slate-600">Page {page} of {pages}</span><button disabled={page >= pages} onClick={() => { setLoading(true); setError(""); setPage(page + 1); }} className="rounded-lg border border-purple-200 px-4 py-2 disabled:opacity-50">Next</button></div>}
      </div>
    </main>
  );
}

export default HistoryPage;
