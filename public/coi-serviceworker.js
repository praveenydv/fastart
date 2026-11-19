/*! coi-serviceworker v0.1.7 - Guido Zuidhof, MIT (Enhanced for FastArt GitHub Pages) */
let coepCredentialless = true;
if (typeof window === 'undefined') {
  self.addEventListener("install", () => self.skipWaiting());
  self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

  self.addEventListener("message", (ev) => {
    if (!ev.data) return;
    if (ev.data.type === "deregister") {
      self.registration.unregister().then(() => self.clients.matchAll()).then((clients) => {
        clients.forEach((client) => client.navigate(client.url));
      });
    } else if (ev.data.type === "coepCredentialless") {
      coepCredentialless = ev.data.value;
    }
  });

  self.addEventListener("fetch", function (event) {
    const request = event.request;
    if (request.cache === "only-if-cached" && request.mode !== "same-origin") {
      return;
    }

    const coep = coepCredentialless ? "credentialless" : "require-corp";

    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.status === 0) {
            return response;
          }

          const newHeaders = new Headers(response.headers);
          newHeaders.set("Cross-Origin-Embedder-Policy", coep);
          newHeaders.set("Cross-Origin-Opener-Policy", "same-origin");

          return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: newHeaders,
          });
        })
        .catch((e) => console.error(e))
    );
  });
} else {
  (() => {
    // If the browser is already cross-origin isolated (e.g. local Metro server or host with COOP/COEP headers), skip
    if (window.crossOriginIsolated) {
      return;
    }

    const coi = {
      shouldRegister: () => true,
      shouldDeregister: () => false,
      coepCredentialless: () => true,
      doReload: () => window.location.reload(),
      quiet: false,
      ...window.coi,
    };

    if (navigator.serviceWorker) {
      if (coi.shouldDeregister()) {
        navigator.serviceWorker.controller &&
          navigator.serviceWorker.controller.postMessage({ type: "deregister" });
      }

      if (coi.shouldRegister()) {
        const scriptUrl = window.document.currentScript
          ? window.document.currentScript.src
          : "coi-serviceworker.js";
        navigator.serviceWorker.register(scriptUrl).then(
          (registration) => {
            !coi.quiet && console.log("[COI] Registered service worker for Cross-Origin Isolation:", registration.scope);

            registration.addEventListener("updatefound", () => {
              !coi.quiet && console.log("[COI] Service worker update found, reloading...");
              coi.doReload();
            });

            if (registration.active && !navigator.serviceWorker.controller) {
              !coi.quiet && console.log("[COI] Service worker active, reloading into Cross-Origin Isolated mode...");
              coi.doReload();
            }
          },
          (err) => {
            !coi.quiet && console.error("[COI] Service worker registration failed:", err);
          }
        );
      }
    }
  })();
}
