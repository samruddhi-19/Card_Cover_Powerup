/* global TrelloPowerUp */
import React from "react";
import ReactDOM from "react-dom/client";
import CoverEditor from "./CoverEditor.jsx";

const t = TrelloPowerUp.iframe();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <CoverEditor t={t} />
  </React.StrictMode>
);
