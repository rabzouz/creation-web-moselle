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

// Traductions des titres / libellés pour l'accusé de réception (EN, LB)
const T_LABELS = {
  en: {
    '👤 Le client': '👤 Your details', '🎯 Le projet': '🎯 Your project', '🔧 Site actuel à reprendre': '🔧 Current website',
    '🧩 Contenu du site': '🧩 Website content', '🎨 Image et contenus': '🎨 Branding and content', '📅 Délai et budget': '📅 Timing and budget',
    '💬 Message du client': '💬 Your message',
    'Nom et prénom': 'Full name', 'Entreprise': 'Company', 'E-mail': 'Email', 'Téléphone': 'Phone', 'Préfère être recontacté': 'Preferred contact',
    "Secteur d'activité": 'Business sector', 'Ville / zone desservie': 'Town / area served', 'Type de demande': 'Request type',
    'Formule choisie': 'Package', 'Objectifs': 'Goals', 'Mots-clés visés sur Google': 'Target keywords on Google',
    'Adresse du site': 'Website address', 'Hébergeur / accès': 'Host / access', 'Problèmes constatés': 'Issues',
    'Pages souhaitées': 'Pages', 'Fonctionnalités': 'Features', 'Logo': 'Logo', 'Couleurs / style': 'Colours / style',
    'Sites qui plaisent': 'Websites you like', 'Textes': 'Copy', 'Photos': 'Photos', 'Nom de domaine': 'Domain name',
    'Nom souhaité ou actuel': 'Desired or current name', 'Délai souhaité': 'Timeframe', 'Budget': 'Budget'
  },
  lb: {
    '👤 Le client': '👤 Är Kontaktdaten', '🎯 Le projet': '🎯 Äre Projet', '🔧 Site actuel à reprendre': '🔧 Aktuell Websäit',
    '🧩 Contenu du site': '🧩 Inhalt vun der Websäit', '🎨 Image et contenus': '🎨 Image an Inhalter', '📅 Délai et budget': '📅 Delai a Budget',
    '💬 Message du client': '💬 Äre Message',
    'Nom et prénom': 'Numm a Virnumm', 'Entreprise': 'Betrib', 'E-mail': 'E-Mail', 'Téléphone': 'Telefon', 'Préfère être recontacté': 'Kontakt am léifsten',
    "Secteur d'activité": 'Branche', 'Ville / zone desservie': 'Stad / Gebitt', 'Type de demande': 'Zort Ufro',
    'Formule choisie': 'Formule', 'Objectifs': 'Ziler', 'Mots-clés visés sur Google': 'Schlësselwierder op Google',
    'Adresse du site': 'Adress vun der Websäit', 'Hébergeur / accès': 'Hosting / Zougang', 'Problèmes constatés': 'Problemer',
    'Pages souhaitées': 'Säiten', 'Fonctionnalités': 'Funktiounen', 'Logo': 'Logo', 'Couleurs / style': 'Faarwen / Stil',
    'Sites qui plaisent': 'Websäiten, déi gefalen', 'Textes': 'Texter', 'Photos': 'Fotoen', 'Nom de domaine': 'Domain-Numm',
    'Nom souhaité ou actuel': 'Gewënschten oder aktuellen Numm', 'Délai souhaité': 'Delai', 'Budget': 'Budget'
  }
};
const tl = (lang, s) => (T_LABELS[lang] && T_LABELS[lang][s]) || s;

