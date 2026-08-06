import { useEffect, useRef, useState } from "react";
import {
  APP_NAME,
  AUTH_MESSAGE_SOURCE,
  buildAuthorizeUrl,
  saveToken,
} from "../lib/auth.js";
import { styles } from "../lib/ui.js";

export default function AuthPopup({ t }) {
  const [status, setStatus] = useState("idle"); // idle | waiting | success | error
  const popupRef = useRef(null);

  // Listen for the token posted back by authorized.html once the member
  // approves access in the trello.com/1/authorize window.
  useEffect(() => {
    async function handleMessage(event) {
      // The token is a credential: only trust a message from our own origin.
      if (event.origin !== window.location.origin) return;
      if (!event.data || event.data.source !== AUTH_MESSAGE_SOURCE) return;

      if (!event.data.token) {
        setStatus("error");
        return;
      }

      try {
        await saveToken(t, event.data.token);
        setStatus("success");
        // Let Trello re-run `authorization-status` so the board picks up the
        // new token, then hand the member back to where they came from.
        setTimeout(redirectAfterConnect, 600);
      } catch {
        setStatus("error");
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function redirectAfterConnect() {
    // `redirect` is set by whichever popup bounced the member here, so a
    // member who clicked "Cover" lands back on the cover picker rather than
    // on a closed popup with no idea what happened.
    switch (t.arg("redirect")) {
      case "cover":
        return t.popup({ title: "Card Cover", url: "./cover.html", height: 320 });
      case "settings":
        return t.popup({
          title: "Card Cover Settings",
          url: "./settings.html",
          height: 300,
        });
      default:
        return t.closePopup();
    }
  }

  function handleAuthorize() {
    setStatus("waiting");
    const returnUrl = `${window.location.origin}/authorized.html`;
    popupRef.current = window.open(
      buildAuthorizeUrl(returnUrl),
      "trelloAuth",
      "width=520,height=720"
    );

    // A blocked popup would otherwise leave the member on "Waiting…" forever.
    if (!popupRef.current) setStatus("error");
  }

  const copy = {
    idle: `Connect your Trello account so ${APP_NAME} can read and update card covers on this board.`,
    waiting: "Waiting for you to approve access in the popup window…",
    success: "Connected. Closing…",
    error: "Couldn't connect. Check that popups are allowed, then try again.",
  };

  return (
    <div style={styles.wrapper}>
      <p style={styles.body}>{copy[status]}</p>
      <button
        type="button"
        onClick={handleAuthorize}
        disabled={status === "waiting" || status === "success"}
        style={{
          ...styles.button,
          ...(status === "waiting" ? styles.buttonBusy : {}),
        }}
      >
        {status === "success" ? "Connected ✓" : "Connect Trello Account"}
      </button>
      {status === "error" && (
        <button type="button" onClick={handleAuthorize} style={styles.subtleButton}>
          Try again
        </button>
      )}
    </div>
  );
}
