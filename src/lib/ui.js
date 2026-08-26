// Shared popup styling, so every popup reads as one Power-Up rather than
// four separately-styled screens.

export const styles = {
  wrapper: {
    fontFamily: "-apple-system, 'Segoe UI', Helvetica, Arial, sans-serif",
    padding: "16px",
    boxSizing: "border-box",
  },
  body: { fontSize: 13.5, color: "#44546F", marginBottom: 14, lineHeight: 1.45 },
  label: {
    display: "block",
    fontSize: 12,
    fontWeight: 600,
    color: "#44546F",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  button: {
    width: "100%",
    padding: "9px 14px",
    borderRadius: 6,
    border: "none",
    background: "#0C66E4",
    color: "#fff",
    fontSize: 13.5,
    fontWeight: 600,
    cursor: "pointer",
  },
  buttonBusy: { opacity: 0.7, cursor: "default" },
  subtleButton: {
    marginTop: 10,
    background: "none",
    border: "none",
    color: "#44546F",
    fontSize: 12,
    textDecoration: "underline",
    cursor: "pointer",
    padding: 0,
  },
  error: { fontSize: 12.5, color: "#C9372C", marginTop: 10 },
};

// A dedicated dark theme shown once authorization succeeds and reused by
// Settings — a clean, unified look rather than the light popup flashing
// dark. Matches the modal's own accentColor (#1D2125) so it reads as a
// deliberate screen rather than a mismatch against Trello's dark chrome.
export const successStyles = {
  wrapper: {
    fontFamily: "-apple-system, 'Segoe UI', Helvetica, Arial, sans-serif",
    background: "#1D2125",
    minHeight: "100%",
    boxSizing: "border-box",
    padding: "20px",
    display: "flex",
    flexDirection: "column",
  },
  centered: {
    alignItems: "center",
    textAlign: "center",
    padding: "28px 20px 24px",
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: "50%",
    background: "rgba(31,132,90,0.18)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  title: { fontSize: 15, fontWeight: 500, color: "#F7F8F9", margin: "0 0 4px" },
  body: { fontSize: 13, color: "#9FADBC", margin: "0 0 20px", lineHeight: 1.5 },
  button: {
    width: "100%",
    padding: "9px 14px",
    borderRadius: 6,
    border: "none",
    background: "#579DFF",
    color: "#091E42",
    fontSize: 13.5,
    fontWeight: 600,
    cursor: "pointer",
  },
  label: {
    display: "block",
    fontSize: 12,
    fontWeight: 600,
    color: "#9FADBC",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  select: {
    width: "100%",
    padding: "7px 8px",
    borderRadius: 4,
    border: "1px solid #454F59",
    background: "#22272B",
    color: "#F7F8F9",
    fontSize: 13.5,
    boxSizing: "border-box",
  },
  hint: { fontSize: 12.5, color: "#8C9BAB", lineHeight: 1.5, margin: 0 },
  link: {
    marginTop: 10,
    background: "none",
    border: "none",
    color: "#85B8FF",
    fontSize: 12,
    textDecoration: "underline",
    cursor: "pointer",
    padding: 0,
  },
};