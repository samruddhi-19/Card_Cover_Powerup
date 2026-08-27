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
import {
  renderCover,
  hasText,
  hasBadges,
  previewFontScale,
  BADGE,
} from "../lib/coverRender.js";
import { labelItems, memberItems, dueItem } from "../lib/cardItems.js";
import { readableInk } from "../ui/palette.js";
import {
  PaletteIcon,
  LayersIcon,
  TextIcon,
  ImageIcon,
  ClockIcon,
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

// Where a click — rather than a drag — puts the next badge. Walked in order,
// so clicking through the tray lays items out instead of stacking them.
const BADGE_SLOTS = [
  [26, 24], [26, 50], [26, 76],
  [62, 24], [62, 50], [62, 76],
  [44, 38], [44, 62],
];

// Eight is already a busy cover at 218px wide. Past that the badges overlap
// faster than they inform.
const MAX_BADGES = BADGE_SLOTS.length;

// Keeps a badge's whole body inside the cover, since x/y are its centre.
const clamp = (value, lo, hi) => Math.max(lo, Math.min(hi, value));
const clampX = (x) => clamp(x, 6, 94);
const clampY = (y) => clamp(y, 10, 90);

const SIZE_OPTIONS = [
  { value: "normal", label: "Standard" },
  { value: "full", label: "Full bleed" },
];

// Ink for text we render onto the cover ourselves — unrelated to Trello's
// `brightness`, which only governs how Trello draws the card title.
const INK_OPTIONS = [
  { value: "white", label: "White" },
  { value: "dark", label: "Dark" },
];

const ALIGN_OPTIONS = [
  { value: "left", label: "Left" },
  { value: "center", label: "Centre" },
  { value: "right", label: "Right" },
];

const ALIGN_TO_FLEX = { left: "flex-start", center: "center", right: "flex-end" };

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
  const [customHex, setCustomHex] = useState("#4C9AFF");
  const [text, setText] = useState({
    heading: "",
    subheading: "",
    size: 18,
    color: "white",
    align: "left",
  });

  // The card's own labels, members and due date — the tray is built from
  // these, never from placeholders.
  const [items, setItems] = useState({ labels: [], members: [], due: null });
  // What's been dropped on the cover: the tray item plus where it landed.
  const [badges, setBadges] = useState([]);
  const [badgeTarget, setBadgeTarget] = useState(false);

  const patchText = (patch) => setText((prev) => ({ ...prev, ...patch }));

  const fileRef = useRef(null);
  const coverRef = useRef(null);
  const draggingItem = useRef(null);

  const trayItems = [...items.labels, ...items.members, ...(items.due ? [items.due] : [])];
  const placedIds = new Set(badges.map((badge) => badge.id));

  function addBadge(item, x, y) {
    if (placedIds.has(item.id) || badges.length >= MAX_BADGES) return;
    setBadges((prev) => [...prev, { ...item, x: clampX(x), y: clampY(y) }]);
  }

  function removeBadge(id) {
    setBadges((prev) => prev.filter((badge) => badge.id !== id));
  }

  function moveBadge(id, x, y) {
    setBadges((prev) =>
      prev.map((badge) =>
        badge.id === id ? { ...badge, x: clampX(x), y: clampY(y) } : badge
      )
    );
  }

  // Click-to-place, and the keyboard path: a drag is not reachable without a
  // pointer, so every tray pill also toggles.
  function toggleBadge(item) {
    if (placedIds.has(item.id)) {
      removeBadge(item.id);
      return;
    }
    const taken = new Set(badges.map((badge) => `${badge.x}:${badge.y}`));
    const slot = BADGE_SLOTS.find(([x, y]) => !taken.has(`${x}:${y}`));
    if (slot) addBadge(item, slot[0], slot[1]);
  }

  /** Pointer position as a percentage of the cover, which is how badges are stored. */
  function pointToPercent(clientX, clientY) {
    const box = coverRef.current?.getBoundingClientRect();
    if (!box) return null;
    return {
      x: ((clientX - box.left) / box.width) * 100,
      y: ((clientY - box.top) / box.height) * 100,
    };
  }

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
          const card = await t.card(
            "id",
            "name",
            "cover",
            "labels",
            "members",
            "due",
            "dueComplete"
          );
          if (card?.id) {
            setItems({
              labels: labelItems(card.labels),
              members: memberItems(card.members),
              due: dueItem(card.due, card.dueComplete),
            });
            const existingHasCover = Boolean(
              card.cover?.color ||
              card.cover?.idAttachment ||
              card.cover?.idUploadedBackground ||
              card.cover?.url ||
              card.cover?.scaled?.length
            );
            setHasCover(existingHasCover);
            if (!argCardId) {
              setCardId(card.id);
              setCardName(card.name ?? "");
            }
            setSize(card.cover?.size ?? settings.coverSize ?? "normal");
            setBrightness(card.cover?.brightness ?? "dark");

            // Preselect the card's current colour or image so the preview opens
            // showing where the card stands, not a blank slate.
            const currentTrello = TRELLO_COLORS.find((c) => c.trello === card.cover?.color);
            if (currentTrello) {
              setSelection({ kind: "solid", ...currentTrello });
            } else if (card.cover?.color) {
              const currentSolid = SOLID_COLORS.find(
                (c) => c.hex?.toLowerCase() === card.cover.color?.toLowerCase() || c.id === card.cover.color
              );
              if (currentSolid) {
                setSelection({ kind: "solid", ...currentSolid });
              } else {
                setSelection({
                  kind: "solid",
                  id: `custom-${card.cover.color.replace(/^#/, "").toLowerCase()}`,
                  label: card.cover.color.toUpperCase(),
                  hex: card.cover.color,
                });
              }
            } else if (card.cover?.scaled?.length || card.cover?.url) {
              const imageUrl =
                card.cover.scaled?.at(-1)?.url || card.cover.scaled?.[0]?.url || card.cover.url;
              if (imageUrl) {
                setSelection({
                  kind: "image",
                  id: card.cover.idAttachment || "existing-cover",
                  label: "Current cover",
                  url: imageUrl,
                });
              }
            }
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

  const coverStyle = selection
    ? selection.kind === "gradient"
      ? { background: gradientCss(selection) }
      : selection.kind === "image"
        ? {
            backgroundImage: `url("${selection.dataUrl || selection.url}")`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }
        : { background: selection.hex }
    : undefined;

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
      // A Trello colour cover can't carry text — the API has no field for it,
      // and none for badges either. So the moment there's a heading, a
      // subheading or a single dropped item, even a native colour has to be
      // rendered and attached instead.
      const withText = hasText(text);
      const withBadges = hasBadges(badges);

      if (selection.trello && !withText && !withBadges) {
        // Prune *before* setting the colour, not after. A card whose cover is
        // currently a generated attachment keeps that attachment as its cover
        // otherwise, and the colour never takes.
        setStatusText("Applying cover…");
        await pruneGeneratedCovers(t, cardId, null);
        await setCardCover(t, cardId, { color: selection.trello, size, brightness });
      } else {
        setStatusText("Rendering cover…");
        const blob = await renderCover(selection, withText ? text : null, badges);
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

  function handleImageFile(file) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("That file isn't an image.");
      return;
    }
    setError("");
    const reader = new FileReader();
    reader.onload = () => {
      setSelection({
        kind: "image",
        id: `img-${Date.now()}`,
        label: file.name,
        file,
        dataUrl: reader.result,
      });
    };
    reader.onerror = () => {
      setError("Couldn't load that image.");
    };
    reader.readAsDataURL(file);
  }

  function handleFailure(e, fallback) {
    setError(e.message === NOT_AUTHORIZED ? "Reconnect your Trello account." : fallback);
  }

  const isFull = size === "full";
  const glowHex = selection?.hex ?? selection?.stops?.[0];

  return (
    <div
      className="ce-root"
      // Faint wash of the colour under consideration.
      style={{ "--ce-glow": glowHex ? `${glowHex}33` : "transparent" }}
    >
      {/* No header here on purpose: Trello renders its own "Card Cover" title
          bar with a close button above this iframe. Adding another one just
          stacks two headers and two ✕ buttons. */}
      <div className="ce-split">
        <aside className="ce-aside">
          <div className={`ce-card ${isFull ? "ce-card--full" : ""}`}>
            {/* The preview is the drop target: you aim at the thing you're
                changing, not at a separate canvas that stands in for it. */}
            <div
              ref={coverRef}
              className={[
                "ce-card__cover",
                selection ? "" : "ce-card__cover--empty",
                badgeTarget ? "ce-card__cover--target" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              style={coverStyle}
              // Which item is in the air is tracked in a ref rather than read
              // from dataTransfer: `getData` is blocked during dragover, and
              // custom MIME types aren't carried consistently across browsers.
              onDragOver={(e) => {
                if (!draggingItem.current) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "copy";
                setBadgeTarget(true);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget)) setBadgeTarget(false);
              }}
              onDrop={(e) => {
                const item = draggingItem.current;
                if (!item) return;
                e.preventDefault();
                setBadgeTarget(false);
                const point = pointToPercent(e.clientX, e.clientY);
                if (point) addBadge(item, point.x, point.y);
              }}
            >
              {isFull && (
                <span className="ce-card__title">{cardName || "Card title"}</span>
              )}
              {hasText(text) && <PreviewText text={text} width={218} />}

              {/* Thirds, shown only while something is in the air — enough to
                  line badges up against, gone the moment you've dropped. */}
              <span className="ce-card__guides" aria-hidden="true" />

              {badges.map((badge) => (
                <PreviewBadge
                  key={badge.id}
                  badge={badge}
                  width={218}
                  onMove={moveBadge}
                  onRemove={removeBadge}
                  toPercent={pointToPercent}
                />
              ))}
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
              {selection
                ? selection.trello && !hasText(text) && !hasBadges(badges)
                  ? " · instant"
                  : " · attached"
                : ""}
            </span>
          </div>

          {/* Cover size lives beside the preview rather than in a tab: it
              changes the shape of the thing you're looking at, so the control
              belongs next to the result. */}
          <Segmented
            options={SIZE_OPTIONS}
            value={size}
            onChange={setSize}
            disabled={busy}
            label="Cover size"
          />
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
              <CustomPicker
                value={customHex}
                onChange={setCustomHex}
                onPick={setSelection}
                selection={selection}
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
                <span className="ce-drop__title">
                  {selection?.kind === "image" ? "Change image" : "Drop an image here"}
                </span>
                <span className="ce-drop__hint">
                  {selection?.kind === "image"
                    ? `Selected: ${selection.label}. Preview it on the left, add text or items in the Text tab, and click Apply cover when ready.`
                    : "PNG, JPG or WebP. Preview it on the left, add text or items in the Text tab, and click Apply cover."}
                </span>
                <button
                  type="button"
                  className="ce-btn ce-btn--ghost"
                  onClick={() => fileRef.current?.click()}
                  disabled={busy}
                >
                  {selection?.kind === "image" ? "Choose another file" : "Choose file"}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    handleImageFile(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </div>
            </div>
          )}

          {tab === "text" && (
            <div role="tabpanel" id="ce-panel-text" aria-labelledby="ce-tab-text"
                 style={{ display: "grid", gap: 18 }}>
              <p className="ce-note">
                <TextIcon className="ce-note__icon" width={15} height={15} />
                <span>
                  <b>Write cover text.</b> Headings, notes or sprint labels are
                  drawn straight onto the cover image — so any card with text
                  becomes an attached cover, not a plain colour.
                </span>
              </p>

              <label className="ce-field">
                <span className="ce-lbl">Cover heading</span>
                <input
                  type="text"
                  className="ce-input"
                  value={text.heading}
                  disabled={busy}
                  maxLength={60}
                  placeholder="Sprint 24 · Design"
                  onChange={(e) => patchText({ heading: e.target.value })}
                />
              </label>

              <label className="ce-field">
                <span className="ce-lbl">Subheading</span>
                <input
                  type="text"
                  className="ce-input"
                  value={text.subheading}
                  disabled={busy}
                  maxLength={90}
                  placeholder="Ships Friday"
                  onChange={(e) => patchText({ subheading: e.target.value })}
                />
              </label>

              {trayItems.length === 0 ? (
                <p className="ce-empty">
                  This card has no labels, members or due date yet. Add some on
                  the card and they'll show up here.
                </p>
              ) : (
                <>
                  <Tray
                    title="Labels"
                    items={items.labels}
                    placedIds={placedIds}
                    onToggle={toggleBadge}
                    onDragItem={(item) => (draggingItem.current = item)}
                    disabled={busy}
                    full={badges.length >= MAX_BADGES}
                  />
                  <Tray
                    title="People"
                    note="initials, not photos"
                    items={items.members}
                    placedIds={placedIds}
                    onToggle={toggleBadge}
                    onDragItem={(item) => (draggingItem.current = item)}
                    disabled={busy}
                    full={badges.length >= MAX_BADGES}
                  />
                  <Tray
                    title="Due date"
                    items={items.due ? [items.due] : []}
                    placedIds={placedIds}
                    onToggle={toggleBadge}
                    onDragItem={(item) => (draggingItem.current = item)}
                    disabled={busy}
                    full={badges.length >= MAX_BADGES}
                  />

                  <p className="ce-picker__note">
                    Drag onto the preview, or click to place. Drag a badge to
                    move it, click it to take it off.
                    {badges.length >= MAX_BADGES &&
                      ` ${MAX_BADGES} is the limit — remove one to add another.`}
                  </p>
                </>
              )}

              <div className="ce-duo">
                <div className="ce-field">
                  <span className="ce-lbl">
                    Size · <span className="ce-range__value">{text.size}px</span>
                  </span>
                  <input
                    type="range"
                    className="ce-range"
                    min={12}
                    max={40}
                    step={1}
                    value={text.size}
                    disabled={busy}
                    aria-label={`Text size, ${text.size} pixels`}
                    onChange={(e) => patchText({ size: Number(e.target.value) })}
                  />
                </div>

                <div className="ce-field">
                  <span className="ce-lbl">Text colour</span>
                  <Segmented
                    options={INK_OPTIONS}
                    value={text.color}
                    onChange={(color) => patchText({ color })}
                    disabled={busy}
                    label="Text colour"
                  />
                </div>
              </div>

              <div className="ce-field">
                <span className="ce-lbl">Alignment</span>
                <Segmented
                  options={ALIGN_OPTIONS}
                  value={text.align}
                  onChange={(align) => patchText({ align })}
                  disabled={busy}
                  label="Text alignment"
                />
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
          {error || statusText || describeOutcome(selection, text, badges)}
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

// Says what pressing Apply will actually do. The distinction matters: a
// Trello colour on its own is instant and leaves no attachment, while text or
// a single badge turns the same colour into an uploaded image.
function describeOutcome(selection, text, badges) {
  if (!selection) return "Pick a cover";

  const extras = [];
  if (hasText(text)) extras.push("text");
  if (hasBadges(badges)) {
    extras.push(`${badges.length} ${badges.length === 1 ? "item" : "items"}`);
  }

  if (selection.trello && extras.length === 0) {
    return `${selection.label} · applies instantly`;
  }
  return extras.length
    ? `${selection.label} + ${extras.join(" + ")} · uploads an image`
    : `${selection.label} · uploads an image`;
}

// One group of the tray. Pills hug their own text and wrap, so six labels
// take two lines instead of six.
function Tray({ title, note, items, placedIds, onToggle, onDragItem, disabled, full }) {
  if (items.length === 0) return null;

  return (
    <div className="ce-sec">
      <div className="ce-sec__head">
        <span className="ce-lbl">{title}</span>
        <span className="ce-sec__rule" />
        {note && <span className="ce-lbl">{note}</span>}
      </div>
      <div className="ce-pills">
        {items.map((item) => {
          const placed = placedIds.has(item.id);
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={placed}
              // A full cover shouldn't grey out what's already on it — you
              // still need to click those to take them off.
              disabled={disabled || (full && !placed)}
              draggable={!disabled}
              onDragStart={(e) => {
                onDragItem(item);
                // Firefox refuses to start a drag unless something is set.
                e.dataTransfer.setData("text/plain", item.id);
                e.dataTransfer.effectAllowed = "copy";
              }}
              onDragEnd={() => onDragItem(null)}
              onClick={() => onToggle(item)}
              className={`ce-pill ce-pill--${item.kind}`}
              style={{
                "--ce-tint": item.color,
                "--ce-tint-ink": item.ink,
              }}
              title={placed ? "On the cover — click to remove" : "Drag onto the cover, or click"}
            >
              <span className="ce-pill__dot">
                {item.kind === "member" && item.text}
                {item.kind === "due" && <ClockIcon width={13} height={13} />}
              </span>
              <span>{item.kind === "member" ? item.name : item.text}</span>
              <CheckIcon className="ce-pill__check" width={12} height={12} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

// A badge on the miniature. Sizes come from the same BADGE table the canvas
// renderer uses, scaled to the preview, so what you place is what you get.
function PreviewBadge({ badge, width, onMove, onRemove, toPercent }) {
  const scale = previewFontScale(width);
  const moved = useRef(false);

  const isMember = badge.kind === "member";
  const size = {
    fontSize: BADGE.font * scale,
    left: `${badge.x}%`,
    top: `${badge.y}%`,
    background: badge.color,
    color: badge.ink,
  };

  return (
    <span
      className={`ce-badge ce-badge--${badge.kind}`}
      style={
        isMember
          ? {
              ...size,
              fontSize: BADGE.avatarFont * scale,
              width: BADGE.avatar * scale,
              height: BADGE.avatar * scale,
            }
          : {
              ...size,
              height: BADGE.height * scale,
              padding: `0 ${BADGE.padX * scale}px`,
              gap: BADGE.gap * scale,
            }
      }
      role="button"
      tabIndex={0}
      title="Drag to move · click to remove"
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        moved.current = false;
      }}
      onPointerMove={(e) => {
        if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
        const point = toPercent(e.clientX, e.clientY);
        if (!point) return;
        // A click that drifts a pixel is still a click; only a real drag
        // should suppress the remove.
        if (Math.abs(point.x - badge.x) > 0.6 || Math.abs(point.y - badge.y) > 0.6) {
          moved.current = true;
        }
        onMove(badge.id, point.x, point.y);
      }}
      onPointerUp={() => {
        if (!moved.current) onRemove(badge.id);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onRemove(badge.id);
        }
      }}
    >
      {badge.kind === "due" && <ClockIcon width={BADGE.icon * scale} height={BADGE.icon * scale} />}
      <span>{badge.kind === "label" ? badge.text.toUpperCase() : badge.text}</span>
    </span>
  );
}

// Mirrors what coverRender draws, at the preview's scale, so the miniature is
// a faithful reduction rather than an approximation.
function PreviewText({ text, width }) {
  const scale = previewFontScale(width);
  const ink = text.color === "dark" ? "#172B4D" : "#FFFFFF";
  const shadow =
    text.color === "dark"
      ? "0 1px 3px rgba(255,255,255,.45)"
      : "0 1px 3px rgba(0,0,0,.42)";

  return (
    <span
      className="ce-card__text"
      style={{
        textAlign: text.align,
        alignItems: ALIGN_TO_FLEX[text.align],
        color: ink,
        textShadow: shadow,
      }}
    >
      {text.heading.trim() && (
        <b style={{ fontSize: text.size * scale }}>{text.heading}</b>
      )}
      {text.subheading.trim() && (
        <span style={{ fontSize: text.size * scale * 0.62 }}>{text.subheading}</span>
      )}
    </span>
  );
}

const HEX_RE = /^#?([0-9a-f]{6})$/i;

function CustomPicker({ value, onChange, onPick, selection, disabled }) {
  const [draft, setDraft] = useState(value);
  const [bad, setBad] = useState(false);

  // Keeps the text field in step when the colour well is dragged.
  useEffect(() => {
    setDraft(value);
    setBad(false);
  }, [value]);

  function commit(raw) {
    const match = HEX_RE.exec(raw.trim());
    if (!match) {
      setBad(true);
      return;
    }
    setBad(false);
    apply(`#${match[1].toUpperCase()}`);
  }

  function apply(hex) {
    onChange(hex);
    // id feeds the uploaded filename, so it has to survive the prune regex
    // (`card-cover-<slug>.png`) — hence the hex without its leading #.
    onPick({
      kind: "solid",
      id: `custom-${hex.slice(1).toLowerCase()}`,
      label: hex.toUpperCase(),
      hex,
    });
  }

  const active = selection?.id === `custom-${value.slice(1).toLowerCase()}`;

  return (
    <div className="ce-sec">
      <div className="ce-sec__head">
        <span className="ce-lbl">Your own colour</span>
        <span className="ce-sec__rule" />
        <span className="ce-lbl">{active ? "selected" : "any hex"}</span>
      </div>
      <div className="ce-picker">
        <span className="ce-picker__well" style={{ background: value }}>
          <input
            type="color"
            className="ce-picker__input"
            value={value}
            disabled={disabled}
            aria-label="Pick a custom colour"
            onChange={(e) => apply(e.target.value.toUpperCase())}
          />
        </span>
        <div className="ce-picker__fields">
          <input
            type="text"
            className={`ce-picker__hex ${bad ? "ce-picker__hex--bad" : ""}`}
            value={draft}
            disabled={disabled}
            spellCheck="false"
            aria-label="Hex colour"
            aria-invalid={bad}
            onChange={(e) => {
              const val = e.target.value;
              setDraft(val);
              const match = HEX_RE.exec(val.trim());
              if (match) {
                setBad(false);
                apply(`#${match[1].toUpperCase()}`);
              }
            }}
            onBlur={(e) => commit(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit(e.currentTarget.value);
            }}
          />
          <span className={`ce-picker__note ${bad ? "ce-picker__note--bad" : ""}`}>
            {bad ? "Needs six hex digits, e.g. #4C9AFF" : "Rendered and attached, exactly as picked"}
          </span>
        </div>
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
