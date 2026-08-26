import { useEffect, useState } from "react";
import { getCurrentMember, NOT_AUTHORIZED } from "../lib/trelloApi.js";
import { successStyles as theme } from "../lib/ui.js";
import CheckIcon from "../ui/CheckIcon.jsx";

// No form here on purpose — colour/size are chosen per-cover in the editor,
// so this popup's only job is to confirm the board is connected. Same
// screen the member already saw right after authorizing.
export default function SettingsPopup({ t }) {
  const [status, setStatus] = useState("checking"); // checking | connected | error

  useEffect(() => {
    (async () => {
      try {
        // Round trip to Trello so a revoked token surfaces here rather than
        // as a mystery failure the first time someone sets a cover.
        await getCurrentMember(t);
        setStatus("connected");
      } catch (e) {
        if (e.message === NOT_AUTHORIZED) return requireAuth();
        setStatus("error");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function requireAuth() {
    return t.popup({
      title: "Authorize Card Cover",
      url: "./auth.html",
      height: 220,
    });
  }

  if (status === "checking") {
    return (
      <div style={{ ...theme.wrapper, ...theme.centered }}>
        <p style={theme.hint}>Checking connection…</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div style={{ ...theme.wrapper, ...theme.centered }}>
        <p style={{ fontSize: 12.5, color: "#F87168", margin: 0 }}>
          Couldn't check your connection. Try again in a moment.
        </p>
      </div>
    );
  }

  return (
    <div style={{ ...theme.wrapper, ...theme.centered }}>
      <div style={theme.iconCircle}>
        <CheckIcon />
      </div>
      <p style={theme.title}>You're connected</p>
      <p style={theme.body}>Card Cover can read and update covers on this board.</p>
      <button type="button" onClick={() => t.closePopup()} style={theme.button}>
        Done
      </button>
    </div>
  );
}