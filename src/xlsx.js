// Export d'un mois au format Excel (.xlsx), dans la mise en page du classeur d'origine :
// les montants réels sont écrits comme avant, sous forme de formule « =a+b+c ».
// Générateur minimal : XML SpreadsheetML + archive ZIP sans compression.
import { calculer, BLOCS } from './calc.js';
import { nomMois } from './format.js';

const TITRES_BLOCS = { fixe: 'DÉPENSES FIXES', variable: 'DÉPENSES VARIABLES', revenu: 'REVENUS' };

const echap = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const nombre = (n) => String(Math.round(n * 100) / 100);

/** Construit les lignes du tableau : [{ cellules: { A: {t|n|f, s} } }] */
export function feuilleDuMois(mois, lignes, reportLie) {
  const b = calculer(mois, lignes, reportLie);
  const rangs = [];
  const ajouter = (cellules, style) => { rangs.push({ cellules, style }); return rangs.length; };
  const t = (v, s = 0) => ({ t: v, s });
  const montant = (v, s = 2) => (v == null ? null : { n: v, s });
  const formule = (f, v, s = 2) => ({ f, v, s });
  const sommeOps = (ops) => {
    if (!ops.length) return null;
    const f = ops.map((o, i) => { const v = nombre(Number(o.montant)); return i === 0 || v.startsWith('-') ? v : `+${v}`; }).join('');
    return ops.length === 1 ? montant(Number(ops[0].montant)) : formule(f, ops.reduce((s, o) => s + Number(o.montant), 0));
  };
  const commentaire = (l) => {
    const notes = l.operations.map((o) => o.note).filter(Boolean);
    return [l.commentaire, notes.length ? notes.join(' + ') : null].filter(Boolean).join(' | ') || null;
  };
  const ecart = (r) => formule(`IF(OR(C${r}="",D${r}=""),"",C${r}-D${r})`, null);

  ajouter({ A: t('Description', 1), B: t('Catégorie', 1), C: t('Coût prévu', 1), D: t('Coût réel', 1), E: t('Écart', 1), F: t('Commentaires', 1) }, 'entete');
  const totauxBlocs = {};
  let rangImprevus = null;
  const rangsProvisions = [];

  for (const bloc of BLOCS) {
    const groupes = b.parBloc[bloc.id].groupes;
    if (!groupes.length) continue;
    if (TITRES_BLOCS[bloc.id]) { ajouter({}); ajouter({ A: t(TITRES_BLOCS[bloc.id], 3) }); }
    const sousTotaux = [];
    for (const g of groupes) {
      if (bloc.id !== 'provision' && bloc.id !== 'revenu') ajouter({ A: t(g.nom, 3) });
      const debut = rangs.length + 1;
      for (const l of g.lignes) {
        const r = rangs.length + 1;
        const prevu = l.code === 'imprevus' ? null : montant(l.prevuSaisi == null ? null : Number(l.prevuSaisi));
        ajouter({ A: t(l.libelle), B: l.categorie ? t(l.categorie) : null, C: prevu, D: sommeOps(l.operations), E: ecart(r), F: commentaire(l) ? t(commentaire(l), 4) : null });
        if (l.code === 'imprevus') rangImprevus = r;
        if (bloc.id === 'provision') rangsProvisions.push(r);
      }
      const fin = rangs.length;
      if (bloc.id === 'fixe' || bloc.id === 'variable') {
        const r = ajouter({ A: t('Sous-total', 5), B: t(g.nom, 5), C: formule(`SUM(C${debut}:C${fin})`, g.prevu, 6), D: formule(`SUM(D${debut}:D${fin})`, g.reel, 6), E: formule(`C${rangs.length + 1}-D${rangs.length + 1}`, null, 6) });
        sousTotaux.push(r);
      }
      if (bloc.id === 'revenu') totauxBlocs.revenuPlage = [debut, fin];
    }
    if (bloc.id === 'fixe' || bloc.id === 'variable') {
      ajouter({});
      const cellules = (col) => sousTotaux.map((r) => `${col}${r}`).join('+');
      const r = rangs.length + 1;
      ajouter({ A: t(`SOUS-TOTAL ${TITRES_BLOCS[bloc.id]}`, 5), C: formule(cellules('C'), b.parBloc[bloc.id].prevu, 6), D: formule(cellules('D'), b.parBloc[bloc.id].reel, 6), E: formule(`C${r}-D${r}`, null, 6) });
      totauxBlocs[bloc.id] = r;
      if (bloc.id === 'variable') {
        ajouter({});
        const rt = rangs.length + 1;
        ajouter({ A: t('DÉPENSES TOTALES', 5), C: formule(`C${totauxBlocs.fixe}+C${totauxBlocs.variable}`, b.prevuBase, 6), D: formule(`D${totauxBlocs.fixe}+D${totauxBlocs.variable}`, b.parBloc.fixe.reel + b.parBloc.variable.reel, 6), E: formule(`C${rt}-D${rt}`, null, 6) });
        totauxBlocs.totales = rt;
        ajouter({});
      }
    }
    if (bloc.id === 'provision') {
      if (rangImprevus) {
        const taux = Number(mois.taux_imprevus || 0);
        rangs[rangImprevus - 1].cellules.A = t(`Imprévus ${String(Math.round(taux * 1000) / 10).replace('.', ',')} %`);
        rangs[rangImprevus - 1].cellules.C = formule(`ROUND(C${totauxBlocs.totales}*${taux},2)`, b.imprevusPrevu);
      }
      ajouter({});
      const rg = rangs.length + 1;
      const autres = (col) => rangsProvisions.map((r) => `${col}${r}`).join('+');
      ajouter({ A: t('TOTAL GÉNÉRAL', 5), C: formule(`C${totauxBlocs.totales}+${autres('C')}`, b.depensesPrevu, 6), D: formule(`D${totauxBlocs.totales}+${autres('D')}`, b.depensesReel, 6), E: formule(`C${rg}-D${rg}`, null, 6) });
      totauxBlocs.general = rg;
    }
  }
  ajouter({});
  const [d, f] = totauxBlocs.revenuPlage || [0, 0];
  const rr = rangs.length + 1;
  ajouter({ A: t('TOTAL REVENUS', 5), C: formule(`SUM(C${d}:C${f})`, b.revenusPrevu, 6), D: formule(`SUM(D${d}:D${f})`, b.revenusReel, 6), E: formule(`C${rr}-D${rr}`, null, 6) });
  ajouter({});
  const rs = rangs.length + 1;
  ajouter({ A: t('SOLDE', 5), C: formule(`C${rr}-C${totauxBlocs.general ?? totauxBlocs.totales}`, b.soldePrevu, 6), D: formule(`D${rr}-D${totauxBlocs.general ?? totauxBlocs.totales}`, b.soldeReel, 6) });
  if (b.report) {
    ajouter({ A: t('Report du mois précédent'), D: montant(b.report), F: t(b.reportAuto ? 'Solde avec report du mois précédent' : (mois.note_report || 'Saisi à la main'), 4) });
    const rp = rangs.length;
    ajouter({ A: t('Solde avec report', 5), D: formule(`D${rs}+D${rp}`, b.soldeAvecReport, 6) });
  }
  return { rangs, budget: b };
}