// Textes de l'accusé de réception
const CONFIRM = {
  fr: {
    subject: 'Nous avons bien reçu votre demande – AQUA-R-WEB',
    pre: 'Merci pour votre demande. Nous revenons vers vous sous 24h avec un devis gratuit.',
    title: (p) => `Merci ${p}, votre demande est bien arrivée ✅`,
    typeNew: 'création de site', typeRe: 'reprise / refonte de site',
    intro: (t) => `Nous avons bien reçu votre demande de <strong>${t}</strong>. Nous l'étudions et nous vous recontactons <strong>sous 24h</strong> avec un devis gratuit et sans engagement.`,
    next: 'La suite, en 3 étapes :',
    steps: ['Nous échangeons avec vous sur votre activité et vos objectifs.', 'Vous recevez un devis détaillé et une proposition de design.', 'Nous créons votre site, vous validez, et il est mis en ligne.'],
    forgot: (ph) => `Vous avez oublié un détail ? Répondez simplement à cet e-mail. Pour aller plus vite, appelez-nous au ${ph}.`,
    recap: 'Voici le récapitulatif de votre demande :', bye: "À très bientôt,<br><strong>L'équipe AQUA-R-WEB</strong>",
    hello: (p) => `Bonjour ${p},`, byeText: "À très bientôt,\nL'équipe AQUA-R-WEB", recapText: 'RÉCAPITULATIF'
  },
  en: {
    subject: 'We have received your request – AQUA-R-WEB',
    pre: 'Thank you for your request. We will get back to you within 24 hours with a free quote.',
    title: (p) => `Thank you ${p}, your request has arrived ✅`,
    typeNew: 'new website', typeRe: 'website takeover / redesign',
    intro: (t) => `We have received your <strong>${t}</strong> request. We are reviewing it and will get back to you <strong>within 24 hours</strong> with a free, no-obligation quote.`,
    next: 'What happens next, in 3 steps:',
    steps: ['We talk with you about your business and your goals.', 'You receive a detailed quote and a design proposal.', 'We build your website, you approve it, and it goes live.'],
    forgot: (ph) => `Forgot a detail? Simply reply to this email. For a faster answer, call us on ${ph}.`,
    recap: 'Here is a summary of your request:', bye: 'Speak soon,<br><strong>The AQUA-R-WEB team</strong>',
    hello: (p) => `Hello ${p},`, byeText: 'Speak soon,\nThe AQUA-R-WEB team', recapText: 'SUMMARY'
  },
  lb: {
    subject: 'Mir hunn Är Ufro kritt – AQUA-R-WEB',
    pre: 'Merci fir Är Ufro. Mir mellen eis bannent 24 Stonnen mat engem gratis Devis.',
    title: (p) => `Merci ${p}, Är Ufro ass ukomm ✅`,
    typeNew: 'nei Websäit', typeRe: 'Iwwerhuelen / Iwweraarbechtung vun enger Websäit',
    intro: (t) => `Mir hunn Är Ufro fir eng <strong>${t}</strong> kritt. Mir kucken se eis un a mellen eis <strong>bannent 24 Stonnen</strong> mat engem gratis Devis ouni Engagement.`,
    next: 'Wéi et weidergeet, an 3 Etappen:',
    steps: ['Mir schwätze mat Iech iwwer Är Aktivitéit an Är Ziler.', 'Dir kritt en detailléierten Devis an en Design-Virschlag.', 'Mir maachen Är Websäit, Dir validéiert, an da geet se online.'],
    forgot: (ph) => `Dir hutt en Detail vergiess? Äntwert einfach op dës E-Mail. Fir méi séier ze goen, rufft eis un op ${ph}.`,
    recap: 'Hei de Resumé vun Ärer Ufro:', bye: 'Bis geschwënn,<br><strong>D\'AQUA-R-WEB-Equipe</strong>',
    hello: (p) => `Moien ${p},`, byeText: "Bis geschwënn,\nD'AQUA-R-WEB-Equipe", recapText: 'RESUMÉ'
  }
};

const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clean = (v, max = 500) => {
  if (Array.isArray(v)) return v.slice(0, 30).map((x) => String(x).trim().slice(0, 200)).filter(Boolean).join(' · ');
  return String(v ?? '').trim().slice(0, max);
};

// ---------- rendu HTML ----------
function sectionsHtml(data, lang = 'fr') {
  return SECTIONS.map(([title, fields]) => {
    const rows = fields.filter(([k]) => data[k]);
    if (!rows.length) return '';
    const body = rows.map(([k, label]) => label
      ? `<tr><td style="padding:7px 0;color:#5b7d70;font-size:13px;vertical-align:top;width:40%">${esc(tl(lang, label))}</td>` +
        `<td style="padding:7px 0;color:#0b2a20;font-size:14px;font-weight:600;white-space:pre-wrap">${esc(data[k])}</td></tr>`
      : `<tr><td colspan="2" style="padding:7px 0;color:#0b2a20;font-size:14px;line-height:1.6;white-space:pre-wrap">${esc(data[k])}</td></tr>`
    ).join('');
    return `<div style="margin:0 0 18px;padding:14px 18px;border:1px solid #d6eee4;border-radius:12px;background:#fbfefd">
      <div style="font-size:15px;font-weight:800;color:#0b2a20;margin:0 0 6px">${tl(lang, title)}</div>
      <table role="presentation" style="width:100%;border-collapse:collapse;font-family:Arial,sans-serif">${body}</table></div>`;
  }).join('');
}

function button(href, label, primary) {
  return `<a href="${href}" style="display:inline-block;margin:0 8px 10px 0;padding:11px 18px;border-radius:10px;font-weight:700;font-size:14px;text-decoration:none;` +
    (primary ? 'background:#10E0A0;color:#04140F' : 'background:#ffffff;color:#0b2a20;border:1px solid #b9e3d2') + `">${label}</a>`;
}

