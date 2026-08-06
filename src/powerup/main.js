/* global TrelloPowerUp */
import { isAuthorized } from "../lib/auth.js";

const ICON = "https://cdn-icons-png.flaticon.com/512/1828/1828817.png";

TrelloPowerUp.initialize({
  // Trello calls this to decide whether to show the "Authorize" prompt.
  // It is derived from the stored token rather than a separate "authorized"
  // flag, so the two can never drift out of sync — if the token is gone
  // (revoked, cleared, never granted), we are simply not authorized.
  "authorization-status": async function (t) {
    return { authorized: await isAuthorized(t) };
  },

  "show-authorization": function (t) {
    return t.popup({
      title: "Authorize Card Cover",
      url: "./auth.html",
      height: 220,
    });
  },

  "show-settings": function (t) {
    return t.popup({
      title: "Card Cover Settings",
      url: "./settings.html",
      height: 300,
    });
  },

  "board-buttons": function () {
    return [
      {
        icon: { dark: ICON, light: ICON },
        text: "Card Cover",
        callback: function (t) {
          return t.popup({
            title: "Card Cover Settings",
            url: "./settings.html",
            height: 300,
          });
        },
      },
    ];
  },

  "card-buttons": function () {
    return [
      {
        icon: ICON,
        text: "Cover",
        callback: function (t) {
          return t.popup({
            title: "Card Cover",
            url: "./cover.html",
            height: 320,
          });
        },
      },
    ];
  },

  "card-detail-badges": async function (t) {
    const cover = await t.card("cover").then((card) => card.cover);
    if (!cover || !cover.color) return [];
    return [
      {
        title: "Cover",
        text: cover.color,
        color: null,
      },
    ];
  },
});
