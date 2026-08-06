import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { getSettings } from "../lib/settings.js";
import { swatchFor, labelFor, readableInk } from "./palette.js";
import { ImageIcon, PlusIcon, SwapIcon } from "./icons.jsx";
import "./cover.css";

// The card-back section is a summary plus two entry points. All editing
// happens in the modal (editor.html) — Trello popups are capped near 304px
// wide, which can't hold the palette + gradient layout.
const MODAL = {
  title: "Card Cover",
  url: "./editor.html",
  // Trello sets the modal's width itself; height is ours. Kept compact so the
  // editor reads as a focused panel rather than taking over the screen — the
  // right column scrolls if a tab needs more room.
  height: 520,
  // Trello renders the modal's title bar itself, outside this iframe, so no
  // CSS of ours can reach it. `accentColor` is the only lever: it sets that
  // bar's background, and Trello picks white title text against a dark one.
  // Matching the editor's own ground makes the bar read as part of the panel
  // instead of a washed-out strip above it.
  accentColor: "#1D2125",
};

export default function CoverStudio({ t }) {
  const [card, setCard] = useState(null);
  const [cover, setCover] = useState(null);
  const [phase, setPhase] = useState("loading"); // loading | ready | unauthorized

  const load = useCallback(async () => {
    try {
      const data = await t.card("id", "name", "cover");
      setCard({ id: data.id, name: data.name ?? "" });
      setCover(normalizeCover(data.cover));
      setPhase("ready");
    } catch {
      setPhase("ready");
    }
  }, [t]);

  useEffect(() => {
    load();
    // Trello calls this whenever the card changes, which is how the summary
    // catches up after the modal applies a cover and closes.
    t.render(() => load());
    getSettings(t).catch(() => {});
  }, [t, load]);

  // The card-back iframe keeps its initial height until we measure it.
  useLayoutEffect(() => {
    t.sizeTo("#root").catch(() => {});
  }, [t, phase, cover]);

  // The modal is its own iframe, so it can't rely on inheriting the card
  // context this section was rendered with. Passing the card explicitly is
  // what guarantees Apply writes to the card you actually opened.
  function openEditor() {
    return t.modal({
      ...MODAL,
      args: {
        cardId: card?.id,
        cardName: card?.name ?? "",
        hasCover: Boolean(cover),
      },
    });
  }

  if (phase === "loading") {
    return (
      <div className="cc-root">
        <div className="cc-skeleton" />
      </div>
    );
  }

  const swatch = cover?.color ? swatchFor(cover.color) : null;

  return (
    <div className="cc-root">
      <div className={`cc-panel ${cover ? "cc-panel--filled" : "cc-panel--empty"}`}>
        <div
          className={[
            "cc-thumb",
            cover ? "cc-thumb--filled" : "",
            cover?.size === "full" ? "cc-thumb--full" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          style={
            swatch
              ? { background: swatch.hex, color: readableInk(swatch.hex) }
              : cover?.image
                ? { backgroundImage: `url(${cover.image})`, backgroundSize: "cover" }
                : undefined
          }
        >
          {!cover && <ImageIcon width={20} height={20} />}
        </div>

        <div className="cc-panel__body">
          <p className="cc-panel__title">{describeTitle(cover)}</p>
          <p className="cc-panel__meta">
            {cover
              ? describeCover(cover)
              : "Add a colour, gradient or image cover to make this card easier to spot."}
          </p>
        </div>

        {/* Both actions stay on screen; emphasis shifts with state, and the
            inapplicable one greys out with a title explaining why. */}
        <div className="cc-panel__actions">
          <button
            type="button"
            className={`cc-btn ${cover ? "cc-btn--secondary" : "cc-btn--primary"}`}
            onClick={openEditor}
            disabled={Boolean(cover)}
            title={cover ? "This card already has a cover — use Edit Card Cover" : undefined}
          >
            <PlusIcon />
            Add Card Cover
          </button>
          <button
            type="button"
            className={`cc-btn ${cover ? "cc-btn--primary" : "cc-btn--secondary"}`}
            onClick={openEditor}
            disabled={!cover}
            title={!cover ? "Add a cover first" : undefined}
          >
            <SwapIcon />
            Edit Card Cover
          </button>
        </div>
      </div>
    </div>
  );
}

// Trello covers come in three shapes: a named colour, an uploaded/attached
// image, or nothing. Image covers are surfaced rather than misreported as
// "no cover".
function normalizeCover(raw) {
  if (!raw) return null;
  if (raw.idAttachment || raw.idUploadedBackground) {
    return {
      image: raw.scaled?.at(-1)?.url ?? raw.url ?? null,
      size: raw.size ?? "normal",
      brightness: raw.brightness,
    };
  }
  if (!raw.color) return null;
  return {
    color: raw.color,
    size: raw.size ?? "normal",
    brightness: raw.brightness ?? "dark",
  };
}

function describeTitle(cover) {
  if (!cover) return "No cover yet";
  return cover.image ? "Image cover" : `${labelFor(cover.color)} cover`;
}

function describeCover(cover) {
  const size = cover.size === "full" ? "Full bleed" : "Standard";
  const text = cover.brightness === "light" ? "dark text" : "light text";
  return `${size} · ${text}`;
}
