(function () {
  // Trello redirects here as #token=XXXX after the member approves.
  var params = new URLSearchParams(window.location.hash.substring(1));
  var token = params.get("token");
  var el = document.getElementById("status");

  if (!token) {
    if (el) el.textContent = "Something went wrong — no token received. You can close this window.";
    return;
  }

  // Drop the token from the address bar so it can't leak via history,
  // a screenshot, or a copied URL.
  history.replaceState(null, "", window.location.pathname);

  if (window.opener) {
    // The opener (auth.html) is served from this same origin, so we can pin
    // the target instead of using "*". A token is a credential — it must
    // never be broadcast to whatever window happens to be listening.
    window.opener.postMessage(
      { source: "card-cover-auth", token: token },
      window.location.origin
    );
  }

  if (el) el.textContent = "Connected! Closing this window…";

  window.close();

  // If window.close() was blocked (some browsers refuse it), let the user
  // know it's safe to close manually instead of leaving them staring at
  // a message that never changes.
  setTimeout(function () {
    if (el) el.textContent = "Connected! You can close this window now.";
  }, 400);
})();
