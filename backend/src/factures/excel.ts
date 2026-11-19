import { deflateRawSync } from 'zlib';

/**
 * Fabrique un petit fichier Excel (.xlsx) sans aucune bibliothèque à installer.
 * Un fichier .xlsx est un dossier compressé (zip) qui contient des fichiers XML :
 * on écrit ces fichiers XML nous-mêmes, puis on les met dans un zip.
 */

export interface ColonneExcel {
  titre: string;
  largeur: number;
  // "montant" : nombre avec séparateur de milliers (65 000)
  type: 'texte' | 'montant';
}

export type CelluleExcel = string | number | null | undefined;

export interface LigneExcel {
  cellules: CelluleExcel[];
  gras?: boolean;
}

// ---------- Le zip ----------

const TABLE_CRC = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(donnees: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < donnees.length; i++) {
    crc = TABLE_CRC[(crc ^ donnees[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function creerZip(fichiers: { nom: string; contenu: Buffer }[]): Buffer {
  const morceaux: Buffer[] = [];
  const repertoire: Buffer[] = [];
  let position = 0;

  for (const fichier of fichiers) {
    const nom = Buffer.from(fichier.nom, 'utf8');
    const compresse = deflateRawSync(fichier.contenu);
    const crc = crc32(fichier.contenu);

    const entete = Buffer.alloc(30);
    entete.writeUInt32LE(0x04034b50, 0); // signature
    entete.writeUInt16LE(20, 4); // version
    entete.writeUInt16LE(0x0800, 6); // noms en UTF-8
    entete.writeUInt16LE(8, 8); // compression "deflate"
    entete.writeUInt16LE(0, 10); // heure
    entete.writeUInt16LE(0x21, 12); // date (1980-01-01)
    entete.writeUInt32LE(crc, 14);
    entete.writeUInt32LE(compresse.length, 18);
    entete.writeUInt32LE(fichier.contenu.length, 22);
    entete.writeUInt16LE(nom.length, 26);
    entete.writeUInt16LE(0, 28);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0x21, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compresse.length, 20);
    central.writeUInt32LE(fichier.contenu.length, 24);
    central.writeUInt16LE(nom.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(position, 42);

    morceaux.push(entete, nom, compresse);
    repertoire.push(central, nom);
    position += entete.length + nom.length + compresse.length;
  }

  const tailleRepertoire = repertoire.reduce((total, b) => total + b.length, 0);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0);
  fin.writeUInt16LE(0, 4);
  fin.writeUInt16LE(0, 6);
  fin.writeUInt16LE(fichiers.length, 8);
  fin.writeUInt16LE(fichiers.length, 10);
  fin.writeUInt32LE(tailleRepertoire, 12);
  fin.writeUInt32LE(position, 16);
  fin.writeUInt16LE(0, 20);

  return Buffer.concat([...morceaux, ...repertoire, fin]);
}

// ---------- Les fichiers XML d'Excel ----------

function echapper(texte: string): string {
  return texte
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    // Caractères de contrôle interdits dans un fichier XML
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
}

/** Nom de colonne Excel : 0 → A, 1 → B, ... 26 → AA */
function lettreColonne(index: number): string {
  let lettre = '';
  let n = index + 1;
  while (n > 0) {
    const reste = (n - 1) % 26;
    lettre = String.fromCharCode(65 + reste) + lettre;
    n = Math.floor((n - 1) / 26);
  }
  return lettre;
}

// Styles : 0 normal, 1 gras, 2 montant, 3 montant en gras
function styleCellule(type: ColonneExcel['type'], gras: boolean): number {
  if (type === 'montant') return gras ? 3 : 2;
  return gras ? 1 : 0;
}

function celluleXml(
  valeur: CelluleExcel,
  reference: string,
  type: ColonneExcel['type'],
  gras: boolean,
): string {
  if (valeur === null || valeur === undefined || valeur === '') return '';
  const style = styleCellule(type, gras);
  if (typeof valeur === 'number' && Number.isFinite(valeur)) {
    return `<c r="${reference}" s="${style}"><v>${valeur}</v></c>`;
  }
  return `<c r="${reference}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${echapper(String(valeur))}</t></is></c>`;
}

/**
 * Crée le fichier .xlsx : une feuille, une ligne de titres en gras (figée en
 * haut), puis les lignes données.
 */
export function creerFichierExcel(
  nomFeuille: string,
  colonnes: ColonneExcel[],
  lignes: LigneExcel[],
): Buffer {
  const toutesLesLignes: LigneExcel[] = [
    { cellules: colonnes.map((c) => c.titre), gras: true },
    ...lignes,
  ];

  const lignesXml = toutesLesLignes
    .map((ligne, i) => {
      const numero = i + 1;
      const cellules = ligne.cellules
        .map((valeur, j) =>
          celluleXml(
            valeur,
            `${lettreColonne(j)}${numero}`,
            // La ligne des titres est du texte, même au-dessus d'un montant
            i === 0 ? 'texte' : (colonnes[j]?.type ?? 'texte'),
            Boolean(ligne.gras),
          ),
        )
        .join('');
      return `<row r="${numero}">${cellules}</row>`;
    })
    .join('');

  const largeurs = colonnes
    .map((c, j) => `<col min="${j + 1}" max="${j + 1}" width="${c.largeur}" customWidth="1"/>`)
    .join('');

  const feuille =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<sheetViews><sheetView workbookViewId="0">' +
    '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>' +
    '</sheetView></sheetViews>' +
    `<cols>${largeurs}</cols>` +
    `<sheetData>${lignesXml}</sheetData>` +
    '</worksheet>';

  const styles =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<fonts count="2">' +
    '<font><sz val="11"/><name val="Calibri"/></font>' +
    '<font><b/><sz val="11"/><name val="Calibri"/></font>' +
    '</fonts>' +
    '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="4">' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
    '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
    '<xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
    '<xf numFmtId="3" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>' +
    '</cellXfs>' +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
    '</styleSheet>';

  const classeur =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    `<sheets><sheet name="${echapper(nomFeuille.slice(0, 31))}" sheetId="1" r:id="rId1"/></sheets>` +
    '</workbook>';

  const liensClasseur =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
    '</Relationships>';

  const liensRacine =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
    '</Relationships>';

  const types =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
    '</Types>';

  return creerZip([
    { nom: '[Content_Types].xml', contenu: Buffer.from(types, 'utf8') },
    { nom: '_rels/.rels', contenu: Buffer.from(liensRacine, 'utf8') },
    { nom: 'xl/workbook.xml', contenu: Buffer.from(classeur, 'utf8') },
    { nom: 'xl/_rels/workbook.xml.rels', contenu: Buffer.from(liensClasseur, 'utf8') },
    { nom: 'xl/styles.xml', contenu: Buffer.from(styles, 'utf8') },
    { nom: 'xl/worksheets/sheet1.xml', contenu: Buffer.from(feuille, 'utf8') },
  ]);
}