"use client";

import { useEffect, useState } from "react";

const ACCENTS = [
  { key: "sky", color: "#7dd3fc", label: "Sky" },
  { key: "emerald", color: "#6ee7b7", label: "Emerald" },
  { key: "violet", color: "#c4b5fd", label: "Violet" },
  { key: "rose", color: "#fda4af", label: "Rose" },
  { key: "amber", color: "#fcd34d", label: "Amber" },
  { key: "orange", color: "#fdba74", label: "Orange" },
];

export default function ThemePicker() {
  const [accent, setAccent] = useState("sky");

  useEffect(() => {
    const saved = localStorage.getItem("futbol-accent");
    if (saved) {
      setAccent(saved);
      document.documentElement.setAttribute("data-accent", saved);
    }
  }, []);

  function pick(key: string) {
    setAccent(key);
    document.documentElement.setAttribute("data-accent", key);
    localStorage.setItem("futbol-accent", key);
  }

  return (
    <div className="flex items-center gap-2">
      {ACCENTS.map((a) => (
        <button
          key={a.key}
          onClick={() => pick(a.key)}
          aria-label={a.label}
          className={[
            "h-6 w-6 rounded-full border-2 transition",
            accent === a.key
              ? "border-white scale-110"
              : "border-transparent hover:scale-110",
          ].join(" ")}
          style={{ backgroundColor: a.color }}
        />
      ))}
    </div>
  );
}
