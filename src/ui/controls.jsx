import { useRef } from "react";
import { PALETTE, readableInk } from "./palette.js";
import { CheckIcon } from "./icons.jsx";

// ARIA radiogroups take a *single* tab stop, then arrow keys move between
// options — so a keyboard user tabs past the palette in one press instead of
// ten. That's the roving-tabindex pattern both controls below implement.
function useRovingRadio(values, value, onChange) {
  const ref = useRef(null);

  function onKeyDown(event) {
    const NEXT = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    const step = NEXT[event.key];

    if (step === undefined) {
      if (event.key === "Home" || event.key === "End") {
        event.preventDefault();
        const target = event.key === "Home" ? values[0] : values[values.length - 1];
        onChange(target);
        focusValue(target);
      }
      return;
    }

    event.preventDefault();
    const index = values.indexOf(value);
    // Wrap around, so the group never feels like it has dead ends.
    const next = values[(index + step + values.length) % values.length];
    onChange(next);
    focusValue(next);
  }

  function focusValue(next) {
    ref.current?.querySelector(`[data-value="${next}"]`)?.focus();
  }

  return { ref, onKeyDown };
}

export function SwatchGrid({ value, onChange, disabled, labelledBy }) {
  const values = PALETTE.map((c) => c.id);
  const { ref, onKeyDown } = useRovingRadio(values, value, onChange);

  return (
    <div
      ref={ref}
      className="cc-swatches"
      role="radiogroup"
      aria-labelledby={labelledBy}
      onKeyDown={onKeyDown}
    >
      {PALETTE.map((color) => {
        const selected = value === color.id;
        return (
          <button
            key={color.id}
            type="button"
            role="radio"
            data-value={color.id}
            aria-checked={selected}
            aria-label={color.label}
            // Only the selected option stays tabbable; the rest are reachable
            // with arrow keys once the group has focus.
            tabIndex={selected ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(color.id)}
            className="cc-swatch"
            style={{ background: color.hex, color: readableInk(color.hex) }}
          >
            <CheckIcon className="cc-swatch__check" />
          </button>
        );
      })}
    </div>
  );
}

export function Segmented({ options, value, onChange, disabled, labelledBy }) {
  const values = options.map((o) => o.value);
  const { ref, onKeyDown } = useRovingRadio(values, value, onChange);

  return (
    <div
      ref={ref}
      className="cc-seg"
      role="radiogroup"
      aria-labelledby={labelledBy}
      onKeyDown={onKeyDown}
    >
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            data-value={option.value}
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className="cc-seg__option"
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
