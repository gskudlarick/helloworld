import { useState } from "react";
import GreetingForm from "./components/GreetingForm";
import GreetingList from "./components/GreetingList";
import StatesList from "./components/StatesList";

const API_BASE = "/api";

export default function App() {
  const [greeting, setGreeting] = useState(null);
  const [error, setError] = useState(null);

  const fetchGreeting = async (name) => {
    setError(null);
    try {
      const url = name
        ? `${API_BASE}/hello?name=${encodeURIComponent(name)}`
        : `${API_BASE}/hello`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setGreeting(data);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white">
      <div className="mx-auto max-w-2xl px-4 py-16">
        <header className="mb-12 text-center">
          <h1 className="mb-2 text-5xl font-bold tracking-tight">
            Hello World
          </h1>
          <p className="text-lg text-slate-400">
            A modern full-stack greeting app
          </p>
        </header>

        <GreetingForm onSubmit={fetchGreeting} />

        {error && (
          <div
            role="alert"
            className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-300"
          >
            {error}
          </div>
        )}

        {greeting && (
          <div className="mt-6 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-6 py-4 text-center">
            <p className="text-2xl font-semibold text-emerald-300">
              {greeting.message}
            </p>
            <p className="mt-1 text-sm text-slate-400">
              Greeting #{greeting.id}
            </p>
          </div>
        )}

        <hr className="my-12 border-slate-700" />

        <GreetingList apiBase={API_BASE} />

        <hr className="my-12 border-slate-700" />

        <StatesList apiBase={API_BASE} />
      </div>
    </div>
  );
}
