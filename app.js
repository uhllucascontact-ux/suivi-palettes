/* Application mobile de test — enregistrement local sur le téléphone.
   Aucune donnée n'est envoyée sur Internet : seul l'export par mail sort du téléphone. */

(function () {
    "use strict";

    var CLE = "suiviPalettes.v1";

    var LIEUX = ["H1", "H8", "H9", "H12", "H13", "Exped", "Plateforme", "Béton",
        "Rack kasto", "Arrivage", "Exped H13", "Mag Sig", "Mag adv", "Brocho", "PM"];

    var ENGINS = ["BAUMANN", "FENWICK"];

    var donnees = {
        version: 1,
        mouvements: [],
        dernierEngin: "BAUMANN",
        dernierExport: null
    };

    var saisie = { depart: null, arrivee: null, engin: "BAUMANN" };
    var periode = "jour";
    var recherche = "";

    // ---------------------------------------------------------------- stockage

    function charger() {
        try {
            var brut = localStorage.getItem(CLE);
            if (!brut) return;
            var lu = JSON.parse(brut);
            if (!lu || !Array.isArray(lu.mouvements)) return;
            donnees.version = 1;
            donnees.mouvements = lu.mouvements;
            donnees.dernierEngin = lu.dernierEngin === "FENWICK" ? "FENWICK" : "BAUMANN";
            donnees.dernierExport = lu.dernierExport || null;
        } catch (e) {
            console.warn("Données illisibles", e);
        }
    }

    function sauver() {
        try {
            localStorage.setItem(CLE, JSON.stringify(donnees));
            return true;
        } catch (e) {
            afficherToast("Mémoire pleine : exportez puis videz les données.", true);
            return false;
        }
    }

    // ---------------------------------------------------------------- utilitaires

    function deux(n) { return n < 10 ? "0" + n : String(n); }

    function iso(maintenant) {
        var d = maintenant || new Date();
        return d.getFullYear() + "-" + deux(d.getMonth() + 1) + "-" + deux(d.getDate()) +
            "T" + deux(d.getHours()) + ":" + deux(d.getMinutes()) + ":" + deux(d.getSeconds());
    }

    function jourDe(ts) { return ts.substring(0, 10); }

    function jourAujourdhui() { return iso().substring(0, 10); }

    function dateLisible(ts) {
        var p = ts.substring(0, 10).split("-");
        return p[2] + "/" + p[1] + "/" + p[0];
    }

    function heureLisible(ts) { return ts.substring(11, 19); }

    function echapper(texte) {
        return String(texte).replace(/&/g, "&amp;").replace(/</g, "&lt;")
            .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }

    function estModifie(m) { return !!m.modifie; }

    function trierRecents(liste) {
        return liste.slice().sort(function (a, b) { return a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0; });
    }

    function trierAnciens(liste) {
        return liste.slice().sort(function (a, b) { return a.ts > b.ts ? 1 : a.ts < b.ts ? -1 : 0; });
    }

    function aujourdHui() {
        return donnees.mouvements.filter(function (m) { return jourDe(m.ts) === jourAujourdhui(); });
    }

    var toastMinuteur = null;

    function afficherToast(texte, erreur) {
        var el = document.getElementById("toast");
        el.textContent = texte;
        el.className = "toast" + (erreur ? " erreur" : "");
        clearTimeout(toastMinuteur);
        toastMinuteur = setTimeout(function () { el.className = "toast cache"; }, 4000);
    }

    // ---------------------------------------------------------------- feuille

    var fermerFeuilleCallback = null;

    function ouvrirFeuille(titre, construireContenu) {
        document.getElementById("feuille-titre").textContent = titre;
        var contenu = document.getElementById("feuille-contenu");
        contenu.innerHTML = "";
        construireContenu(contenu);

        document.getElementById("voile").classList.remove("cache");
        document.getElementById("feuille").classList.remove("cache");
    }

    function fermerFeuille() {
        document.getElementById("voile").classList.add("cache");
        document.getElementById("feuille").classList.add("cache");
        if (fermerFeuilleCallback) {
            var cb = fermerFeuilleCallback;
            fermerFeuilleCallback = null;
            cb();
        }
    }

    function choisirLieu(titre, exclu, actuel, surChoix) {
        ouvrirFeuille(titre, function (contenu) {
            var liste = document.createElement("div");
            liste.className = "liste-lieux";

            LIEUX.forEach(function (lieu) {
                var b = document.createElement("button");
                b.type = "button";
                b.textContent = lieu;
                if (lieu === actuel) b.classList.add("actif");
                if (lieu === exclu) {
                    b.disabled = true;
                    b.title = "Identique à l'autre lieu";
                }
                b.addEventListener("click", function () {
                    fermerFeuille();
                    surChoix(lieu);
                });
                liste.appendChild(b);
            });

            contenu.appendChild(liste);

            var annuler = document.createElement("button");
            annuler.type = "button";
            annuler.className = "secondaire";
            annuler.textContent = "Annuler";
            annuler.addEventListener("click", fermerFeuille);
            contenu.appendChild(annuler);
        });
    }

    // ---------------------------------------------------------------- saisie

    function rendreSaisie() {
        var bDepart = document.getElementById("sel-depart");
        bDepart.textContent = saisie.depart || "Choisir le départ…";
        bDepart.dataset.vide = saisie.depart ? "false" : "true";

        var bArrivee = document.getElementById("sel-arrivee");
        bArrivee.textContent = saisie.arrivee || "Choisir l'arrivée…";
        bArrivee.dataset.vide = saisie.arrivee ? "false" : "true";

        var boutons = document.querySelectorAll(".engin");
        for (var i = 0; i < boutons.length; i++) {
            boutons[i].classList.toggle("actif", boutons[i].dataset.engin === saisie.engin);
        }

        document.getElementById("btn-enregistrer").disabled =
            !saisie.depart || !saisie.arrivee || saisie.depart === saisie.arrivee;

        majCompteur();
    }

    function enregistrer() {
        if (!saisie.depart || !saisie.arrivee || saisie.depart === saisie.arrivee) return;

        var mouvement = {
            id: (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2),
            ts: iso(),
            depart: saisie.depart,
            arrivee: saisie.arrivee,
            engin: saisie.engin,
            commentaire: (document.getElementById("commentaire").value || "").trim(),
            modifie: null
        };

        donnees.mouvements.push(mouvement);
        donnees.dernierEngin = saisie.engin;

        if (!sauver()) {
            donnees.mouvements.pop();
            return;
        }

        saisie.depart = null;
        saisie.arrivee = null;
        document.getElementById("commentaire").value = "";
        rendreSaisie();
        rendreDonnees();
        afficherToast("Enregistré : " + heureLisible(mouvement.ts) + "  ·  " + mouvement.depart + " → " + mouvement.arrivee);
    }

    // ---------------------------------------------------------------- historique

    function mouvementsFiltres() {
        var debut = jourAujourdhui();
        if (periode === "semaine") {
            var d = new Date();
            d.setDate(d.getDate() - 6);
            debut = iso(d).substring(0, 10);
        }

        var texte = recherche.trim().toLowerCase();

        return trierRecents(donnees.mouvements.filter(function (m) {
            if (periode !== "tout" && jourDe(m.ts) < debut) return false;
            if (!texte) return true;
            var tout = (m.depart + " " + m.arrivee + " " + m.engin + " " + (m.commentaire || "") +
                " " + dateLisible(m.ts)).toLowerCase();
            return tout.indexOf(texte) >= 0;
        }));
    }

    function rendreHistorique() {
        var liste = mouvementsFiltres();
        var conteneur = document.getElementById("liste");
        var vide = document.getElementById("liste-vide");
        conteneur.innerHTML = "";

        vide.classList.toggle("cache", liste.length > 0);

        liste.forEach(function (m) {
            var bouton = document.createElement("button");
            bouton.type = "button";
            bouton.className = "element" + (estModifie(m) ? " modifie" : "");

            var corps = document.createElement("div");
            corps.className = "corps";

            var horaire = document.createElement("div");
            horaire.className = "horaire";
            horaire.textContent = dateLisible(m.ts) + "  ·  " + heureLisible(m.ts);

            var trajet = document.createElement("div");
            trajet.className = "trajet";
            trajet.textContent = m.depart + " → " + m.arrivee;

            var details = document.createElement("div");
            details.className = "details";
            details.textContent = m.engin + (estModifie(m) ? "  ·  modifié" : "");

            corps.appendChild(horaire);
            corps.appendChild(trajet);
            corps.appendChild(details);

            if (m.commentaire) {
                var com = document.createElement("div");
                com.className = "commentaire";
                com.textContent = m.commentaire;
                corps.appendChild(com);
            }

            var chevron = document.createElement("span");
            chevron.className = "chevron";
            chevron.textContent = "›";

            bouton.appendChild(corps);
            bouton.appendChild(chevron);
            bouton.addEventListener("click", function () { ouvrirDetail(m); });

            conteneur.appendChild(bouton);
        });
    }

    function ouvrirDetail(m) {
        ouvrirFeuille("Mouvement", function (contenu) {
            var detail = document.createElement("div");
            detail.className = "detail";

            function ligne(libelle, valeur) {
                var d = document.createElement("div");
                d.className = "ligne";
                var a = document.createElement("span");
                a.textContent = libelle;
                var b = document.createElement("span");
                b.textContent = valeur;
                d.appendChild(a);
                d.appendChild(b);
                detail.appendChild(d);
            }

            ligne("Date", dateLisible(m.ts));
            ligne("Heure", heureLisible(m.ts));
            ligne("Départ", m.depart);
            ligne("Arrivée", m.arrivee);
            ligne("Engin", m.engin);
            ligne("Commentaire", m.commentaire || "—");
            if (estModifie(m)) ligne("Modifié le", dateLisible(m.modifie) + " " + heureLisible(m.modifie).substring(0, 5));

            contenu.appendChild(detail);

            var actions = document.createElement("div");
            actions.className = "actions";

            var modifier = document.createElement("button");
            modifier.type = "button";
            modifier.className = "principal";
            modifier.textContent = "MODIFIER";
            modifier.addEventListener("click", function () { ouvrirModification(m); });
            actions.appendChild(modifier);

            var supprimer = document.createElement("button");
            supprimer.type = "button";
            supprimer.className = "secondaire danger-texte";
            supprimer.textContent = "Supprimer ce mouvement";
            supprimer.addEventListener("click", function () {
                if (!confirm("Supprimer définitivement ce mouvement ?")) return;
                donnees.mouvements = donnees.mouvements.filter(function (x) { return x.id !== m.id; });
                sauver();
                fermerFeuille();
                rendreHistorique();
                rendreDonnees();
                afficherToast("Mouvement supprimé.");
            });
            actions.appendChild(supprimer);

            contenu.appendChild(actions);
        });
    }

    function ouvrirModification(m) {
        ouvrirFeuille("Modifier le mouvement", function (contenu) {
            var date = document.createElement("input");
            date.type = "date";
            date.className = "champ";
            date.value = jourDe(m.ts);

            var heure = document.createElement("input");
            heure.type = "time";
            heure.step = "1";
            heure.className = "champ";
            heure.value = heureLisible(m.ts).substring(0, 5);

            var depart = construireSelect(m.depart);
            var arrivee = construireSelect(m.arrivee);

            var commentaire = document.createElement("input");
            commentaire.type = "text";
            commentaire.className = "champ";
            commentaire.maxLength = 300;
            commentaire.value = m.commentaire || "";

            var engin = m.engin;

            var engins = document.createElement("div");
            engins.className = "engins";
            ENGINS.forEach(function (nom) {
                var b = document.createElement("button");
                b.type = "button";
                b.className = "engin" + (nom === engin ? " actif" : "");
                b.textContent = nom;
                b.addEventListener("click", function () {
                    engin = nom;
                    var tous = engins.querySelectorAll(".engin");
                    for (var i = 0; i < tous.length; i++) {
                        tous[i].classList.toggle("actif", tous[i].textContent === nom);
                    }
                });
                engins.appendChild(b);
            });

            ajouterChamp(contenu, "DATE", date);
            ajouterChamp(contenu, "HEURE", heure);
            ajouterChamp(contenu, "DÉPART", depart);
            ajouterChamp(contenu, "ARRIVÉE", arrivee);
            ajouterChamp(contenu, "ENGIN", engins);
            ajouterChamp(contenu, "COMMENTAIRE (facultatif)", commentaire);

            var enregistrerBouton = document.createElement("button");
            enregistrerBouton.type = "button";
            enregistrerBouton.className = "principal";
            enregistrerBouton.textContent = "ENREGISTRER LA MODIFICATION";
            enregistrerBouton.style.marginTop = "16px";
            enregistrerBouton.addEventListener("click", function () {
                if (!date.value || !heure.value) {
                    afficherToast("Date et heure obligatoires.", true);
                    return;
                }
                if (depart.value === arrivee.value) {
                    afficherToast("Départ et arrivée identiques.", true);
                    return;
                }

                // Les secondes d'origine sont conservées si l'heure n'a pas été retouchée,
                // pour ne pas décaler le mouvement dans l'historique.
                var morceaux = heure.value.split(":");
                var heures = morceaux[0];
                var minutes = morceaux[1] || "00";
                var secondes = morceaux[2];
                if (!secondes) {
                    secondes = (heures + ":" + minutes) === heureLisible(m.ts).substring(0, 5)
                        ? heureLisible(m.ts).substring(6, 8)
                        : "00";
                }

                m.ts = date.value + "T" + heures + ":" + minutes + ":" + secondes;
                m.depart = depart.value;
                m.arrivee = arrivee.value;
                m.engin = engin;
                m.commentaire = commentaire.value.trim();
                m.modifie = iso();

                sauver();
                fermerFeuille();
                rendreHistorique();
                rendreDonnees();
                afficherToast("Mouvement modifié.");
            });

            contenu.appendChild(enregistrerBouton);
        });
    }

    function construireSelect(valeur) {
        var select = document.createElement("select");
        select.className = "champ";
        LIEUX.forEach(function (lieu) {
            var option = document.createElement("option");
            option.value = lieu;
            option.textContent = lieu;
            if (lieu === valeur) option.selected = true;
            select.appendChild(option);
        });
        return select;
    }

    function ajouterChamp(conteneur, libelle, element) {
        var label = document.createElement("label");
        label.className = "etiquette";
        label.textContent = libelle;
        conteneur.appendChild(label);
        conteneur.appendChild(element);
    }

    // ---------------------------------------------------------------- données / export

    function rendreDonnees() {
        var total = donnees.mouvements.length;
        var jour = aujourdHui().length;
        var baumann = donnees.mouvements.filter(function (m) { return m.engin === "BAUMANN"; }).length;
        var fenwick = total - baumann;

        document.getElementById("stat-total").textContent = total;
        document.getElementById("stat-jour").textContent = jour;
        document.getElementById("stat-baumann").textContent = baumann;
        document.getElementById("stat-fenwick").textContent = fenwick;

        var info = document.getElementById("info-sauvegarde");
        info.classList.remove("alerte");

        if (total === 0) {
            info.textContent = "Aucun mouvement enregistré pour l'instant.";
        } else if (!donnees.dernierExport) {
            info.textContent = "⚠ Aucun envoi pour l'instant : pensez à envoyer la journée par mail.";
            info.classList.add("alerte");
        } else {
            var date = new Date(donnees.dernierExport);
            var heures = Math.floor((Date.now() - date.getTime()) / 3600000);
            var quand = date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }) +
                " à " + deux(date.getHours()) + "h" + deux(date.getMinutes());
            info.textContent = "Dernier envoi : " + quand;
            if (heures >= 24) {
                info.textContent += " — plus de 24 h : pensez à envoyer.";
                info.classList.add("alerte");
            }
        }

        majApercuExport();
    }

    function mouvementsExport() {
        var periodeChoisie = document.getElementById("export-periode").value;
        var debut = jourAujourdhui();

        if (periodeChoisie === "semaine") {
            var d = new Date();
            d.setDate(d.getDate() - 6);
            debut = iso(d).substring(0, 10);
        }

        var liste = donnees.mouvements.filter(function (m) {
            return periodeChoisie === "tout" || jourDe(m.ts) >= debut;
        });

        return trierAnciens(liste);
    }

    function majApercuExport() {
        var liste = mouvementsExport();
        var apercu = document.getElementById("apercu-export");
        apercu.textContent = liste.length === 0
            ? "Aucun mouvement sur cette période."
            : (liste.length === 1 ? "1 mouvement sera envoyé." : liste.length + " mouvements seront envoyés.");
        document.getElementById("btn-exporter").disabled = liste.length === 0;
        document.getElementById("btn-telecharger").disabled = liste.length === 0;
    }

    function nomFichier(extension) {
        return "mouvements-palettes_" + jourAujourdhui() + "." + extension;
    }

    function exporter(partager) {
        var liste = mouvementsExport();
        if (liste.length === 0) return;

        var format = document.getElementById("export-format").value;
        var fichier;

        if (format === "xlsx") {
            var octets = construireXlsx(liste);
            fichier = new File([octets], nomFichier("xlsx"), {
                type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            });
        } else {
            var contenu = construireCsv(liste);
            fichier = new File([contenu], nomFichier("csv"), { type: "text/csv;charset=utf-8" });
        }

        if (partager) {
            partagerFichier(fichier);
        } else {
            telecharger(fichier);
        }

        donnees.dernierExport = iso();
        sauver();
        rendreDonnees();
    }

    function partagerFichier(fichier) {
        if (navigator.canShare && navigator.canShare({ files: [fichier] })) {
            navigator.share({
                files: [fichier],
                title: "Mouvements de palettes",
                text: "Relevé des mouvements de palettes"
            }).then(function () {
                afficherToast("Fichier transmis. Vérifiez l'envoi dans Gmail.");
            }).catch(function (erreur) {
                if (erreur && erreur.name === "AbortError") return;
                telecharger(fichier);
            });
        } else {
            afficherToast("Partage indisponible : le fichier est enregistré.", true);
            telecharger(fichier);
        }
    }

    function telecharger(fichier) {
        var url = URL.createObjectURL(fichier);
        var lien = document.createElement("a");
        lien.href = url;
        lien.download = fichier.name;
        document.body.appendChild(lien);
        lien.click();
        document.body.removeChild(lien);
        setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
        afficherToast("Fichier enregistré dans « Fichiers ».");
    }

    function construireCsv(liste) {
        var lignes = ["Date;Heure;Départ;Arrivée;Engin;Commentaire"];

        liste.forEach(function (m) {
            var champs = [dateLisible(m.ts), heureLisible(m.ts), m.depart, m.arrivee, m.engin, m.commentaire || ""];
            lignes.push(champs.map(function (v) {
                var texte = String(v);
                return /[;"\n\r]/.test(texte) ? '"' + texte.replace(/"/g, '""') + '"' : texte;
            }).join(";"));
        });

        return "\ufeff" + lignes.join("\r\n");
    }

    // ---------------------------------------------------------------- navigation

    function afficherVue(nom) {
        ["saisie", "historique", "donnees"].forEach(function (v) {
            document.getElementById("vue-" + v).classList.toggle("cache", v !== nom);
        });

        var onglets = document.querySelectorAll(".onglets button");
        for (var i = 0; i < onglets.length; i++) {
            onglets[i].classList.toggle("actif", onglets[i].dataset.vue === nom);
        }

        if (nom === "historique") rendreHistorique();
        if (nom === "donnees") rendreDonnees();
        window.scrollTo(0, 0);
    }

    // ---------------------------------------------------------------- horloge

    function majHorloge() {
        var maintenant = new Date();
        var jours = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
        var mois = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

        document.getElementById("horloge").textContent =
            deux(maintenant.getHours()) + ":" + deux(maintenant.getMinutes()) + ":" + deux(maintenant.getSeconds());

        majCompteur();
    }

    function majCompteur() {
        var n = aujourdHui().length;
        document.getElementById("compteur").textContent =
            n === 0 ? "aucun mouvement aujourd'hui" : (n === 1 ? "1 mouvement aujourd'hui" : n + " mouvements aujourd'hui");
    }

    // ---------------------------------------------------------------- démarrage

    function brancher() {
        document.getElementById("sel-depart").addEventListener("click", function () {
            choisirLieu("Lieu de départ", saisie.arrivee, saisie.depart, function (lieu) {
                saisie.depart = lieu;
                if (saisie.arrivee === lieu) saisie.arrivee = null;
                rendreSaisie();
            });
        });

        document.getElementById("sel-arrivee").addEventListener("click", function () {
            choisirLieu("Lieu d'arrivée", saisie.depart, saisie.arrivee, function (lieu) {
                saisie.arrivee = lieu;
                rendreSaisie();
            });
        });

        var engins = document.querySelectorAll(".engin");
        for (var i = 0; i < engins.length; i++) {
            engins[i].addEventListener("click", function () {
                saisie.engin = this.dataset.engin;
                rendreSaisie();
            });
        }

        document.getElementById("btn-enregistrer").addEventListener("click", enregistrer);

        var segments = document.querySelectorAll("#segments-periode button");
        for (var j = 0; j < segments.length; j++) {
            segments[j].addEventListener("click", function () {
                periode = this.dataset.periode;
                for (var k = 0; k < segments.length; k++) {
                    segments[k].classList.toggle("actif", segments[k] === this);
                }
                rendreHistorique();
            });
        }

        document.getElementById("recherche").addEventListener("input", function () {
            recherche = this.value;
            rendreHistorique();
        });

        var onglets = document.querySelectorAll(".onglets button");
        for (var o = 0; o < onglets.length; o++) {
            onglets[o].addEventListener("click", function () { afficherVue(this.dataset.vue); });
        }

        document.getElementById("voile").addEventListener("click", fermerFeuille);
        document.getElementById("feuille-fermer").addEventListener("click", fermerFeuille);

        document.getElementById("export-periode").addEventListener("change", majApercuExport);
        document.getElementById("btn-exporter").addEventListener("click", function () { exporter(true); });
        document.getElementById("btn-telecharger").addEventListener("click", function () { exporter(false); });

        document.getElementById("btn-vider").addEventListener("click", function () {
            if (donnees.mouvements.length === 0) {
                afficherToast("Aucune donnée à effacer.", true);
                return;
            }
            if (!confirm("Effacer TOUS les mouvements de ce téléphone ? Cette action est définitive.")) return;
            if (!confirm("Confirmez une dernière fois : les données seront perdues si vous n'avez pas exporté.")) return;

            donnees.mouvements = [];
            donnees.dernierExport = null;
            sauver();
            rendreSaisie();
            rendreHistorique();
            rendreDonnees();
            afficherToast("Toutes les données ont été effacées.");
        });
    }

    function demarrer() {
        charger();
        saisie.engin = donnees.dernierEngin;
        brancher();
        rendreSaisie();
        rendreHistorique();
        rendreDonnees();
        majHorloge();
        setInterval(majHorloge, 1000);

        if ("serviceWorker" in navigator) {
            navigator.serviceWorker.register("sw.js").catch(function (e) {
                console.warn("Mode hors ligne indisponible", e);
            });
        }
    }

    document.addEventListener("DOMContentLoaded", demarrer);
})();
