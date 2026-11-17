/* Cache local : permet d'ouvrir l'application sans réseau.
   Stratégie « réseau d'abord » : dès qu'il y a du réseau, la dernière version est utilisée.
   Le cache ne sert que de secours hors connexion. */

var CACHE = "suivi-palettes-v28";
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
        fetch(evenement.request).then(function (reponse) {
            if (reponse && reponse.status === 200 && reponse.type === "basic") {
                var copie = reponse.clone();
                caches.open(CACHE).then(function (cache) {
                    cache.put(evenement.request, copie);
                });
            }
            return reponse;
        }).catch(function () {
            return caches.match(evenement.request).then(function (enCache) {
                return enCache || caches.match("./index.html");
            });
        })
    );
});
