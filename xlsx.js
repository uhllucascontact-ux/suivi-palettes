/* Générateur de fichier Excel (.xlsx) minimal, sans dépendance.
   Utilisé par l'application mobile pour envoyer le relevé par mail. */

var XLSX_LETTRES = ["A", "B", "C", "D", "E", "F"];

var XLSX_TABLE_CRC = (function () {
    var table = new Uint32Array(256);
    for (var i = 0; i < 256; i++) {
        var c = i;
        for (var j = 0; j < 8; j++) {
            c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        }
        table[i] = c >>> 0;
    }
    return table;
})();

function xlsxCrc32(octets) {
    var crc = 0xFFFFFFFF;
    for (var i = 0; i < octets.length; i++) {
        crc = XLSX_TABLE_CRC[(crc ^ octets[i]) & 0xFF] ^ (crc >>> 8);
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
}

function xlsxEchapper(texte) {
    return String(texte)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function xlsxEncoder(texte) {
    return new TextEncoder().encode(texte);
}

/* Archive ZIP sans compression (méthode 0), suffisante pour un .xlsx. */
function xlsxZip(fichiers) {
    var morceaux = [];
    var centraux = [];
    var decalage = 0;

    fichiers.forEach(function (fichier) {
        var nom = xlsxEncoder(fichier.nom);
        var contenu = typeof fichier.contenu === "string" ? xlsxEncoder(fichier.contenu) : fichier.contenu;
        var crc = xlsxCrc32(contenu);
        var heure = 0;
        var date = 0x21; // 1980-01-01, valeur neutre

        var local = new Uint8Array(30 + nom.length);
        var vue = new DataView(local.buffer);
        vue.setUint32(0, 0x04034b50, true);
        vue.setUint16(4, 20, true);
        vue.setUint16(6, 0x0800, true);
        vue.setUint16(8, 0, true);
        vue.setUint16(10, heure, true);
        vue.setUint16(12, date, true);
        vue.setUint32(14, crc, true);
        vue.setUint32(18, contenu.length, true);
        vue.setUint32(22, contenu.length, true);
        vue.setUint16(26, nom.length, true);
        vue.setUint16(28, 0, true);
        local.set(nom, 30);

        morceaux.push(local, contenu);

        var central = new Uint8Array(46 + nom.length);
        var vueC = new DataView(central.buffer);
        vueC.setUint32(0, 0x02014b50, true);
        vueC.setUint16(4, 20, true);
        vueC.setUint16(6, 20, true);
        vueC.setUint16(8, 0x0800, true);
        vueC.setUint16(10, 0, true);
        vueC.setUint16(12, heure, true);
        vueC.setUint16(14, date, true);
        vueC.setUint32(16, crc, true);
        vueC.setUint32(20, contenu.length, true);
        vueC.setUint32(24, contenu.length, true);
        vueC.setUint16(28, nom.length, true);
        vueC.setUint16(30, 0, true);
        vueC.setUint16(32, 0, true);
        vueC.setUint16(34, 0, true);
        vueC.setUint16(36, 0, true);
        vueC.setUint32(38, 0, true);
        vueC.setUint32(42, decalage, true);
        central.set(nom, 46);
        centraux.push(central);

        decalage += local.length + contenu.length;
    });

    var tailleCentraux = centraux.reduce(function (total, c) { return total + c.length; }, 0);
    var eocd = new Uint8Array(22);
    var vueE = new DataView(eocd.buffer);
    vueE.setUint32(0, 0x06054b50, true);
    vueE.setUint16(4, 0, true);
    vueE.setUint16(6, 0, true);
    vueE.setUint16(8, fichiers.length, true);
    vueE.setUint16(10, fichiers.length, true);
    vueE.setUint32(12, tailleCentraux, true);
    vueE.setUint32(16, decalage, true);
    vueE.setUint16(20, 0, true);

    var total = decalage + tailleCentraux + eocd.length;
    var sortie = new Uint8Array(total);
    var position = 0;

    morceaux.forEach(function (morceau) {
        sortie.set(morceau, position);
        position += morceau.length;
    });
    centraux.forEach(function (morceau) {
        sortie.set(morceau, position);
        position += morceau.length;
    });
    sortie.set(eocd, position);

    return sortie;
}

function xlsxColonne(index) {
    return XLSX_LETTRES[index] || "A";
}

function xlsxCelluleTexte(ligne, colonne, valeur, style) {
    var ref = xlsxColonne(colonne) + ligne;
    var s = style ? ' s="' + style + '"' : "";
    return '<c r="' + ref + '"' + s + ' t="inlineStr"><is><t xml:space="preserve">' +
        xlsxEchapper(valeur == null ? "" : valeur) + "</t></is></c>";
}

function xlsxCelluleNombre(ligne, colonne, valeur, style) {
    var ref = xlsxColonne(colonne) + ligne;
    return '<c r="' + ref + '" s="' + style + '"><v>' + valeur + "</v></c>";
}

function xlsxDateSerie(annee, mois, jour) {
    var jours = Math.round((Date.UTC(annee, mois - 1, jour) - Date.UTC(1899, 11, 30)) / 86400000);
    return jours;
}

function xlsxHeureSerie(heures, minutes, secondes) {
    return (heures * 3600 + minutes * 60 + secondes) / 86400;
}

function xlsxFeuille(mouvements) {
    var lignes = [];

    lignes.push(
        '<row r="1">' +
        xlsxCelluleTexte(1, 0, "Date", 1) +
        xlsxCelluleTexte(1, 1, "Heure", 1) +
        xlsxCelluleTexte(1, 2, "Départ", 1) +
        xlsxCelluleTexte(1, 3, "Arrivée", 1) +
        xlsxCelluleTexte(1, 4, "Engin", 1) +
        xlsxCelluleTexte(1, 5, "Commentaire", 1) +
        "</row>");

    mouvements.forEach(function (m, index) {
        var numero = index + 2;
        var parties = m.ts.split("T");
        var d = parties[0].split("-");
        var h = parties[1].split(":");

        lignes.push(
            '<row r="' + numero + '">' +
            xlsxCelluleNombre(numero, 0, xlsxDateSerie(+d[0], +d[1], +d[2]), 2) +
            xlsxCelluleNombre(numero, 1, xlsxHeureSerie(+h[0], +h[1], +h[2]), 3) +
            xlsxCelluleTexte(numero, 2, m.depart) +
            xlsxCelluleTexte(numero, 3, m.arrivee) +
            xlsxCelluleTexte(numero, 4, m.engin) +
            xlsxCelluleTexte(numero, 5, m.commentaire || "") +
            "</row>");
    });

    var derniere = Math.max(1, mouvements.length + 1);

    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
        '<sheetViews><sheetView workbookViewId="0">' +
        '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>' +
        "</sheetView></sheetViews>" +
        '<cols><col min="1" max="1" width="13" customWidth="1"/>' +
        '<col min="2" max="2" width="11" customWidth="1"/>' +
        '<col min="3" max="4" width="18" customWidth="1"/>' +
        '<col min="5" max="5" width="13" customWidth="1"/>' +
        '<col min="6" max="6" width="42" customWidth="1"/></cols>' +
        "<sheetData>" + lignes.join("") + "</sheetData>" +
        '<autoFilter ref="A1:F' + derniere + '"/>' +
        "</worksheet>";
}

var XLSX_STYLES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<numFmts count="2"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/>' +
    '<numFmt numFmtId="165" formatCode="hh:mm:ss"/></numFmts>' +
    '<fonts count="2">' +
    '<font><sz val="11"/><name val="Calibri"/></font>' +
    '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>' +
    "</fonts>" +
    '<fills count="3">' +
    '<fill><patternFill patternType="none"/></fill>' +
    '<fill><patternFill patternType="gray125"/></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FF1B2A33"/><bgColor indexed="64"/></patternFill></fill>' +
    "</fills>" +
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="4">' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
    '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"><alignment horizontal="center"/></xf>' +
    '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
    '<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
    "</cellXfs>" +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
    "</styleSheet>";

function construireXlsx(mouvements) {
    return xlsxZip([
        {
            nom: "[Content_Types].xml",
            contenu: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
                '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
                '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
                '<Default Extension="xml" ContentType="application/xml"/>' +
                '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
                '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
                '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
                "</Types>"
        },
        {
            nom: "_rels/.rels",
            contenu: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
                '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
                '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
                "</Relationships>"
        },
        {
            nom: "xl/workbook.xml",
            contenu: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
                '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
                'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
                '<sheets><sheet name="Mouvements" sheetId="1" r:id="rId1"/></sheets>' +
                "</workbook>"
        },
        {
            nom: "xl/_rels/workbook.xml.rels",
            contenu: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
                '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
                '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
                '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
                "</Relationships>"
        },
        { nom: "xl/styles.xml", contenu: XLSX_STYLES },
        { nom: "xl/worksheets/sheet1.xml", contenu: xlsxFeuille(mouvements) }
    ]);
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { construireXlsx: construireXlsx };
}
