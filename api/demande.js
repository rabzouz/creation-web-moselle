// Fonction serverless Vercel : reçoit le formulaire /demande-de-projet/ et envoie 2 e-mails via Resend
// 1) la fiche de demande complète à AQUA-R-WEB   2) un accusé de réception automatique au client
// Variables d'environnement Vercel :
//   RESEND_API_KEY  (obligatoire)  clé API Resend
//   RESEND_FROM     (conseillé)    ex. "AQUA-R-WEB <contact@creation-web-moselle.fr>" (domaine vérifié chez Resend)
//   CONTACT_TO      (optionnel)    destinataire des demandes, défaut aquaweb57@gmail.com

const PHONE = '07 87 20 25 94';
const PHONE_LINK = 'tel:+33787202594';
const SITE = 'https://creation-web-moselle.fr';

// Fiche organisée en rubriques : [titre, [[champ, libellé], ...]]
const SECTIONS = [
  ['👤 Le client', [
    ['nom', 'Nom et prénom'], ['entreprise', 'Entreprise'], ['email', 'E-mail'],
    ['telephone', 'Téléphone'], ['rappel', 'Préfère être recontacté'],
    ['secteur', "Secteur d'activité"], ['ville', 'Ville / zone desservie']
  ]],
  ['🎯 Le projet', [
    ['type_demande', 'Type de demande'], ['formule', 'Formule choisie'],
    ['objectifs', 'Objectifs'], ['mots_cles', 'Mots-clés visés sur Google']
  ]],
  ['🔧 Site actuel à reprendre', [
    ['site_actuel', 'Adresse du site'], ['hebergeur_actuel', 'Hébergeur / accès'],
    ['probleme_actuel', 'Problèmes constatés']
  ]],
  ['🧩 Contenu du site', [
    ['pages', 'Pages souhaitées'], ['fonctions', 'Fonctionnalités']
  ]],
  ['🎨 Image et contenus', [
    ['logo', 'Logo'], ['couleurs', 'Couleurs / style'], ['inspirations', 'Sites qui plaisent'],
    ['textes', 'Textes'], ['photos', 'Photos'],
    ['domaine', 'Nom de domaine'], ['domaine_souhaite', 'Nom souhaité ou actuel']
  ]],
  ['📅 Délai et budget', [
    ['delai', 'Délai souhaité'], ['budget', 'Budget']
  ]],
  ['💬 Message du client', [
    ['message', '']
  ]]
];
const FIELDS = SECTIONS.flatMap(([, f]) => f.map(([k]) => k));

const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clean = (v, max = 500) => {
  if (Array.isArray(v)) return v.slice(0, 30).map((x) => String(x).trim().slice(0, 200)).filter(Boolean).join(' · ');
  return String(v ?? '').trim().slice(0, max);
};

// ---------- rendu HTML ----------
function sectionsHtml(data) {
  return SECTIONS.map(([title, fields]) => {
    const rows = fields.filter(([k]) => data[k]);
    if (!rows.length) return '';
    const body = rows.map(([k, label]) => label
      ? `<tr><td style="padding:7px 0;color:#5b7d70;font-size:13px;vertical-align:top;width:40%">${esc(label)}</td>` +
        `<td style="padding:7px 0;color:#0b2a20;font-size:14px;font-weight:600;white-space:pre-wrap">${esc(data[k])}</td></tr>`
      : `<tr><td colspan="2" style="padding:7px 0;color:#0b2a20;font-size:14px;line-height:1.6;white-space:pre-wrap">${esc(data[k])}</td></tr>`
    ).join('');
    return `<div style="margin:0 0 18px;padding:14px 18px;border:1px solid #d6eee4;border-radius:12px;background:#fbfefd">
      <div style="font-size:15px;font-weight:800;color:#0b2a20;margin:0 0 6px">${title}</div>
      <table role="presentation" style="width:100%;border-collapse:collapse;font-family:Arial,sans-serif">${body}</table></div>`;
  }).join('');
}

