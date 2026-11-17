const { construireXlsx } = require("../xlsx.js");
const fs = require("fs");
const path = require("path");

const mouvements = [
    { ts: "2026-11-17T06:55:00", depart: "H8", arrivee: "H12", engin: "BAUMANN", commentaire: "", operation: "" },
    { ts: "2026-11-17T08:15:00", depart: "H13", arrivee: "Exped", engin: "FENWICK", commentaire: "Attente camion", operation: "" },
    { ts: "2026-11-17T09:40:00", depart: "PM", arrivee: "Béton", engin: "BAUMANN", commentaire: "Palette \"fragile\" & abîmée", operation: "" },
    { ts: "2026-11-17T09:45:00", depart: "", arrivee: "", engin: "", commentaire: "", operation: "Bennes copeaux" },
    { ts: "2026-11-17T09:50:00", depart: "", arrivee: "", engin: "", commentaire: "", operation: "Bennes copeaux" },
    { ts: "2026-11-16T16:05:00", depart: "Rack kasto", arrivee: "Mag adv", engin: "FENWICK", commentaire: "", operation: "" }
];

const octets = construireXlsx(mouvements);
const sortie = process.argv[2] || path.join(process.cwd(), "test-mobile.xlsx");
fs.writeFileSync(sortie, Buffer.from(octets));

const buffer = fs.readFileSync(sortie);
const signature = buffer.subarray(0, 4).toString("hex");

console.log("Fichier écrit :", sortie);
console.log("Taille :", buffer.length, "octets");
console.log("Signature ZIP :", signature === "504b0304" ? "OK" : "INVALIDE (" + signature + ")");
console.log("Contient la feuille :", buffer.includes(Buffer.from("xl/worksheets/sheet1.xml")) ? "OK" : "MANQUANT");
