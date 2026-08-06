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
  GRADIENTS,
  gradientCss,
  coverFileName,
} from "../lib/covers.js";
import { renderCover } from "../lib/coverRender.js";
import { readableInk } from "../ui/palette.js";
import {
  PaletteIcon,
  TextIcon,
  LayersIcon,
  ImageIcon,
  CheckIcon,
  SpinnerIcon,
  TrashIcon,
} from "../ui/icons.jsx";
import "./editor.css";

const TABS = [
  { id: "color", label: "Color", Icon: PaletteIcon },
  { id: "text", label: "Text", Icon: TextIcon },
  { id: "drag", label: "Drag Items", Icon: LayersIcon },
  { id: "image", label: "Image", Icon: ImageIcon },
];

const SIZE_OPTIONS = [
  { value: "normal", label: "Standard" },
  { value: "full", label: "Full bleed" },
];

const TEXT_OPTIONS = [
  { value: "dark", label: "Light text" },
  { value: "light", label: "Dark text" },
];

export default function CoverEditor({ t }) {
  const [tab, setTab] = useState("color");
  const [cardId, setCardId] = useState(null);
  const [cardName, setCardName] = useState("");
  const [hasCover, setHasCover] = useState(false);

  // `selection` is the pending choice; nothing is written until Apply.
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
        // first — a modal's own card context is not guaranteed to be
        // populated, and getting this wrong means applying the cover to the
        // wrong card, or to none at all.
        const argCardId = t.arg("cardId");
        if (argCardId) {
          setCardId(argCardId);
          setCardName(t.arg("cardName") || "");
          setHasCover(Boolean(t.arg("hasCover")));
        }

        // Still ask for the card, both as a fallback when the modal was
        // opened from somewhere that passed no args, and to pick up the
        // current size/brightness.
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
            return;
          }
        } catch {
          // No card context in this modal — the args above already covered it.
        }

        if (!argCardId) setError("Couldn't tell which card this is.");
        else setSize(settings.coverSize ?? "normal");
      } catch {
        setError("Couldn't load this card.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const previewStyle = selection
    ? {
        background:
          selection.kind === "gradient" ? gradientCss(selection) : selection.hex,
      }
    : undefined;

  async function handleApply() {
    if (!selection) return;
    // Without this, a missing card id would send the write to /cards/null and
    // fail with an opaque 400 rather than saying what's actually wrong.
    if (!cardId) {
      setError("No card to apply this to. Close and reopen the editor.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      // Native Trello colours apply instantly. Everything else has to be
      // rasterised and uploaded, because the cover API has no way to express
      // a custom hex or a gradient.
      if (selection.kind === "solid" && selection.trello) {
        setStatusText("Applying cover…");
        await setCardCover(t, cardId, {
          color: selection.trello,
          size,
          brightness,
        });
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
      await saveSettings(t, { dynamicSync });
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

  return (
    <div className="ce-root">
      <div
        className={`ce-preview ${selection ? "" : "ce-preview--empty"}`}
        style={previewStyle}
      >
        <div className="ce-preview__card">
          <span className="ce-preview__label">{cardName || "Card preview"}</span>
          {selection && (
            <span className="ce-preview__badge">
              {selection.kind === "solid" && selection.trello ? "Native" : "Upload"}
            </span>
          )}
        </div>
      </div>

      <div className="ce-toolbar">
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
              <Icon />
              {label}
            </button>
          ))}
        </div>

        <span className="ce-toolbar__spacer" />

        <div className={`ce-sync ${dynamicSync ? "ce-sync--on" : ""}`}>
          <span className="ce-sync__text">
            <span className="ce-sync__title" id="ce-sync-label">
              Dynamic sync: {dynamicSync ? "on" : "off"}
            </span>
            <br />
            <span className="ce-sync__hint">Auto-updates tags &amp; members</span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={dynamicSync}
            aria-labelledby="ce-sync-label"
            onClick={() => setDynamicSync((v) => !v)}
            className="ce-switch"
          />
        </div>
      </div>

      <div className="ce-body">
        {tab === "color" && (
          <div role="tabpanel" id="ce-panel-color" aria-labelledby="ce-tab-color">
            <section className="ce-section">
              <div className="ce-section__head">
                <h2 className="ce-section__title">Solid colors</h2>
                <span className="ce-section__rule" />
                <span className="ce-section__note">Palette presets</span>
              </div>
              <div className="ce-solids" role="radiogroup" aria-label="Solid colors">
                {SOLID_COLORS.map((color) => {
                  const checked =
                    selection?.kind === "solid" && selection.id === color.id;
                  return (
                    <button
                      key={color.id}
                      type="button"
                      role="radio"
                      aria-checked={checked}
                      aria-label={color.label}
                      disabled={busy}
                      onClick={() => setSelection({ kind: "solid", ...color })}
                      className="ce-solid"
                      style={{ background: color.hex, color: readableInk(color.hex) }}
                    >
                      <span className="ce-check">
                        <CheckIcon width={12} height={12} />
                      </span>
                      {/* Flags the slower path so the choice is informed. */}
                      {!color.trello && <span className="ce-badge-upload">Upload</span>}
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="ce-section">
              <div className="ce-section__head">
                <h2 className="ce-section__title">Gradient covers</h2>
                <span className="ce-section__rule" />
                <span className="ce-section__note">Rendered &amp; attached</span>
              </div>
              <div className="ce-gradients" role="radiogroup" aria-label="Gradient covers">
                {GRADIENTS.map((gradient) => {
                  const checked =
                    selection?.kind === "gradient" && selection.id === gradient.id;
                  return (
                    <button
                      key={gradient.id}
                      type="button"
                      role="radio"
                      aria-checked={checked}
                      disabled={busy}
                      onClick={() => setSelection({ kind: "gradient", ...gradient })}
                      className="ce-gradient"
                      style={{
                        background: gradientCss(gradient),
                        color: readableInk(gradient.stops[0]),
                      }}
                    >
                      <span className="ce-gradient__label">{gradient.label}</span>
                      <span className="ce-check">
                        <CheckIcon width={12} height={12} />
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          </div>
        )}

        {tab === "text" && (
          <div role="tabpanel" id="ce-panel-text" aria-labelledby="ce-tab-text">
            <section className="ce-section">
              <div className="ce-section__head">
                <h2 className="ce-section__title">Cover size</h2>
                <span className="ce-section__rule" />
              </div>
              <Segmented
                options={SIZE_OPTIONS}
                value={size}
                onChange={setSize}
                disabled={busy}
                label="Cover size"
              />
            </section>

            <section className="ce-section">
              <div className="ce-section__head">
                <h2 className="ce-section__title">Text contrast</h2>
                <span className="ce-section__rule" />
              </div>
              <Segmented
                options={TEXT_OPTIONS}
                value={brightness}
                onChange={setBrightness}
                disabled={busy}
                label="Text contrast"
              />
              <p className="ce-section__note" style={{ display: "block", marginTop: 10 }}>
                Applies to Trello colour covers. Uploaded images carry their own
                contrast.
              </p>
            </section>
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
                PNG or JPG. It's attached to the card and set as the cover.
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

        {tab === "drag" && (
          <div role="tabpanel" id="ce-panel-drag" aria-labelledby="ce-tab-drag">
            <div className="ce-placeholder">
              <LayersIcon width={24} height={24} />
              <span className="ce-placeholder__title">Drag Items</span>
              <span className="ce-placeholder__body">
                Not built yet — I wasn't sure what this should do. Tell me what
                gets dragged and where it lands, and I'll wire it up.
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="ce-footer">
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
          className={`ce-footer__status ${error ? "ce-footer__status--error" : ""}`}
          role="status"
          aria-live="polite"
        >
          {error || statusText}
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
          className="ce-btn ce-btn--primary"
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