function layout(preheader, title, introHtml, bodyHtml, lang = 'fr') {
  return `<!doctype html><html lang="${lang}"><body style="margin:0;background:#eef8f4">
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
function sectionsText(data, lang = 'fr') {
  return SECTIONS.map(([title, fields]) => {
    const rows = fields.filter(([k]) => data[k]);
    if (!rows.length) return '';
    return tl(lang, title).replace(/^\S+\s/, '').toUpperCase() + '\n' +
      rows.map(([k, label]) => (label ? `- ${tl(lang, label)} : ` : '') + data[k]).join('\n');
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

  const lang = ['fr', 'en', 'lb'].includes(body.lang) ? body.lang : 'fr';
  const isReprise = body.reprise === true || /reprise|refonte|redesign|takeover|iwwerhuel|iwweraarbecht/i.test(data.type_demande);
  if (!isReprise) { data.site_actuel = ''; data.hebergeur_actuel = ''; data.probleme_actuel = ''; }

  const from = process.env.RESEND_FROM || 'AQUA-R-WEB <onboarding@resend.dev>';
  const to = process.env.CONTACT_TO || 'aquaweb57@gmail.com';
  const qui = data.entreprise ? `${data.nom} (${data.entreprise})` : data.nom;
  const typeCourt = isReprise ? 'Reprise / refonte de site' : 'Création de site';
  const langLabel = { fr: 'Français', en: 'Anglais (English)', lb: 'Luxembourgeois (Lëtzebuergesch)' }[lang];
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
      subject: `Nouvelle demande${lang !== 'fr' ? ' [' + lang.toUpperCase() + ']' : ''} : ${typeCourt} – ${qui}`,
      html: layout(
        `${typeCourt} – ${data.formule || 'formule à définir'} – ${data.ville || ''}`,
        `📥 Nouvelle demande de ${esc(qui)}`,
        `<p style="margin:0 0 6px"><strong>${esc(typeCourt)}</strong>${data.formule ? ` · ${esc(data.formule)}` : ''}${data.delai ? ` · ${esc(data.delai)}` : ''}</p>
         <p style="margin:0 0 14px">Le client attend un retour <strong>sous 24h</strong>${data.rappel ? `, de préférence <strong>${esc(data.rappel.toLowerCase())}</strong>` : ''}.${lang !== 'fr' ? `<br>🌐 Langue du client : <strong>${langLabel}</strong> – répondez-lui dans sa langue.` : ''}</p>${actions}`,
        sectionsHtml(data)
      ),
      text: `Nouvelle demande de ${qui}\n${typeCourt}${data.formule ? ' – ' + data.formule : ''}\n\n${sectionsText(data)}\n\nRépondez directement à cet e-mail pour écrire au client.`
    });
  } catch (e) {
    console.error(e);
    return res.status(502).json({ ok: false, error: "L'envoi a échoué" });
  }

  // 2) accusé de réception automatique au client, dans sa langue
  const C = CONFIRM[lang];
  const typeTxt = isReprise ? C.typeRe : C.typeNew;
  const phoneLink = `<a href="${PHONE_LINK}" style="color:#0b7a58;font-weight:700">${lang === 'fr' ? PHONE : '+33 7 87 20 25 94'}</a>`;
  let confirmation = true;
  try {
    await sendResend({
      from, to: [data.email], reply_to: to,
      subject: C.subject,
      html: layout(
        C.pre,
        C.title(esc(prenom)),
        `<p style="margin:0 0 12px">${C.intro(esc(typeTxt))}</p>
         <p style="margin:0 0 6px;font-weight:700;color:#0b2a20">${C.next}</p>
         <ol style="margin:0 0 14px;padding-left:20px">${C.steps.map((x) => `<li>${x}</li>`).join('')}</ol>
         <p style="margin:0 0 14px">${C.forgot(phoneLink)}</p>
         <p style="margin:0;font-size:13px;color:#5b7d70">${C.recap}</p>`,
        sectionsHtml(data, lang) + `<p style="margin:6px 0 0;color:#33574a">${C.bye}</p>`,
        lang
      ),
      text: `${C.hello(prenom)}\n\n${C.intro(typeTxt).replace(/<[^>]+>/g, '')}\n\n${C.forgot(lang === 'fr' ? PHONE : '+33 7 87 20 25 94')}\n\n${C.recapText}\n\n${sectionsText(data, lang)}\n\n${C.byeText}\n${SITE}`
    });
  } catch (e) { console.error(e); confirmation = false; }

  return res.status(200).json({ ok: true, confirmation });
};