function xmlFeuille(rangs) {
  const lignesXml = rangs.map((rg, i) => {
    const r = i + 1;
    const cells = Object.entries(rg.cellules).filter(([, c]) => c).map(([col, c]) => {
      const ref = `${col}${r}`;
      if (c.t != null) return `<c r="${ref}" t="inlineStr" s="${c.s}"><is><t xml:space="preserve">${echap(c.t)}</t></is></c>`;
      if (c.f != null) return `<c r="${ref}" s="${c.s}"><f>${echap(c.f)}</f>${c.v != null ? `<v>${nombre(c.v)}</v>` : ''}</c>`;
      return `<c r="${ref}" s="${c.s}"><v>${nombre(c.n)}</v></c>`;
    }).join('');
    return `<row r="${r}">${cells}</row>`;
  }).join('');
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
    + '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
    + '<cols><col min="1" max="1" width="40" customWidth="1"/><col min="2" max="2" width="16" customWidth="1"/><col min="3" max="5" width="13" customWidth="1"/><col min="6" max="6" width="70" customWidth="1"/></cols>'
    + `<sheetData>${lignesXml}</sheetData></worksheet>`;
}

const STYLES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
  + '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
  + '<numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00\\ &quot;€&quot;"/></numFmts>'
  + '<fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><i/><sz val="10"/><color rgb="FF5B6F66"/><name val="Calibri"/></font></fonts>'
  + '<fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>'
  + '<fill><patternFill patternType="solid"><fgColor rgb="FFDCEBDF"/><bgColor indexed="64"/></patternFill></fill>'
  + '<fill><patternFill patternType="solid"><fgColor rgb="FFF1F5F2"/><bgColor indexed="64"/></patternFill></fill></fills>'
  + '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
  + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
  + '<cellXfs count="7">'
  + '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
  + '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>'
  + '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'
  + '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>'
  + '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>'
  + '<xf numFmtId="0" fontId="1" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1"/>'
  + '<xf numFmtId="164" fontId="1" fillId="3" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1"/>'
  + '</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';

