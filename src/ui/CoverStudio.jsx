import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  NOT_AUTHORIZED,
  clearCardCover,
  setCardCover,
} from "../lib/trelloApi.js";
import { getSettings } from "../lib/settings.js";
import { swatchFor, labelFor, readableInk } from "./palette.js";
import { SwatchGrid, Segmented } from "./controls.jsx";
import {
  ImageIcon,
  PlusIcon,
  SwapIcon,
  TrashIcon,
  SpinnerIcon,
} from "./icons.jsx";
import "./cover.css";

const SIZE_OPTIONS = [
  { value: "normal", label: "Standard" },
  { value: "full", label: "Full bleed" },
];

const TEXT_OPTIONS = [
  { value: "dark", label: "Light text" },
  { value: "light", label: "Dark text" },
];

// Trello's `brightness` names the *cover* brightness, so "dark" cover means
// light text on it. The labels above are phrased from the member's point of
// view — what they'll see — rather than mirroring the API's wording.

export default function CoverStudio({ t }) {
  const [cardId, setCardId] = useState(null);
  const [cover, setCover] = useState(null); // committed cover, or null
  const [draft, setDraft] = useState(null); // pending edits while open
  const [defaults, setDefaults] = useState({ defaultColor: "blue", coverSize: "normal" });
  const [phase, setPhase] = useState("loading"); // loading | ready | unauthorized
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [announcement, setAnnouncement] = useState("");

  const editorRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const [card, settings] = await Promise.all([
          t.card("id", "cover"),
          getSettings(t),
        ]);
        setCardId(card.id);
        setCover(normalizeCover(card.cover));
        setDefaults(settings);
        setPhase("ready");
      } catch {
        setError("Couldn't load this card's cover.");
        setPhase("ready");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The card-back iframe has a fixed height until we tell Trello otherwise.
  // Re-measuring on every visual change is what lets the editor expand and
  // collapse without clipping or leaving a gap.
  useLayoutEffect(() => {
    t.sizeTo("#root").catch(() => {});
  }, [t, phase, editing, cover, error, busy]);

  const openEditor = useCallback(() => {
    setError("");
    setDraft(
      cover ?? {
        color: defaults.defaultColor,
        size: defaults.coverSize,
        brightness: "dark",
      }
    );
    setEditing(true);
    // Move focus into the editor so keyboard and screen-reader users follow
    // the expansion instead of being left on a button that changed meaning.
    requestAnimationFrame(() => {
      editorRef.current?.querySelector('[role="radio"][tabindex="0"]')?.focus();
    });
  }, [cover, defaults]);

  function closeEditor() {
    setEditing(false);
    setDraft(null);
  }

  async function handleSave() {
    setBusy(true);
    setError("");
    try {
      await setCardCover(t, cardId, draft);
      setCover(draft);
      setAnnouncement(`${labelFor(draft.color)} cover applied.`);
      closeEditor();
    } catch (e) {
      handleFailure(e, "Couldn't save the cover.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove() {
    setBusy(true);
    setError("");
    try {
      await clearCardCover(t, cardId);
      setCover(null);
      setAnnouncement("Cover removed.");
      closeEditor();
    } catch (e) {
      handleFailure(e, "Couldn't remove the cover.");
    } finally {
      setBusy(false);
    }
  }

  function handleFailure(e, fallback) {
    if (e.message === NOT_AUTHORIZED) {
      setPhase("unauthorized");
      return;
    }
    setError(fallback);
  }

  function connect() {
    return t.popup({
      title: "Authorize Card Cover",
      url: "./auth.html",
      height: 220,
    });
  }

  if (phase === "loading") {
    return (
      <div className="cc-root">
        <div className="cc-skeleton" />
      </div>
    );
  }

  if (phase === "unauthorized") {
    return (
      <div className="cc-root">
        <div className="cc-panel cc-panel--empty">
          <div className="cc-thumb">
            <ImageIcon width={20} height={20} />
          </div>
          <div className="cc-panel__body">
            <p className="cc-panel__title">Connect to manage covers</p>
            <p className="cc-panel__meta">
              Card Cover needs access to your Trello account before it can
              change covers.
            </p>
          </div>
          <div className="cc-panel__actions">
            <button type="button" className="cc-btn cc-btn--primary" onClick={connect}>
              Connect
            </button>
          </div>
        </div>
      </div>
    );
  }

  // While the editor is open the panel previews the *draft*, so choosing a
  // colour updates the thumbnail live — the picker and the preview are never
  // showing two different things.
  const preview = editing ? draft : cover;
  const swatch = preview?.color ? swatchFor(preview.color) : null;

  return (
    <div className="cc-root">
      <div className={`cc-panel ${cover ? "cc-panel--filled" : "cc-panel--empty"}`}>
        <div
          className={[
            "cc-thumb",
            swatch ? "cc-thumb--filled" : "",
            preview?.size === "full" ? "cc-thumb--full" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          style={
            swatch
              ? { background: swatch.hex, color: readableInk(swatch.hex) }
              : undefined
          }
        >
          {!swatch && <ImageIcon width={20} height={20} />}
        </div>

        <div className="cc-panel__body">
          <p className="cc-panel__title">
            {cover ? `${labelFor(cover.color)} cover` : "No cover yet"}
          </p>
          <p className="cc-panel__meta">
            {cover
              ? describeCover(cover)
              : "Add a colour cover to make this card easier to spot on the board."}
          </p>
        </div>

        <div className="cc-panel__actions">
          {cover ? (
            <>
              <button
                type="button"
                className="cc-btn cc-btn--secondary"
                onClick={editing ? closeEditor : openEditor}
                disabled={busy}
                aria-expanded={editing}
                aria-controls="cc-editor"
              >
                <SwapIcon />
                {editing ? "Close" : "Replace"}
              </button>
              <button
                type="button"
                className="cc-btn cc-btn--danger"
                onClick={handleRemove}
                disabled={busy}
                aria-label="Remove cover"
              >
                {busy ? <SpinnerIcon /> : <TrashIcon />}
              </button>
            </>
          ) : (
            <button
              type="button"
              className="cc-btn cc-btn--primary"
              onClick={editing ? closeEditor : openEditor}
              disabled={busy}
              aria-expanded={editing}
              aria-controls="cc-editor"
            >
              <PlusIcon />
              {editing ? "Close" : "Add cover"}
            </button>
          )}
        </div>
      </div>

      <div
        id="cc-editor"
        ref={editorRef}
        className={`cc-editor ${editing ? "cc-editor--open" : ""}`}
        // Hidden from assistive tech while collapsed, so a screen reader
        // doesn't wander into a palette that isn't visible.
        aria-hidden={!editing}
      >
        <div className="cc-editor__clip">
          <div className="cc-editor__inner" inert={editing ? undefined : ""}>
            <div className="cc-field">
              <span className="cc-label" id="cc-label-colour">
                Colour
              </span>
              <SwatchGrid
                labelledBy="cc-label-colour"
                value={draft?.color}
                onChange={(color) => setDraft((d) => ({ ...d, color }))}
                disabled={busy}
              />
            </div>

            <div className="cc-field">
              <span className="cc-label" id="cc-label-size">
                Size
              </span>
              <Segmented
                labelledBy="cc-label-size"
                options={SIZE_OPTIONS}
                value={draft?.size ?? "normal"}
                onChange={(size) => setDraft((d) => ({ ...d, size }))}
                disabled={busy}
              />
            </div>

            <div className="cc-field">
              <span className="cc-label" id="cc-label-text">
                Text
              </span>
              <Segmented
                labelledBy="cc-label-text"
                options={TEXT_OPTIONS}
                value={draft?.brightness ?? "dark"}
                onChange={(brightness) => setDraft((d) => ({ ...d, brightness }))}
                disabled={busy}
              />
            </div>

            <div className="cc-editor__footer">
              <span className="cc-spacer" />
              <button
                type="button"
                className="cc-btn cc-btn--ghost"
                onClick={closeEditor}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="cc-btn cc-btn--primary"
                onClick={handleSave}
                disabled={busy || !draft?.color}
              >
                {busy && <SpinnerIcon />}
                {cover ? "Save changes" : "Add cover"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <p className="cc-error" role="alert">
          {error}
        </p>
      )}

      <span className="cc-sr" role="status" aria-live="polite">
        {announcement}
      </span>
    </div>
  );
}

// Trello also supports image covers (from an attachment or Unsplash). This
// Power-Up only writes colour covers, so an image cover is surfaced as-is
// rather than silently misreported as "no cover".
function normalizeCover(raw) {
  if (!raw) return null;
  if (raw.idAttachment || raw.idUploadedBackground) {
    return { image: true, size: raw.size ?? "normal", brightness: raw.brightness };
  }
  if (!raw.color) return null;
  return {
    color: raw.color,
    size: raw.size ?? "normal",
    brightness: raw.brightness ?? "dark",
  };
}

function describeCover(cover) {
  if (cover.image) return "Image cover · replace it with a colour below";
  const size = cover.size === "full" ? "Full bleed" : "Standard";
  const text = cover.brightness === "light" ? "dark text" : "light text";
  return `${size} · ${text}`;
}
