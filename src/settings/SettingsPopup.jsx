import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { getCurrentMember, NOT_AUTHORIZED } from "../lib/trelloApi.js";
import { getSettings, saveSettings } from "../lib/settings.js";
import { SpinnerIcon } from "../ui/icons.jsx";
import "./settings.css";

const SIZE_OPTIONS = [
  { value: "normal", label: "Standard" },
  { value: "full", label: "Full Bleed" },
];

function getInitials(member) {
  if (member?.initials) return member.initials.toUpperCase();
  if (member?.fullName) {
    const parts = member.fullName.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return member.fullName.slice(0, 2).toUpperCase();
  }
  if (member?.username) {
    return member.username.slice(0, 2).toUpperCase();
  }
  return "CC";
}

export default function SettingsPopup({ t }) {
  const [status, setStatus] = useState("checking"); // checking | connected | error
  const [member, setMember] = useState(null);
  const [coverSize, setCoverSize] = useState("normal");
  const [dynamicSync, setDynamicSync] = useState(true);
  const rootRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const [memberData, boardSettings] = await Promise.all([
          getCurrentMember(t),
          getSettings(t).catch(() => ({})),
        ]);
        setMember(memberData);
        if (boardSettings?.coverSize) setCoverSize(boardSettings.coverSize);
        if (typeof boardSettings?.dynamicSync === "boolean") {
          setDynamicSync(boardSettings.dynamicSync);
        }
        setStatus("connected");
      } catch (e) {
        if (e.message === NOT_AUTHORIZED) return requireAuth();
        setStatus("error");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Dynamically size the popup to fit the exact rendered content with zero scrollbar
  useLayoutEffect(() => {
    t.sizeTo("#root").catch(() => {});
  }, [t, status, member, coverSize, dynamicSync]);

  useEffect(() => {
    const el = document.getElementById("root");
    if (!el || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(() => {
      t.sizeTo("#root").catch(() => {});
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, [t]);

  function requireAuth() {
    return t.popup({
      title: "Authorize Card Cover",
      url: "./auth.html",
      height: 240,
    });
  }

  async function handleCoverSizeChange(newSize) {
    setCoverSize(newSize);
    try {
      await saveSettings(t, { coverSize: newSize });
    } catch {
      // silently retain state
    }
  }

  async function handleToggleDynamicSync() {
    const next = !dynamicSync;
    setDynamicSync(next);
    try {
      await saveSettings(t, { dynamicSync: next });
    } catch {
      // silently retain state
    }
  }

  if (status === "checking") {
    return (
      <div className="cc-settings-root">
        <div className="cc-center-box">
          <SpinnerIcon width={22} height={22} style={{ color: "#579DFF" }} />
          <p className="cc-hint-text">Checking connection…</p>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="cc-settings-root">
        <div className="cc-center-box">
          <p className="cc-error-text">
            Couldn't verify your connection.
          </p>
          <button
            type="button"
            className="cc-primary-btn"
            onClick={requireAuth}
          >
            Reconnect Account
          </button>
        </div>
      </div>
    );
  }

  const initials = getInitials(member);
  const displayName = member?.fullName || member?.username || "Connected User";
  const displayHandle = member?.username ? `@${member.username}` : "Trello Member";

  return (
    <div ref={rootRef} className="cc-settings-root">
      {/* Connected Member Status */}
      <div className="cc-settings-card">
        <div className="cc-avatar">
          {member?.avatarUrl ? (
            <img src={`${member.avatarUrl}/50.png`} alt={displayName} />
          ) : (
            <span>{initials}</span>
          )}
        </div>
        <div className="cc-member-info">
          <p className="cc-member-name">{displayName}</p>
          <p className="cc-member-sub">
            <span>{displayHandle}</span>
            <span>·</span>
            <span className="cc-status-badge">
              <span className="cc-status-dot" />
              Connected
            </span>
          </p>
        </div>
      </div>

      {/* Default Cover Size Preference */}
      <div className="cc-section">
        <label className="cc-section-label">Default Cover Size</label>
        <div className="cc-seg-control" role="radiogroup" aria-label="Default cover size">
          {SIZE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={coverSize === opt.value}
              className={`cc-seg-btn ${coverSize === opt.value ? "active" : ""}`}
              onClick={() => handleCoverSizeChange(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sync Preferences Toggle */}
      <div className="cc-section">
        <label className="cc-section-label">Sync Preferences</label>
        <div
          className="cc-toggle-row"
          onClick={handleToggleDynamicSync}
          role="switch"
          aria-checked={dynamicSync}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleToggleDynamicSync();
            }
          }}
        >
          <div className="cc-toggle-text">
            <p className="cc-toggle-title">Dynamic Sync</p>
            <p className="cc-toggle-desc">Auto-refresh covers on card changes</p>
          </div>
          <div className={`cc-switch ${dynamicSync ? "active" : ""}`}>
            <span className="cc-switch-thumb" />
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="cc-actions">
        <button
          type="button"
          onClick={() => t.closePopup()}
          className="cc-primary-btn"
        >
          Done
        </button>
        <button
          type="button"
          onClick={requireAuth}
          className="cc-subtle-link"
        >
          Switch or Reconnect Account
        </button>
      </div>
    </div>
  );
}