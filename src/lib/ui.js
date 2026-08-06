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
