import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { getSettings } from "../lib/settings.js";
import { swatchFor, labelFor, readableInk } from "./palette.js";
import {
  ImageIcon,
  PlusIcon,
  SwapIcon,
  AlertTriangleIcon,
  RefreshIcon,
  CheckIcon,
  SpinnerIcon,
} from "./icons.jsx";
import {
  getCoverMeta,
  detectCoverChanges,
  quickSyncCover,
} from "../lib/syncDetector.js";
import "./cover.css";

// The card-back section is a summary plus two entry points. All editing
// happens in the modal (editor.html) — Trello popups are capped near 304px
// wide, which can't hold the palette + gradient layout.
const MODAL = {
  title: "Card Cover",
  url: "./editor.html",
  height: 620,
  accentColor: "#1D2125",
};

export default function CoverStudio({ t }) {
  const [card, setCard] = useState(null);
  const [cover, setCover] = useState(null);
  const [fullCardData, setFullCardData] = useState(null);
  const [coverMeta, setCoverMeta] = useState(null);
  const [changeInfo, setChangeInfo] = useState({ hasChanges: false, changes: [] });
  const [dismissed, setDismissed] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncedJustNow, setSyncedJustNow] = useState(false);
  const [syncError, setSyncError] = useState("");
  const [phase, setPhase] = useState("loading"); // loading | ready | unauthorized

  const load = useCallback(async () => {
    try {
      const data = await t.card(
        "id",
        "name",
        "cover",
        "labels",
        "members",
        "due",
        "dueComplete"
      );
      setCard({ id: data.id, name: data.name ?? "" });
      setFullCardData(data);
      setCover(normalizeCover(data.cover));

      const meta = await getCoverMeta(t);
      setCoverMeta(meta);

      if (meta && meta.badges && meta.badges.length > 0) {
        const changes = detectCoverChanges(data, meta);
        setChangeInfo(changes);
      } else {
        setChangeInfo({ hasChanges: false, changes: [] });
      }

      setPhase("ready");
    } catch {
      setPhase("ready");
    }
  }, [t]);

  useEffect(() => {
    load();
    t.render(() => load());
    getSettings(t).catch(() => {});
  }, [t, load]);

  // Adjust iframe height whenever cover state, change alert or sync status changes
  useLayoutEffect(() => {
    t.sizeTo("#root").catch(() => {});
  }, [t, phase, cover, changeInfo, dismissed, syncedJustNow, syncing]);

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

  async function handleQuickSync() {
    if (!card?.id || !coverMeta || syncing) return;
    setSyncing(true);
    setSyncError("");
    try {
      const updatedMeta = await quickSyncCover(t, card.id, coverMeta, fullCardData);
      setCoverMeta(updatedMeta);
      setChangeInfo({ hasChanges: false, changes: [] });
      setSyncedJustNow(true);
      setTimeout(() => {
        setSyncedJustNow(false);
      }, 3500);
    } catch (e) {
      console.error("Failed to quick sync cover", e);
      setSyncError("Couldn't sync automatically. Try opening the editor.");
    } finally {
      setSyncing(false);
    }
  }

  if (phase === "loading") {
    return (
      <div className="cc-root">
        <div className="cc-skeleton" />
      </div>
    );
  }

  const swatch = cover?.color ? swatchFor(cover.color) : null;
  const showWarning =
    changeInfo.hasChanges &&
    !dismissed &&
    cover &&
    coverMeta?.badges?.length > 0;

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

        <div className="cc-panel__actions">
          {cover ? (
            <button
              type="button"
              className="cc-btn cc-btn--primary"
              onClick={openEditor}
            >
              <SwapIcon />
              Edit Card Cover
            </button>
          ) : (
            <button
              type="button"
              className="cc-btn cc-btn--primary"
              onClick={openEditor}
            >
              <PlusIcon />
              Add Card Cover
            </button>
          )}
        </div>
      </div>

      {syncedJustNow && (
        <div className="cc-alert cc-alert--success">
          <div className="cc-alert__icon">
            <CheckIcon width={15} height={15} />
          </div>
          <div className="cc-alert__content">
            <p className="cc-alert__title">Cover updated</p>
            <p className="cc-alert__desc">
              Cover badges were refreshed with current card details.
            </p>
          </div>
        </div>
      )}

      {showWarning && (
        <div className="cc-alert cc-alert--warning">
          <div className="cc-alert__icon">
            <AlertTriangleIcon width={16} height={16} />
          </div>
          <div className="cc-alert__content">
            <div className="cc-alert__header">
              <span className="cc-alert__title">Cover out of date</span>
              <span className="cc-alert__badge">Card changed</span>
            </div>
            <p className="cc-alert__desc">
              {changeInfo.changes.map((c) => c.detail).join(" · ") ||
                "Due date, labels, or people changed on this card."}
            </p>
          </div>

          <div className="cc-alert__actions">
            <button
              type="button"
              className="cc-btn cc-btn--sm cc-btn--sync"
              onClick={handleQuickSync}
              disabled={syncing}
              title="Re-render cover with latest card details"
            >
              {syncing ? (
                <SpinnerIcon width={13} height={13} />
              ) : (
                <RefreshIcon width={13} height={13} />
              )}
              <span>{syncing ? "Syncing…" : "Sync Cover"}</span>
            </button>

            <button
              type="button"
              className="cc-btn cc-btn--sm cc-btn--secondary"
              onClick={openEditor}
            >
              Review
            </button>

            <button
              type="button"
              className="cc-alert__close"
              onClick={() => setDismissed(true)}
              aria-label="Dismiss warning"
              title="Dismiss warning"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {syncError && (
        <div className="cc-alert cc-alert--error">
          <p className="cc-alert__desc">{syncError}</p>
        </div>
      )}
    </div>
  );
}

// Trello covers come in three shapes: a named colour, an uploaded/attached
// image, or nothing. Image covers are surfaced rather than misreported as
// "no cover".
function normalizeCover(raw) {
  if (!raw) return null;
  if (raw.idAttachment || raw.idUploadedBackground || raw.url || raw.scaled?.length) {
    return {
      image: raw.scaled?.at(-1)?.url ?? raw.url ?? null,
      size: raw.size ?? "normal",
      brightness: raw.brightness ?? "dark",
      color: raw.color ?? null,
    };
  }
  if (raw.color) {
    return {
      color: raw.color,
      size: raw.size ?? "normal",
      brightness: raw.brightness ?? "dark",
    };
  }
  return null;
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
