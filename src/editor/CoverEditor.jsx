import { useEffect, useRef, useState } from "react";
import {
  NOT_AUTHORIZED,
  clearCardCover,
  pruneGeneratedCovers,
  setCardCover,
  uploadCoverAttachment,
} from "../lib/trelloApi.js";
import { getSettings, saveSettings } from "../lib/settings.js";
import {
  SOLID_COLORS,
  TRELLO_COLORS,
  GRADIENTS,
  gradientCss,
  coverFileName,
} from "../lib/covers.js";
import { renderCover } from "../lib/coverRender.js";
import { readableInk } from "../ui/palette.js";
import {
  PaletteIcon,
  LayersIcon,
  TextIcon,
  ImageIcon,
  CheckIcon,
  SpinnerIcon,
  TrashIcon,
} from "../ui/icons.jsx";
import "./editor.css";

const TABS = [
  { id: "color", label: "Colour", Icon: PaletteIcon },
  { id: "gradient", label: "Gradient", Icon: LayersIcon },
  { id: "image", label: "Image", Icon: ImageIcon },
  { id: "text", label: "Text", Icon: TextIcon },
];

const SIZE_OPTIONS = [
  { value: "normal", label: "Standard" },
  { value: "full", label: "Full bleed" },
];

// Trello's `brightness` describes the *cover*, so brightness "dark" means
// light text sits on it. Labelled by what you'll see, not what the API calls it.
const TEXT_OPTIONS = [
  { value: "dark", label: "Light text" },
  { value: "light", label: "Dark text" },
];

