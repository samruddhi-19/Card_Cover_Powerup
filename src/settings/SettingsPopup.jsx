import { useEffect, useLayoutEffect, useState } from "react";
import { getCurrentMember, NOT_AUTHORIZED } from "../lib/trelloApi.js";
import { CheckIcon, SpinnerIcon } from "../ui/icons.jsx";
import "./settings.css";

export default function SettingsPopup({ t }) {
  const [status, setStatus] = useState("checking"); // checking | connected | error

  useEffect(() => {
    (async () => {
      try {
        await getCurrentMember(t);
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
  }, [t, status]);

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
      height: 220,
    });
  }

  if (status === "checking") {
    return (
      <div className="cc-settings-root">
        <div className="cc-loading-state">
          <SpinnerIcon width={22} height={22} style={{ color: "#579DFF" }} />
          <p className="cc-hint-text">Checking connection…</p>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="cc-settings-root">
        <div className="cc-error-state">
          <p className="cc-error-text">Couldn't verify your connection.</p>
          <button
            type="button"
            className="cc-btn-primary"
            onClick={requireAuth}
          >
            Reconnect Account
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="cc-settings-root">
      <div className="cc-icon-badge">
        <CheckIcon width={24} height={24} strokeWidth={2.4} />
      </div>

      <h3 className="cc-title">You're connected</h3>
      <p className="cc-desc">
        Card Cover is authorized and ready to customize covers on this board.
      </p>

      <button
        type="button"
        onClick={() => t.closePopup()}
        className="cc-btn-primary"
      >
        Done
      </button>

      <button
        type="button"
        onClick={requireAuth}
        className="cc-link-subtle"
      >
        Switch or reconnect account
      </button>
    </div>
  );
}