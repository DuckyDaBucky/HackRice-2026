"use client";

import { useEffect, useId, useRef, useState } from "react";
import { filterRoles } from "@/lib/roles";

interface Option {
  key: string;
  label: string;
  custom: boolean;
}

/**
 * Target-role combobox: focus with an empty field shows popular roles;
 * typing narrows to matches (popular grouping disappears); anything else
 * can be confirmed as a custom role. Free text is always preserved.
 */
export function RoleCombobox({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const query = value.trim();
  const typing = query.length > 0;
  const matches = filterRoles(value);
  const options: Option[] = matches.map((m) => ({ key: m.label, label: m.label, custom: false }));
  if (typing && !matches.some((m) => m.label.toLowerCase() === query.toLowerCase())) {
    options.push({ key: `custom:${query}`, label: `Use “${query}”`, custom: true });
  }

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  useEffect(() => {
    setHighlight(0);
  }, [value]);

  const choose = (option: Option) => {
    onChange(option.custom ? query : option.label);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
      <input
        id="target-role"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" && options.length > 0) {
            event.preventDefault();
            setOpen(true);
            setHighlight((h) => (h + 1) % options.length);
          } else if (event.key === "ArrowUp" && options.length > 0) {
            event.preventDefault();
            setHighlight((h) => (h - 1 + options.length) % options.length);
          } else if (event.key === "Enter" && open && options.length > 0) {
            event.preventDefault();
            choose(options[highlight] ?? options[0]!);
          } else if (event.key === "Escape") {
            setOpen(false);
          }
        }}
        placeholder="e.g. Backend engineer — pick a popular role or type your own"
        maxLength={160}
        autoComplete="off"
        className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-base text-zinc-100 shadow-[0_0_0_1px_rgba(56,189,248,0.15)] outline-none placeholder:text-zinc-600 focus:border-sky-500"
      />
      {open && options.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          aria-label={typing ? "Matching roles" : "Popular roles"}
          className="absolute z-20 mt-2 max-h-72 w-full overflow-auto rounded-xl border border-zinc-700 bg-zinc-950 p-1.5 shadow-2xl shadow-black/60"
        >
          <li aria-hidden="true" className="px-3 pt-1.5 pb-1 text-[11px] font-medium tracking-wide text-zinc-500 uppercase">
            {typing ? "Matching roles" : "Popular roles"}
          </li>
          {options.map((option, index) => (
            <li key={option.key} role="option" aria-selected={index === highlight}>
              <button
                type="button"
                onMouseDown={(event) => {
                  // Fire before the input's blur closes the list.
                  event.preventDefault();
                  choose(option);
                }}
                onMouseEnter={() => setHighlight(index)}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition ${index === highlight ? "bg-sky-500/15 text-zinc-50" : "text-zinc-300"}`}
              >
                <span>{option.label}</span>
                {option.custom && <span className="text-xs text-sky-400">Custom</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
