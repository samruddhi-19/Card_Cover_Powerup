import { useEffect, useState } from "react";
import {
  COVER_COLORS,
  NOT_AUTHORIZED,
  clearCardCover,
  setCardCover,
} from "../lib/trelloApi.js";
import { getSettings } from "../lib/settings.js";
import { styles } from "../lib/ui.js";

// Baseline colour picker. It exists mainly to prove the whole chain end to
// end — connector -> auth -> stored token -> REST write -> card updates.
// Richer cover features hang off this same wiring.
export default function CoverPopup({ t }) {
  const [cardId, setCardId] = useState(null);
  const [current, setCurrent] = useState(null);
  const [size, setSize] = useState("normal");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const card = await t.card("id", "cover");
      setCardId(card.id);
      setCurrent(card.cover?.color ?? null);
      setSize((await getSettings(t)).coverSize);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function requireAuth() {
    return t.popup({
      title: "Authorize Card Cover",
      url: "./auth.html",
      height: 220,
      args: { redirect: "cover" },
    });
  }

  async function apply(color) {
    setBusy(true);
    setError("");
    try {
      if (color) {
        await setCardCover(t, cardId, { color, size, brightness: "dark" });
      } else {
        await clearCardCover(t, cardId);
      }
      setCurrent(color);
      t.closePopup();
    } catch (e) {
      if (e.message === NOT_AUTHORIZED) return requireAuth();
      setError("Couldn't update the cover. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!cardId) return <div style={styles.wrapper}>Loading…</div>;

  return (
    <div style={{ ...styles.wrapper, opacity: busy ? 0.6 : 1 }}>
      <span style={styles.label}>Cover colour</span>
      <div style={grid}>
        {COVER_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            title={color}
            aria-label={color}
            aria-pressed={current === color}
            disabled={busy}
            onClick={() => apply(color)}
            style={{
              ...swatch,
              background: SWATCH_HEX[color],
              outline: current === color ? "2px solid #0C66E4" : "none",
              outlineOffset: 2,
            }}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={() => apply(null)}
        disabled={busy || !current}
        style={{ ...styles.button, marginTop: 16, background: "#44546F" }}
      >
        Remove cover
      </button>

      {error && <p style={styles.error}>{error}</p>}
    </div>
  );
}

// Trello's own cover palette, so the swatches match what the card will
// actually look like once applied.
const SWATCH_HEX = {
  green: "#4BCE97",
  yellow: "#F5CD47",
  orange: "#FEA362",
  red: "#F87168",
  purple: "#9F8FEF",
  blue: "#579DFF",
  sky: "#6CC3E0",
  lime: "#94C748",
  pink: "#E774BB",
  black: "#8590A2",
};

const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(5, 1fr)",
  gap: 8,
};

const swatch = {
  height: 36,
  border: "none",
  borderRadius: 4,
  cursor: "pointer",
  padding: 0,
};
