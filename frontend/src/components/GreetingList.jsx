import { useEffect, useState } from "react";

export default function GreetingList({ apiBase }) {
  const [greetings, setGreetings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${apiBase}/greetings`)
      .then((res) => res.json())
      .then((data) => setGreetings(data))
      .catch(() => setGreetings([]))
      .finally(() => setLoading(false));
  }, [apiBase]);

  if (loading) {
    return <p className="text-center text-slate-400">Loading greetings...</p>;
  }

  if (greetings.length === 0) {
    return (
      <p className="text-center text-slate-400">
        Could not load greetings. Is the API running?
      </p>
    );
  }

  return (
    <div>
      <h2 className="mb-4 text-xl font-semibold text-slate-300">
        Greetings Around the World
      </h2>
      <ul className="space-y-2">
        {greetings.map((g) => (
          <li
            key={g.id}
            className="rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-3 transition hover:border-slate-600"
          >
            <span className="font-mono text-sm text-slate-500">#{g.id}</span>{" "}
            <span className="text-slate-200">{g.message}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