export default function CoverEditor({ t }) {
  const [tab, setTab] = useState("color");
  const [cardId, setCardId] = useState(null);
  const [cardName, setCardName] = useState("");
  const [hasCover, setHasCover] = useState(false);

  // Pending choice. Nothing is written to the card until Apply.
  const [selection, setSelection] = useState(null);
  const [size, setSize] = useState("normal");
  const [brightness, setBrightness] = useState("dark");
  const [dynamicSync, setDynamicSync] = useState(true);

  const [busy, setBusy] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [error, setError] = useState("");
  const [dropActive, setDropActive] = useState(false);

  const fileRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const settings = await getSettings(t);
        setDynamicSync(settings.dynamicSync !== false);

        // The card-back section passes the card in explicitly. Trust that
        // first — a modal's own card context isn't guaranteed to be
        // populated, and getting it wrong means covering the wrong card.
        const argCardId = t.arg("cardId");
        if (argCardId) {
          setCardId(argCardId);
          setCardName(t.arg("cardName") || "");
          setHasCover(Boolean(t.arg("hasCover")));
        }

        try {
          const card = await t.card("id", "name", "cover");
          if (card?.id) {
            if (!argCardId) {
              setCardId(card.id);
              setCardName(card.name ?? "");
              setHasCover(Boolean(card.cover?.color || card.cover?.idAttachment));
            }
            setSize(card.cover?.size ?? settings.coverSize ?? "normal");
            setBrightness(card.cover?.brightness ?? "dark");
            // Preselect the card's current colour so the preview opens
            // showing where the card stands, not a blank slate.
            const current = TRELLO_COLORS.find((c) => c.trello === card.cover?.color);
            if (current) setSelection({ kind: "solid", ...current });
            return;
          }
        } catch {
          // No card context here — the args above already covered it.
        }

        if (!argCardId) setError("Couldn't tell which card this is.");
        else setSize(settings.coverSize ?? "normal");
      } catch {
        setError("Couldn't load this card.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const coverBackground = selection
    ? selection.kind === "gradient"
      ? gradientCss(selection)
      : selection.hex
    : null;

  async function handleApply() {
    if (!selection) return;
    if (!cardId) {
      setError("No card to apply this to. Close and reopen the editor.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      // Trello colours apply instantly. Everything else has to be rasterised
      // and attached, because the cover API can't express a custom hex or a
      // gradient at all.
      if (selection.trello) {
        setStatusText("Applying cover…");
        await setCardCover(t, cardId, { color: selection.trello, size, brightness });
        await pruneGeneratedCovers(t, cardId, null);
      } else {
        setStatusText("Rendering cover…");
        const blob = await renderCover(selection);
        setStatusText("Uploading cover…");
        const attachment = await uploadCoverAttachment(
          t,
          cardId,
          blob,
          coverFileName(selection)
        );
        setStatusText("Tidying up…");
        await pruneGeneratedCovers(t, cardId, attachment.id);
      }
      await saveSettings(t, { dynamicSync, coverSize: size });
      t.closeModal();
    } catch (e) {
      handleFailure(e, "Couldn't apply the cover.");
    } finally {
      setBusy(false);
      setStatusText("");
    }
  }

  async function handleRemove() {
    if (!cardId) return;
    setBusy(true);
    setError("");
    try {
      await clearCardCover(t, cardId);
      await pruneGeneratedCovers(t, cardId, null);
      t.closeModal();
    } catch (e) {
      handleFailure(e, "Couldn't remove the cover.");
    } finally {
      setBusy(false);
    }
  }

  async function handleImageFile(file) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("That file isn't an image.");
      return;
    }
    if (!cardId) {
      setError("No card to apply this to. Close and reopen the editor.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      setStatusText("Uploading image…");
      await uploadCoverAttachment(t, cardId, file, file.name);
      t.closeModal();
    } catch (e) {
      handleFailure(e, "Couldn't upload that image.");
    } finally {
      setBusy(false);
      setStatusText("");
    }
  }

  function handleFailure(e, fallback) {
    setError(e.message === NOT_AUTHORIZED ? "Reconnect your Trello account." : fallback);
  }

  const isFull = size === "full";

  return (
    <div
      className="ce-root"
      // Faint wash of the colour under consideration.
      style={{ "--ce-glow": selection ? `${selection.hex ?? selection.stops[0]}33` : "transparent" }}
    >
      <div className="ce-bar">
        <span className="ce-bar__title">Card cover</span>
        <span className="ce-bar__sub">{cardName}</span>
        <button
          type="button"
          className="ce-bar__close"
          onClick={() => t.closeModal()}
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      <div className="ce-split">
        <aside className="ce-aside">
          <div className={`ce-card ${isFull ? "ce-card--full" : ""}`}>
            <div
              className={`ce-card__cover ${coverBackground ? "" : "ce-card__cover--empty"}`}
              style={coverBackground ? { background: coverBackground } : undefined}
            >
              {isFull && (
                <span className="ce-card__title">{cardName || "Card title"}</span>
              )}
            </div>
            {!isFull && (
              <div className="ce-card__pad">
                <span className="ce-card__chip" />
                <span className="ce-card__title">{cardName || "Card title"}</span>
                <span className="ce-card__row">
                  <span>☰</span>
                  <span>69d</span>
                  <span className="ce-card__av">SB</span>
                </span>
              </div>
            )}
          </div>

          <div className="ce-caption">
            <span className="ce-caption__name">
              {selection ? selection.label : "No cover"}
            </span>
            <span className="ce-caption__meta">
              {isFull ? "full bleed" : "standard"}
              {selection ? (selection.trello ? " · instant" : " · attached") : ""}
            </span>
          </div>
        </aside>

        <main className="ce-main">
          <div className="ce-tabs" role="tablist" aria-label="Cover options">
            {TABS.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                role="tab"
                id={`ce-tab-${id}`}
                aria-selected={tab === id}
                aria-controls={`ce-panel-${id}`}
                onClick={() => setTab(id)}
                className="ce-tab"
              >
                <Icon width={13} height={13} />
                {label}
              </button>
            ))}
          </div>

          {tab === "color" && (
            <div role="tabpanel" id="ce-panel-color" aria-labelledby="ce-tab-color"
                 style={{ display: "grid", gap: 22 }}>
              <Swatches
                title="Trello colours"
                note="instant · no attachment"
                colors={TRELLO_COLORS}
                selection={selection}
                onSelect={setSelection}
                disabled={busy}
              />
              <Swatches
                title="Custom colours"
                note="rendered &amp; attached"
                colors={SOLID_COLORS}
                selection={selection}
                onSelect={setSelection}
                disabled={busy}
              />
            </div>
          )}

          {tab === "gradient" && (
            <div role="tabpanel" id="ce-panel-gradient" aria-labelledby="ce-tab-gradient"
                 className="ce-sec">
              <div className="ce-sec__head">
                <span className="ce-lbl">Gradient covers</span>
                <span className="ce-sec__rule" />
                <span className="ce-lbl">rendered &amp; attached</span>
              </div>
              {/* Shown on miniature cards rather than as chips — a name like
                  "Northern Lights" tells you nothing about the result. */}
              <div className="ce-gallery" role="radiogroup" aria-label="Gradient covers">
                {GRADIENTS.map((gradient) => (
                  <button
                    key={gradient.id}
                    type="button"
                    role="radio"
                    aria-checked={selection?.id === gradient.id}
                    disabled={busy}
                    onClick={() => setSelection({ kind: "gradient", ...gradient })}
                    className="ce-tile"
                  >
                    <span className="ce-tile__mini">
                      <span
                        className="ce-tile__cover"
                        style={{ background: gradientCss(gradient), display: "block" }}
                      />
                      <span className="ce-tile__body">
                        <span className="ce-tile__line" />
                        <span className="ce-tile__line ce-tile__line--short" />
                      </span>
                    </span>
                    <span className="ce-tile__name">{gradient.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {tab === "image" && (
            <div role="tabpanel" id="ce-panel-image" aria-labelledby="ce-tab-image">
              <div
                className={`ce-drop ${dropActive ? "ce-drop--active" : ""}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDropActive(true);
                }}
                onDragLeave={() => setDropActive(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDropActive(false);
                  handleImageFile(e.dataTransfer.files?.[0]);
                }}
              >
                <ImageIcon width={26} height={26} />
                <span className="ce-drop__title">Drop an image here</span>
                <span className="ce-drop__hint">
                  PNG or JPG. It's attached to the card and set as the cover
                  straight away — no need to press Apply.
                </span>
                <button
                  type="button"
                  className="ce-btn ce-btn--ghost"
                  onClick={() => fileRef.current?.click()}
                  disabled={busy}
                >
                  Choose file
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => handleImageFile(e.target.files?.[0])}
                />
              </div>
            </div>
          )}

          {tab === "text" && (
            <div role="tabpanel" id="ce-panel-text" aria-labelledby="ce-tab-text"
                 style={{ display: "grid", gap: 22 }}>
              <div className="ce-sec">
                <div className="ce-sec__head">
                  <span className="ce-lbl">Cover size</span>
                  <span className="ce-sec__rule" />
                </div>
                <Segmented
                  options={SIZE_OPTIONS}
                  value={size}
                  onChange={setSize}
                  disabled={busy}
                  label="Cover size"
                />
              </div>

              <div className="ce-sec">
                <div className="ce-sec__head">
                  <span className="ce-lbl">Text contrast</span>
                  <span className="ce-sec__rule" />
                </div>
                <Segmented
                  options={TEXT_OPTIONS}
                  value={brightness}
                  onChange={setBrightness}
                  disabled={busy}
                  label="Text contrast"
                />
                <span className="ce-lbl" style={{ letterSpacing: 0, textTransform: "none", fontSize: 11 }}>
                  Applies to Trello colour covers. Uploaded images carry their own contrast.
                </span>
              </div>
            </div>
          )}
        </main>
      </div>

      <div className="ce-foot">
        {hasCover && (
          <button
            type="button"
            className="ce-btn ce-btn--danger"
            onClick={handleRemove}
            disabled={busy}
          >
            <TrashIcon />
            Remove
          </button>
        )}
        <span
          className={`ce-foot__status ${error ? "ce-foot__status--error" : ""}`}
          role="status"
          aria-live="polite"
        >
          {error || statusText || (selection
            ? selection.trello
              ? `${selection.label} · applies instantly`
              : `${selection.label} · uploads an image`
            : "Pick a cover")}
        </span>
        <button
          type="button"
          className="ce-btn ce-btn--ghost"
          onClick={() => t.closeModal()}
          disabled={busy}
        >
          Cancel
        </button>
        <button
          type="button"
          className="ce-btn ce-btn--go"
          onClick={handleApply}
          disabled={busy || !selection || !cardId}
        >
          {busy && <SpinnerIcon />}
          Apply cover
        </button>
      </div>
    </div>
  );
}

function Swatches({ title, note, colors, selection, onSelect, disabled }) {
  return (
    <div className="ce-sec">
      <div className="ce-sec__head">
        <span className="ce-lbl">{title}</span>
        <span className="ce-sec__rule" />
        <span className="ce-lbl">{note}</span>
      </div>
      <div className="ce-swatches" role="radiogroup" aria-label={title}>
        {colors.map((color) => (
          <button
            key={color.id}
            type="button"
            role="radio"
            aria-checked={selection?.id === color.id}
            aria-label={color.label}
            title={color.label}
            disabled={disabled}
            onClick={() => onSelect({ kind: "solid", ...color })}
            className="ce-sw"
            style={{ background: color.hex, color: readableInk(color.hex) }}
          >
            <span className="ce-sw__check">
              <CheckIcon width={14} height={14} />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Segmented({ options, value, onChange, disabled, label }) {
  return (
    <div className="ce-seg" role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          disabled={disabled}
          onClick={() => onChange(option.value)}
          className="ce-seg__option"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
