import React, { useEffect, useRef, useState, useCallback } from "react";
import "../styles/participants-form.css";

type Props = {
  initial?: string[];
  onChange?: (names: string[]) => void;
  placeholder?: string;
};

export default function ParticipantsInput({
  initial = [],
  onChange = () => {},
  placeholder = "Use a comma to separate names.",
}: Props) {
  const [names, setNames] = useState<string[]>([]);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  // init from props once (avoid re-sync on each parent update)
  const didInitRef = useRef(false);
  useEffect(() => {
    if (didInitRef.current) return;
    if (initial.length) setNames(normalizeList(initial));
    didInitRef.current = true;
    // Intentionally only on mount; do not depend on `initial`
    // to avoid re-initializing when parent updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // bubble up whenever names change
  const handleChange = useCallback((newNames: string[]) => {
    onChange(newNames);
  }, [onChange]);

  useEffect(() => {
    handleChange(names);
  }, [names, handleChange]);

  function normalizeList(list: string[]) {
    // trim, remove empties, de-dupe (case-insensitive)
    const seen = new Set<string>();
    return list
      .map((s) => s.replace(/,+/g, " ").trim())
      .filter(Boolean)
      .filter((s) => {
        const key = s.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }

  function addFromString(str: string) {
    const items = str.split(",").map((s) => s.trim()).filter(Boolean);
    if (!items.length) return;
    setNames((prev) => normalizeList([...prev, ...items]));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "," || e.key === "Enter") {
      e.preventDefault();
      if (value.trim()) {
        addFromString(value);
        setValue("");
      }
    } else if (e.key === "Backspace" && value === "" && names.length) {
      // remove last chip on backspace if input empty
      e.preventDefault();
      removeAt(names.length - 1);
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData("text");
    if (text.includes(",")) {
      e.preventDefault();
      addFromString(text);
      setValue("");
    }
  }

  function removeAt(idx: number) {
    setNames((prev) => prev.filter((_, i) => i !== idx));
    // keep focus on the input for quick editing
    inputRef.current?.focus();
  }

  function handleBlur() {
    if (value.trim()) {
      addFromString(value);
      setValue("");
    }
  }

  return (
    <div className="participants-field">
      <label className="form-label">Participants</label>

      <div
        className="chips-input"
        onClick={() => inputRef.current?.focus()}
        role="group"
        aria-label="Participants"
      >
        {names.map((name, i) => (
          <span key={name.toLowerCase()} className="chip" aria-label={name}>
            <span className="chip-text">
              {name}
              {i === 0 && " (you)"}
            </span>
            <button
              type="button"
              className="chip-remove"
              aria-label={`Remove ${name}`}
              onClick={() => removeAt(i)}
            >
              ×
            </button>
          </span>
        ))}

        <input
          ref={inputRef}
          className="chips-input__control"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onBlur={handleBlur}
          placeholder={names.length === 0 ? placeholder : ""}
          aria-label="Add participant"
        />
      </div>
    </div>
  );
}