function fichiersXlsx(nomFeuille, feuilleXml) {
  return {
    '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
    '_rels/.rels': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${echap(nomFeuille)}" sheetId="1" r:id="rId1"/></sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`,
    'xl/_rels/workbook.xml.rels': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
    'xl/styles.xml': STYLES,
    'xl/worksheets/sheet1.xml': feuilleXml,
  };
}

// ---------- ZIP (méthode « stockée », sans compression) ----------
const TABLE_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
const crc32 = (o) => { let c = 0xFFFFFFFF; for (let i = 0; i < o.length; i++) c = TABLE_CRC[(c ^ o[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };

export function zip(fichiers) {
  const enc = new TextEncoder();
  const morceaux = []; const central = []; let decalage = 0;
  const maintenant = new Date();
  const heure = (maintenant.getHours() << 11) | (maintenant.getMinutes() << 5) | (maintenant.getSeconds() >> 1);
  const jour = ((maintenant.getFullYear() - 1980) << 9) | ((maintenant.getMonth() + 1) << 5) | maintenant.getDate();
  for (const [nom, contenu] of Object.entries(fichiers)) {
    const n = enc.encode(nom); const d = enc.encode(contenu); const crc = crc32(d);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true); local.setUint16(4, 20, true); local.setUint16(6, 0x0800, true); local.setUint16(8, 0, true);
    local.setUint16(10, heure, true); local.setUint16(12, jour, true); local.setUint32(14, crc, true);
    local.setUint32(18, d.length, true); local.setUint32(22, d.length, true); local.setUint16(26, n.length, true); local.setUint16(28, 0, true);
    morceaux.push(new Uint8Array(local.buffer), n, d);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true);
    c.setUint16(12, heure, true); c.setUint16(14, jour, true); c.setUint32(16, crc, true); c.setUint32(20, d.length, true); c.setUint32(24, d.length, true);
    c.setUint16(28, n.length, true); c.setUint16(30, 0, true); c.setUint16(32, 0, true); c.setUint16(34, 0, true); c.setUint16(36, 0, true);
    c.setUint32(38, 0, true); c.setUint32(42, decalage, true);
    central.push(new Uint8Array(c.buffer), n);
    decalage += 30 + n.length + d.length;
  }
  const tailleCentral = central.reduce((s, x) => s + x.length, 0);
  const fin = new DataView(new ArrayBuffer(22));
  const nb = Object.keys(fichiers).length;
  fin.setUint32(0, 0x06054b50, true); fin.setUint16(8, nb, true); fin.setUint16(10, nb, true);
  fin.setUint32(12, tailleCentral, true); fin.setUint32(16, decalage, true);
  const parts = [...morceaux, ...central, new Uint8Array(fin.buffer)];
  const total = parts.reduce((s, x) => s + x.length, 0);
  const out = new Uint8Array(total); let p = 0;
  for (const x of parts) { out.set(x, p); p += x.length; }
  return out;
}

export function classeurDuMois(mois, lignes, reportLie) {
  const { rangs } = feuilleDuMois(mois, lignes, reportLie);
  return zip(fichiersXlsx(`Budget ${nomMois(mois.id)}`.slice(0, 31), xmlFeuille(rangs)));
}

/** Déclenche le téléchargement sur le téléphone (dossier Téléchargements). */
export function telechargerMois(mois, lignes, reportLie) {
  const octets = classeurDuMois(mois, lignes, reportLie);
  const blob = new Blob([octets], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `Budget_Guillaume-Anne_${mois.id}.xlsx`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