function button(href, label, primary) {
  return `<a href="${href}" style="display:inline-block;margin:0 8px 10px 0;padding:11px 18px;border-radius:10px;font-weight:700;font-size:14px;text-decoration:none;` +
    (primary ? 'background:#10E0A0;color:#04140F' : 'background:#ffffff;color:#0b2a20;border:1px solid #b9e3d2') + `">${label}</a>`;
}

function layout(preheader, title, introHtml, bodyHtml) {
  return `<!doctype html><html lang="fr"><body style="margin:0;background:#eef8f4">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader)}</div>
  <div style="padding:24px 12px;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:640px;margin:auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #d6eee4">
    <div style="background:#ffffff;padding:16px 24px;border-bottom:3px solid #10E0A0;text-align:center">
      <a href="${SITE}"><img src="${SITE}/logo-aqua-r-web-complet-blanc.png" width="280" alt="AQUA-R-WEB – Création Web, SEO local, IA générative" style="display:inline-block;max-width:100%;height:auto;border:0"></a></div>
    <div style="padding:24px">
      <h1 style="font-size:20px;line-height:1.3;color:#0b2a20;margin:0 0 12px">${title}</h1>
      <div style="color:#33574a;font-size:15px;line-height:1.6;margin:0 0 20px">${introHtml}</div>
      ${bodyHtml}
    </div>
    <div style="padding:16px 24px;background:#f5fbf8;color:#5b7d70;font-size:12px;line-height:1.6">
      AQUA-R-WEB, service web d'AQUA-R-FLY · 60 Route d'Ars, 57130 Jussy<br>
      📞 <a href="${PHONE_LINK}" style="color:#0b7a58">${PHONE}</a> · 🌐 <a href="${SITE}" style="color:#0b7a58">creation-web-moselle.fr</a>
    </div>
  </div></div></body></html>`;
}

// ---------- rendu texte (meilleure délivrabilité) ----------
function sectionsText(data) {
  return SECTIONS.map(([title, fields]) => {
    const rows = fields.filter(([k]) => data[k]);
    if (!rows.length) return '';
    return title.replace(/^\S+\s/, '').toUpperCase() + '\n' +
      rows.map(([k, label]) => (label ? `- ${label} : ` : '') + data[k]).join('\n');
  }).filter(Boolean).join('\n\n');
}

