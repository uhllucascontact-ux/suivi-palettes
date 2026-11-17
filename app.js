/* Application mobile de test — enregistrement local sur le téléphone.
   Aucune donnée n'est envoyée sur Internet : seul l'export par mail sort du téléphone. */

(function () {
    "use strict";

    var CLE = "suiviPalettes.v1";
    var CLE_TACHES = "suiviTaches.v1";
    var CLE_OPERATIONS = "suiviOperations.v1";

    var TYPES_OPERATIONS = ["Palettes vides", "Benne ferraille", "Rehausses", "Chutes",
        "Ferraille", "Bennes copeaux", "Bois"];

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
    var taches = { version: 1, elements: [] };
    var filtreTaches = "toutes";
    var operations = { version: 1, elements: [] };

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

    function chargerTaches() {
        try {
            var brut = localStorage.getItem(CLE_TACHES);
            if (!brut) return;
            var lu = JSON.parse(brut);
            if (lu && Array.isArray(lu.elements)) taches.elements = lu.elements;
        } catch (e) {
            console.warn("Tâches illisibles", e);
        }
    }

    function sauverTaches() {
        try {
            localStorage.setItem(CLE_TACHES, JSON.stringify(taches));
            return true;
        } catch (e) {
            afficherToast("Mémoire pleine : la tâche n'a pas été enregistrée.", true);
            return false;
        }
    }

    function chargerOperations() {
        try {
            var brut = localStorage.getItem(CLE_OPERATIONS);
            if (!brut) return;
            var lu = JSON.parse(brut);
            if (lu && Array.isArray(lu.elements)) operations.elements = lu.elements;
        } catch (e) {
            console.warn("Opérations illisibles", e);
        }
    }

    function sauverOperations() {
        try {
            localStorage.setItem(CLE_OPERATIONS, JSON.stringify(operations));
            return true;
        } catch (e) {
            afficherToast("Mémoire pleine : l'opération n'a pas été enregistrée.", true);
            return false;
        }
    }

    // ---------------------------------------------------------------- utilitaires

    function deux(n) { return n < 10 ? "0" + n : String(n); }

    function uid() {
        return (window.crypto && crypto.randomUUID)
            ? crypto.randomUUID()
            : String(Date.now()) + Math.random().toString(16).slice(2);
    }

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
            id: uid(),
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

    function debutPeriode() {
        if (periode === "semaine") {
            var d = new Date();
            d.setDate(d.getDate() - 6);
            return iso(d).substring(0, 10);
        }
        if (periode === "tout") return "0000-00-00";
        return jourAujourdhui();
    }

    function mouvementsFiltres() {
        var debut = debutPeriode();
        var texte = recherche.trim().toLowerCase();

        return trierRecents(donnees.mouvements.filter(function (m) {
            if (jourDe(m.ts) < debut) return false;
            if (!texte) return true;
            var tout = (m.depart + " " + m.arrivee + " " + m.engin + " " + (m.commentaire || "") +
                " " + dateLisible(m.ts)).toLowerCase();
            return tout.indexOf(texte) >= 0;
        }));
    }

    /* Regroupe les opérations du même type et de la même heure : « Bennes copeaux ×3 · 14 h ». */
    function operationsRegroupees() {
        var debut = debutPeriode();
        var texte = recherche.trim().toLowerCase();
        var groupes = {};

        operations.elements.forEach(function (o) {
            if (jourDe(o.ts) < debut) return;
            if (texte && (o.type + " " + dateLisible(o.ts)).toLowerCase().indexOf(texte) < 0) return;

            var cle = o.type + "|" + o.ts.substring(0, 13);
            if (!groupes[cle]) groupes[cle] = { type: o.type, ts: o.ts, elements: [] };
            groupes[cle].elements.push(o);
            if (o.ts > groupes[cle].ts) groupes[cle].ts = o.ts;
        });

        return Object.keys(groupes).map(function (cle) {
            var groupe = groupes[cle];
            groupe.elements.sort(function (a, b) { return a.ts < b.ts ? -1 : 1; });
            return groupe;
        });
    }

    function elementsHistorique() {
        var elements = [];

        mouvementsFiltres().forEach(function (m) {
            elements.push({ genre: "mouvement", ts: m.ts, mouvement: m });
        });

        operationsRegroupees().forEach(function (groupe) {
            elements.push({ genre: "operations", ts: groupe.ts, groupe: groupe });
        });

        return elements.sort(function (a, b) { return a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0; });
    }

    function rendreHistorique() {
        var elements = elementsHistorique();
        var conteneur = document.getElementById("liste");
        var vide = document.getElementById("liste-vide");

        conteneur.innerHTML = "";
        vide.classList.toggle("cache", elements.length > 0);

        elements.forEach(function (element) {
            conteneur.appendChild(element.genre === "operations"
                ? carteOperations(element.groupe)
                : carteMouvement(element.mouvement));
        });
    }

    function carteMouvement(m) {
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

        return bouton;
    }

    function carteOperations(groupe) {
        var bouton = document.createElement("button");
        bouton.type = "button";
        bouton.className = "element grp-operation";

        var corps = document.createElement("div");
        corps.className = "corps";

        var horaire = document.createElement("div");
        horaire.className = "horaire";
        horaire.textContent = dateLisible(groupe.ts) + "  ·  " + heureLisible(groupe.ts).substring(0, 2) + " h";

        var titre = document.createElement("div");
        titre.className = "trajet";
        titre.textContent = groupe.type + " ×" + groupe.elements.length;

        var temps = document.createElement("div");
        temps.className = "sous-temps";
        temps.textContent = groupe.elements.map(function (o) {
            return heureLisible(o.ts).substring(0, 5);
        }).join("  ·  ");

        corps.appendChild(horaire);
        corps.appendChild(titre);
        corps.appendChild(temps);

        var chevron = document.createElement("span");
        chevron.className = "chevron";
        chevron.textContent = "›";

        bouton.appendChild(corps);
        bouton.appendChild(chevron);
        bouton.addEventListener("click", function () { ouvrirDetailOperations(groupe); });

        return bouton;
    }

    function ligneDetail(libelle, valeur) {
        var ligne = document.createElement("div");
        ligne.className = "ligne";
        var a = document.createElement("span");
        a.textContent = libelle;
        var b = document.createElement("span");
        b.textContent = valeur;
        ligne.appendChild(a);
        ligne.appendChild(b);
        return ligne;
    }

    function ouvrirDetailOperations(groupe) {
        ouvrirFeuille("Opérations", function (contenu) {
            var detail = document.createElement("div");
            detail.className = "detail";
            detail.appendChild(ligneDetail("Type", groupe.type));
            detail.appendChild(ligneDetail("Date", dateLisible(groupe.ts)));
            detail.appendChild(ligneDetail("Nombre", groupe.elements.length +
                (groupe.elements.length === 1 ? " unité" : " unités")));
            contenu.appendChild(detail);

            groupe.elements.forEach(function (o) {
                var ligne = document.createElement("div");
                ligne.className = "ligne-operation";

                var heure = document.createElement("span");
                heure.className = "heure-op";
                heure.textContent = heureLisible(o.ts);

                var retirer = document.createElement("button");
                retirer.type = "button";
                retirer.className = "retirer";
                retirer.textContent = "✕";
                retirer.setAttribute("aria-label", "Retirer cette opération");
                retirer.addEventListener("click", function () {
                    if (!confirm("Retirer l'opération de " + heureLisible(o.ts).substring(0, 5) + " ?")) return;

                    operations.elements = operations.elements.filter(function (x) { return x.id !== o.id; });
                    sauverOperations();
                    fermerFeuille();
                    rendreOperations();
                    rendreHistorique();
                    afficherToast("Opération retirée.");
                });

                ligne.appendChild(heure);
                ligne.appendChild(retirer);
                contenu.appendChild(ligne);
            });
        });
    }

    function rendreOperations() {
        var grille = document.getElementById("grille-operations");
        grille.innerHTML = "";

        TYPES_OPERATIONS.forEach(function (type) {
            var bouton = document.createElement("button");
            bouton.type = "button";
            bouton.className = "operation";
            bouton.dataset.type = type;

            var libelle = document.createElement("span");
            libelle.className = "libelle";
            libelle.textContent = type;

            var compteur = document.createElement("span");
            compteur.className = "compteur";
            var nombre = operationsDuJour(type);
            compteur.textContent = nombre > 0 ? String(nombre) : "";

            var plus = document.createElement("span");
            plus.className = "plus";
            plus.textContent = "+";

            bouton.appendChild(libelle);
            bouton.appendChild(compteur);
            bouton.appendChild(plus);
            bouton.addEventListener("click", function () { ajouterOperation(type); });

            grille.appendChild(bouton);
        });

        var total = operationsDuJour();
        document.getElementById("resume-operations").textContent = total === 0
            ? "Aucune opération aujourd'hui."
            : total + (total === 1 ? " opération aujourd'hui." : " opérations aujourd'hui.");
    }

    function operationsDuJour(type) {
        return operations.elements.filter(function (o) {
            return jourDe(o.ts) === jourAujourdhui() && (!type || o.type === type);
        }).length;
    }

    function ajouterOperation(type) {
        operations.elements.push({ id: uid(), type: type, ts: iso() });
        if (!sauverOperations()) {
            operations.elements.pop();
            return;
        }

        rendreOperations();
        if (!document.getElementById("vue-historique").classList.contains("cache")) rendreHistorique();

        afficherToast(type + "  +1   ·   " + operationsDuJour(type) + " aujourd'hui");
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

    // ---------------------------------------------------------------- tâches

    function moment(ts) {
        return dateLisible(ts).substring(0, 5) + " à " + heureLisible(ts).substring(0, 5);
    }

    function tachesAffichees() {
        var liste = taches.elements.filter(function (t) {
            if (filtreTaches === "afaire") return !t.fait;
            if (filtreTaches === "faites") return !!t.fait;
            return true;
        });

        return liste.sort(function (a, b) {
            var aFaite = a.fait ? 1 : 0;
            var bFaite = b.fait ? 1 : 0;
            if (aFaite !== bFaite) return aFaite - bFaite;
            if (a.fait && b.fait) return a.fait < b.fait ? 1 : -1;
            return a.cree < b.cree ? -1 : 1;
        });
    }

    function rendreTaches() {
        var liste = tachesAffichees();
        var conteneur = document.getElementById("liste-taches");
        conteneur.innerHTML = "";

        var restantes = taches.elements.filter(function (t) { return !t.fait; }).length;
        var total = taches.elements.length;

        document.getElementById("resume-taches").textContent = total === 0
            ? "Aucune tâche enregistrée."
            : (restantes === 0
                ? "Tout est fait (" + total + (total === 1 ? " tâche)." : " tâches).")
                : restantes + (restantes === 1 ? " restante" : " restantes") + " sur " + total);

        document.getElementById("taches-vide").classList.toggle("cache", liste.length > 0);

        liste.forEach(function (t) {
            var element = document.createElement("div");
            element.className = "tache" + (t.fait ? " faite" : "");

            var caseBouton = document.createElement("button");
            caseBouton.type = "button";
            caseBouton.className = "case" + (t.fait ? " faite" : "");
            caseBouton.textContent = "✓";
            caseBouton.setAttribute("aria-label", t.fait ? "Décocher la tâche" : "Cocher la tâche");
            caseBouton.addEventListener("click", function () { basculerTache(t.id); });

            var corps = document.createElement("div");
            corps.className = "corps";

            var texte = document.createElement("div");
            texte.className = "texte";
            texte.textContent = t.texte;
            texte.addEventListener("click", function () { basculerTache(t.id); });

            var meta = document.createElement("div");
            meta.className = "meta";
            meta.textContent = "Créée le " + moment(t.cree) + (t.fait ? "  ·  faite le " + moment(t.fait) : "");

            corps.appendChild(texte);
            corps.appendChild(meta);

            var supprimer = document.createElement("button");
            supprimer.type = "button";
            supprimer.className = "supprimer";
            supprimer.textContent = "✕";
            supprimer.setAttribute("aria-label", "Supprimer la tâche");
            supprimer.addEventListener("click", function () { supprimerTache(t.id); });

            element.appendChild(caseBouton);
            element.appendChild(corps);
            element.appendChild(supprimer);
            conteneur.appendChild(element);
        });
    }

    function ajouterTache() {
        var champ = document.getElementById("nouvelle-tache");
        var texte = (champ.value || "").trim();
        if (!texte) {
            champ.focus();
            return;
        }

        taches.elements.push({ id: uid(), texte: texte, cree: iso(), fait: null });
        if (!sauverTaches()) {
            taches.elements.pop();
            return;
        }

        champ.value = "";
        champ.focus();
        rendreTaches();
        afficherToast("Tâche ajoutée.");
    }

    function basculerTache(id) {
        var t = taches.elements.filter(function (x) { return x.id === id; })[0];
        if (!t) return;

        t.fait = t.fait ? null : iso();
        sauverTaches();
        rendreTaches();
    }

    function supprimerTache(id) {
        var t = taches.elements.filter(function (x) { return x.id === id; })[0];
        if (!t) return;
        if (!confirm("Supprimer cette tâche ?\n\n" + t.texte)) return;

        taches.elements = taches.elements.filter(function (x) { return x.id !== id; });
        sauverTaches();
        rendreTaches();
        afficherToast("Tâche supprimée.");
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

    function debutExport() {
        var periodeChoisie = document.getElementById("export-periode").value;

        if (periodeChoisie === "semaine") {
            var d = new Date();
            d.setDate(d.getDate() - 6);
            return iso(d).substring(0, 10);
        }

        if (periodeChoisie === "tout") return "0000-00-00";
        return jourAujourdhui();
    }

    /* Une ligne par mouvement, une ligne par opération (colonne « Opération »). */
    function lignesExport() {
        var debut = debutExport();
        var lignes = [];

        donnees.mouvements.forEach(function (m) {
            if (jourDe(m.ts) < debut) return;
            lignes.push({
                ts: m.ts,
                depart: m.depart,
                arrivee: m.arrivee,
                engin: m.engin,
                commentaire: m.commentaire || "",
                operation: ""
            });
        });

        operations.elements.forEach(function (o) {
            if (jourDe(o.ts) < debut) return;
            lignes.push({
                ts: o.ts,
                depart: "",
                arrivee: "",
                engin: "",
                commentaire: "",
                operation: o.type
            });
        });

        return lignes.sort(function (a, b) { return a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0; });
    }

    function majApercuExport() {
        var lignes = lignesExport();
        var apercu = document.getElementById("apercu-export");
        apercu.textContent = lignes.length === 0
            ? "Rien à envoyer sur cette période."
            : (lignes.length === 1 ? "1 ligne sera envoyée." : lignes.length + " lignes seront envoyées.");
        document.getElementById("btn-exporter").disabled = lignes.length === 0;
        document.getElementById("btn-telecharger").disabled = lignes.length === 0;
    }

    function nomFichier(extension) {
        return "mouvements-palettes_" + jourAujourdhui() + "." + extension;
    }

    function exporter(partager) {
        var liste = lignesExport();
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
        var lignes = ["Date;Heure;Départ;Arrivée;Engin;Commentaire;Opération"];

        liste.forEach(function (l) {
            var champs = [dateLisible(l.ts), heureLisible(l.ts), l.depart, l.arrivee, l.engin, l.commentaire, l.operation];
            lignes.push(champs.map(function (v) {
                var texte = String(v == null ? "" : v);
                return /[;"\n\r]/.test(texte) ? '"' + texte.replace(/"/g, '""') + '"' : texte;
            }).join(";"));
        });

        return "\ufeff" + lignes.join("\r\n");
    }

    // ---------------------------------------------------------------- navigation

    function afficherVue(nom) {
        ["saisie", "historique", "taches", "donnees"].forEach(function (v) {
            document.getElementById("vue-" + v).classList.toggle("cache", v !== nom);
        });

        var onglets = document.querySelectorAll(".onglets button");
        for (var i = 0; i < onglets.length; i++) {
            onglets[i].classList.toggle("actif", onglets[i].dataset.vue === nom);
        }

        if (nom === "historique") rendreHistorique();
        if (nom === "taches") rendreTaches();
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

        document.getElementById("btn-ajouter-tache").addEventListener("click", ajouterTache);

        document.getElementById("nouvelle-tache").addEventListener("keydown", function (evenement) {
            if (evenement.key === "Enter") {
                evenement.preventDefault();
                ajouterTache();
            }
        });

        var segmentsTaches = document.querySelectorAll("#segments-taches button");
        for (var s = 0; s < segmentsTaches.length; s++) {
            segmentsTaches[s].addEventListener("click", function () {
                filtreTaches = this.dataset.filtre;
                for (var k = 0; k < segmentsTaches.length; k++) {
                    segmentsTaches[k].classList.toggle("actif", segmentsTaches[k] === this);
                }
                rendreTaches();
            });
        }

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
        chargerTaches();
        chargerOperations();
        saisie.engin = donnees.dernierEngin;
        brancher();
        rendreSaisie();
        rendreHistorique();
        rendreTaches();
        rendreOperations();
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
