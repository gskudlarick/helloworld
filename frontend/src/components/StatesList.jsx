import { useEffect, useState } from "react";

export default function StatesList({ apiBase }) {
  const [states, setStates] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const url = search
      ? `${apiBase}/states?search=${encodeURIComponent(search)}`
      : `${apiBase}/states`;

    fetch(url)
      .then((res) => res.json())
      .then((data) => setStates(data))
      .catch(() => setStates([]))
      .finally(() => setLoading(false));
  }, [apiBase, search]);

  return (
    <div>
      <h2 className="mb-4 text-xl font-semibold text-slate-300">
        US States
        <span className="ml-2 text-sm font-normal text-slate-500">
          ({states.length} results)
        </span>
      </h2>

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search states..."
        aria-label="Search states"
        className="mb-4 w-full rounded-lg border border-slate-600 bg-slate-800 px-4 py-3 text-white placeholder-slate-500 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
      />

      {loading ? (
        <p className="text-center text-slate-400">Loading states...</p>
      ) : states.length === 0 ? (
        <p className="text-center text-slate-400">No states found.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-700">
          <table className="w-full text-left">
            <thead className="bg-slate-800">
              <tr>
                <th className="px-4 py-3 text-sm font-medium text-slate-400">Abbr</th>
                <th className="px-4 py-3 text-sm font-medium text-slate-400">State</th>
                <th className="px-4 py-3 text-sm font-medium text-slate-400">Capital</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {states.map((s) => (
                <tr key={s.id} className="transition hover:bg-slate-800/50">
                  <td className="px-4 py-2 font-mono text-sm text-emerald-400">{s.abbreviation}</td>
                  <td className="px-4 py-2 text-slate-200">{s.name}</td>
                  <td className="px-4 py-2 text-slate-400">{s.capital}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