async function sendResend(payload) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!r.ok) throw new Error(`Resend ${r.status}: ${await r.text()}`);
  return r.json();
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ ok: false, error: 'Méthode non autorisée' }); }
  if (!process.env.RESEND_API_KEY) return res.status(500).json({ ok: false, error: 'Envoi non configuré' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};

  // anti-spam : champ piège rempli par les robots
  if (body.site_web_confirm) return res.status(200).json({ ok: true });

  const data = {};
  for (const k of FIELDS) data[k] = clean(body[k], k === 'message' ? 4000 : 500);

  if (!data.nom || !data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    return res.status(400).json({ ok: false, error: 'Nom et e-mail valides obligatoires' });
  }
  if (!body.rgpd) return res.status(400).json({ ok: false, error: 'Consentement requis' });

  const isReprise = /reprise|refonte/i.test(data.type_demande);
  if (!isReprise) { data.site_actuel = ''; data.hebergeur_actuel = ''; data.probleme_actuel = ''; }

  const from = process.env.RESEND_FROM || 'AQUA-R-WEB <onboarding@resend.dev>';
  const to = process.env.CONTACT_TO || 'aquaweb57@gmail.com';
  const qui = data.entreprise ? `${data.nom} (${data.entreprise})` : data.nom;
  const typeCourt = isReprise ? 'Reprise / refonte de site' : 'Création de site';
  const prenom = data.nom.split(/\s+/)[0];
  const telDigits = data.telephone.replace(/[^\d+]/g, '');
  const waNum = telDigits.replace(/^\+/, '').replace(/^0/, '33');

  // 1) fiche de demande pour AQUA-R-WEB
  const actions = [
    button(`mailto:${encodeURIComponent(data.email)}?subject=${encodeURIComponent('Votre projet de site internet – AQUA-R-WEB')}`, '✉️ Répondre par e-mail', true),
    telDigits ? button(`tel:${telDigits}`, `📞 Appeler ${esc(prenom)}`) : '',
    telDigits ? button(`https://wa.me/${waNum}`, '💬 WhatsApp') : ''
  ].join('');

  try {
    await sendResend({
      from, to: [to], reply_to: data.email,
      subject: `Nouvelle demande : ${typeCourt} – ${qui}`,
      html: layout(
        `${typeCourt} – ${data.formule || 'formule à définir'} – ${data.ville || ''}`,
        `📥 Nouvelle demande de ${esc(qui)}`,
        `<p style="margin:0 0 6px"><strong>${esc(typeCourt)}</strong>${data.formule ? ` · ${esc(data.formule)}` : ''}${data.delai ? ` · ${esc(data.delai)}` : ''}</p>
         <p style="margin:0 0 14px">Le client attend un retour <strong>sous 24h</strong>${data.rappel ? `, de préférence <strong>${esc(data.rappel.toLowerCase())}</strong>` : ''}.</p>${actions}`,
        sectionsHtml(data)
      ),
      text: `Nouvelle demande de ${qui}\n${typeCourt}${data.formule ? ' – ' + data.formule : ''}\n\n${sectionsText(data)}\n\nRépondez directement à cet e-mail pour écrire au client.`
    });
  } catch (e) {
    console.error(e);
    return res.status(502).json({ ok: false, error: "L'envoi a échoué" });
  }

  // 2) accusé de réception automatique au client
  let confirmation = true;
  try {
    await sendResend({
      from, to: [data.email], reply_to: to,
      subject: 'Nous avons bien reçu votre demande – AQUA-R-WEB',
      html: layout(
        'Merci pour votre demande. Nous revenons vers vous sous 24h avec un devis gratuit.',
        `Merci ${esc(prenom)}, votre demande est bien arrivée ✅`,
        `<p style="margin:0 0 12px">Nous avons bien reçu votre demande de <strong>${esc(typeCourt.toLowerCase())}</strong>. Nous l'étudions et nous vous recontactons <strong>sous 24h</strong> avec un devis gratuit et sans engagement.</p>
         <p style="margin:0 0 6px;font-weight:700;color:#0b2a20">La suite, en 3 étapes :</p>
         <ol style="margin:0 0 14px;padding-left:20px">
           <li>Nous échangeons avec vous sur votre activité et vos objectifs.</li>
           <li>Vous recevez un devis détaillé et une proposition de design.</li>
           <li>Nous créons votre site, vous validez, et il est mis en ligne.</li>
         </ol>
         <p style="margin:0 0 14px">Vous avez oublié un détail ? Répondez simplement à cet e-mail. Pour aller plus vite, appelez-nous au <a href="${PHONE_LINK}" style="color:#0b7a58;font-weight:700">${PHONE}</a>.</p>
         <p style="margin:0;font-size:13px;color:#5b7d70">Voici le récapitulatif de votre demande :</p>`,
        sectionsHtml(data) + `<p style="margin:6px 0 0;color:#33574a">À très bientôt,<br><strong>L'équipe AQUA-R-WEB</strong></p>`
      ),
      text: `Bonjour ${prenom},\n\nNous avons bien reçu votre demande de ${typeCourt.toLowerCase()}. Nous l'étudions et nous vous recontactons sous 24h avec un devis gratuit et sans engagement.\n\nVous avez oublié un détail ? Répondez simplement à cet e-mail, ou appelez-nous au ${PHONE}.\n\nRÉCAPITULATIF\n\n${sectionsText(data)}\n\nÀ très bientôt,\nL'équipe AQUA-R-WEB\n${SITE}`
    });
  } catch (e) { console.error(e); confirmation = false; }

  return res.status(200).json({ ok: true, confirmation });
};
