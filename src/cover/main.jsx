/* global TrelloPowerUp */
import React from "react";
import ReactDOM from "react-dom/client";
import CoverPopup from "./CoverPopup.jsx";

const t = TrelloPowerUp.iframe();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <CoverPopup t={t} />
  </React.StrictMode>
);
