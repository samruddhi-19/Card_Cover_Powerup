/* global TrelloPowerUp */
import React from "react";
import ReactDOM from "react-dom/client";
import CoverStudio from "../ui/CoverStudio.jsx";

const t = TrelloPowerUp.iframe();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <CoverStudio t={t} />
  </React.StrictMode>
);
