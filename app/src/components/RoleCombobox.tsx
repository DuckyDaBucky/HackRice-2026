"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { filterRoles } from "@/lib/roles";

interface Option {
  key: string;
  label: string;
  custom: boolean;
}

type ListPosition = {
  top: number;
  left: number;
  width: number;
};

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
  const [mounted, setMounted] = useState(false);
  const [listPosition, setListPosition] = useState<ListPosition | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const query = value.trim();
  const typing = query.length > 0;
  const matches = filterRoles(value);
  const options: Option[] = matches.map((m) => ({ key: m.label, label: m.label, custom: false }));
  if (typing && !matches.some((m) => m.label.toLowerCase() === query.toLowerCase())) {
    options.push({ key: `custom:${query}`, label: `Use “${query}”`, custom: true });
  }

  useEffect(() => {
    setMounted(true);
  }, []);

  const updateListPosition = () => {
    const input = inputRef.current;
    if (!input) return;
    const rect = input.getBoundingClientRect();
    setListPosition({
      top: rect.bottom + 8,
      left: rect.left,
      width: rect.width,
    });
  };

  useLayoutEffect(() => {
    if (!open) return;
    updateListPosition();
    const onLayoutChange = () => updateListPosition();
    window.addEventListener("resize", onLayoutChange);
    window.addEventListener("scroll", onLayoutChange, true);
    return () => {
      window.removeEventListener("resize", onLayoutChange);
      window.removeEventListener("scroll", onLayoutChange, true);
    };
  }, [open, value]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        const list = document.getElementById(listId);
        if (list?.contains(event.target as Node)) return;
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [listId]);

  useEffect(() => {
    setHighlight(0);
  }, [value]);

  const choose = (option: Option) => {
    onChange(option.custom ? query : option.label);
    setOpen(false);
  };

  const listbox =
    open && options.length > 0 && listPosition ? (
      <ul
        id={listId}
        role="listbox"
        aria-label={typing ? "Matching roles" : "Popular roles"}
        style={{
          top: listPosition.top,
          left: listPosition.left,
          width: listPosition.width,
        }}
        className="fixed z-[100] max-h-80 overflow-y-auto rounded-xl border border-[#e3e7ee] bg-white p-1.5 shadow-[0_12px_40px_rgba(15,23,42,0.12)] [color-scheme:light]"
      >
        <li
          aria-hidden="true"
          className="sticky top-0 bg-white px-3 pt-1.5 pb-1 text-[11px] font-medium tracking-wide text-[#93a1b5] uppercase"
        >
          {typing ? "Matching roles" : "Popular roles"}
        </li>
        {options.map((option, index) => (
          <li key={option.key} role="option" aria-selected={index === highlight}>
            <button
              type="button"
              onMouseDown={(event) => {
                event.preventDefault();
                choose(option);
              }}
              onMouseEnter={() => setHighlight(index)}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition-colors duration-150 ${
                index === highlight
                  ? "bg-[#f4f5f7] text-[#0b1120]"
                  : "text-[#6b7280] hover:bg-[#f9fafb] hover:text-[#0b1120]"
              }`}
            >
              <span>{option.label}</span>
              {option.custom && <span className="text-xs font-medium text-[#14b8a6]">Custom</span>}
            </button>
          </li>
        ))}
      </ul>
    ) : null;

  return (
    <div ref={rootRef} className="relative">
      <input
        ref={inputRef}
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
        onFocus={() => {
          setOpen(true);
          updateListPosition();
        }}
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
        className="h-12 w-full rounded-lg border border-dash-border-strong bg-white px-4 text-[15px] text-[#0b1120] shadow-sm outline-none placeholder:text-dash-text-faint focus:border-accent [color-scheme:light]"
      />
      {mounted && listbox ? createPortal(listbox, document.body) : null}
    </div>
  );
}
