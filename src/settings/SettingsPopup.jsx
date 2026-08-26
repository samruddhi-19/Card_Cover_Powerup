import { useEffect, useState } from "react";
import { clearToken } from "../lib/auth.js";
import { getCurrentMember, NOT_AUTHORIZED, COVER_COLORS } from "../lib/trelloApi.js";
import { getSettings, saveSettings } from "../lib/settings.js";
import { styles } from "../lib/ui.js";

export default function SettingsPopup({ t }) {
  const [member, setMember] = useState(null);
  const [settings, setSettings] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      setSettings(await getSettings(t));
      try {
        // Round trip to Trello so a revoked token surfaces here rather than
        // as a mystery failure the first time someone sets a cover.
        setMember(await getCurrentMember(t));
      } catch (e) {
        if (e.message === NOT_AUTHORIZED) return requireAuth();
        setError(e.message);
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

  async function update(patch) {
    setSettings(await saveSettings(t, patch));
  }

  async function handleDisconnect() {
    await clearToken(t);
    t.closePopup();
  }

  if (!settings) return <div style={styles.wrapper}>Loading…</div>;

  return (
    <div style={styles.wrapper}>
      <label style={styles.label} htmlFor="defaultColor">
        Default cover colour
      </label>
      <select
        id="defaultColor"
        value={settings.defaultColor}
        onChange={(e) => update({ defaultColor: e.target.value })}
        style={select}
      >
        {COVER_COLORS.map((color) => (
          <option key={color} value={color}>
            {color}
          </option>
        ))}
      </select>

      <label style={{ ...styles.label, marginTop: 14 }} htmlFor="coverSize">
        Cover size
      </label>
      <select
        id="coverSize"
        value={settings.coverSize}
        onChange={(e) => update({ coverSize: e.target.value })}
        style={select}
      >
        <option value="normal">Normal</option>
        <option value="full">Full</option>
      </select>

      <p style={{ ...styles.body, marginTop: 16, marginBottom: 0 }}>
        {member ? `Connected as ${member.fullName} (@${member.username}).` : "Checking connection…"}
      </p>
      {error && <p style={styles.error}>{error}</p>}

      <button type="button" onClick={handleDisconnect} style={styles.subtleButton}>
        Disconnect Trello account
      </button>
    </div>
  );
}

const select = {
  width: "100%",
  padding: "7px 8px",
  borderRadius: 4,
  border: "1px solid #DFE1E6",
  fontSize: 13.5,
  boxSizing: "border-box",
};
