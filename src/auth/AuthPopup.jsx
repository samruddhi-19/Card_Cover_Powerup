import { useEffect, useRef, useState } from "react";
import {
  APP_NAME,
  AUTH_MESSAGE_SOURCE,
  buildAuthorizeUrl,
  saveToken,
} from "../lib/auth.js";
import { styles, successStyles } from "../lib/ui.js";

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
        // Trello re-runs `authorization-status` on its own once the token
        // lands, so the board picks up the new state without our help. We
        // just show a clean confirmation and let the member decide when
        // they're done reading it, rather than yanking them into another
        // popup mid-sentence.
        setStatus("success");
      } catch {
        setStatus("error");
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  if (status === "success") {
    return (
      <div style={successStyles.wrapper}>
        <div style={successStyles.iconCircle}>
          <CheckIcon />
        </div>
        <p style={successStyles.title}>You're connected</p>
        <p style={successStyles.body}>
          {APP_NAME} can now read and update covers on this board.
        </p>
        <button
          type="button"
          onClick={() => t.closePopup()}
          style={successStyles.button}
        >
          Continue
        </button>
      </div>
    );
  }

  const copy = {
    idle: `Connect your Trello account so ${APP_NAME} can read and update card covers on this board.`,
    waiting: "Waiting for you to approve access in the popup window…",
    error: "Couldn't connect. Check that popups are allowed, then try again.",
  };

  return (
    <div style={styles.wrapper}>
      <p style={styles.body}>{copy[status]}</p>
      <button
        type="button"
        onClick={handleAuthorize}
        disabled={status === "waiting"}
        style={{
          ...styles.button,
          ...(status === "waiting" ? styles.buttonBusy : {}),
        }}
      >
        Connect Trello Account
      </button>
      {status === "error" && (
        <button type="button" onClick={handleAuthorize} style={styles.subtleButton}>
          Try again
        </button>
      )}
    </div>
  );
}

function CheckIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 12.5L9.5 17L19 7"
        stroke="#4BCE97"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}