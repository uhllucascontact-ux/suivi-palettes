/* Cache local : permet d'ouvrir l'application sans réseau après la première visite. */

var CACHE = "suivi-palettes-v4";
var FICHIERS = [
    "./",
    "./index.html",
    "./styles.css",
    "./app.js",
    "./xlsx.js",
    "./manifest.webmanifest",
    "./icons/icon-192.png",
    "./icons/icon-512.png",
    "./icons/apple-touch-icon.png"
];

self.addEventListener("install", function (evenement) {
    evenement.waitUntil(
        caches.open(CACHE).then(function (cache) {
            return cache.addAll(FICHIERS);
        }).then(function () {
            return self.skipWaiting();
        })
    );
});

self.addEventListener("activate", function (evenement) {
    evenement.waitUntil(
        caches.keys().then(function (cles) {
            return Promise.all(cles.filter(function (cle) {
                return cle !== CACHE;
            }).map(function (cle) {
                return caches.delete(cle);
            }));
        }).then(function () {
            return self.clients.claim();
        })
    );
});

self.addEventListener("fetch", function (evenement) {
    if (evenement.request.method !== "GET") return;

    evenement.respondWith(
        caches.match(evenement.request).then(function (reponse) {
            if (reponse) return reponse;

            return fetch(evenement.request).then(function (reseau) {
                if (reseau && reseau.status === 200 && reseau.type === "basic") {
                    var copie = reseau.clone();
                    caches.open(CACHE).then(function (cache) {
                        cache.put(evenement.request, copie);
                    });
                }
                return reseau;
            }).catch(function () {
                return caches.match("./index.html");
            });
        })
    );
});
