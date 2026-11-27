// Fonction serverless Vercel : reçoit le formulaire /demande-de-projet/ et envoie 2 e-mails via Resend
// 1) la demande complète à AQUA-R-WEB  2) un accusé de réception automatique au client
// Variables d'environnement Vercel :
//   RESEND_API_KEY  (obligatoire)  clé API Resend
//   RESEND_FROM     (conseillé)    ex. "AQUA-R-WEB <contact@creation-web-moselle.fr>" (domaine vérifié chez Resend)
//   CONTACT_TO      (optionnel)    destinataire des demandes, défaut aquaweb57@gmail.com

const LABELS = {
  type_demande: 'Type de demande',
  nom: 'Nom', entreprise: 'Entreprise', email: 'E-mail', telephone: 'Téléphone',
  ville: 'Ville / zone', secteur: "Secteur d'activité",
  site_actuel: 'Site actuel', hebergeur_actuel: 'Hébergeur / accès actuel', probleme_actuel: 'Ce qui ne va pas sur le site actuel',
  formule: 'Formule souhaitée', objectifs: 'Objectifs', pages: 'Pages souhaitées', fonctions: 'Fonctionnalités',
  logo: 'Logo', couleurs: 'Couleurs / style', inspirations: 'Sites qui plaisent',
  textes: 'Textes', photos: 'Photos', domaine: 'Nom de domaine', domaine_souhaite: 'Domaine souhaité / actuel',
  mots_cles: 'Mots-clés visés', delai: 'Délai', budget: 'Budget', message: 'Message',
  rappel: 'Préférence de contact'
};
const ORDER = Object.keys(LABELS);

const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clean = (v, max = 2000) => {
  if (Array.isArray(v)) return v.slice(0, 30).map((x) => String(x).slice(0, 200)).join(', ');
  return String(v ?? '').trim().slice(0, max);
};

function table(data) {
  const rows = ORDER.filter((k) => data[k]).map((k) =>
    `<tr><td style="padding:8px 12px;border-bottom:1px solid #e5efe9;color:#4b6b5e;font-weight:600;vertical-align:top;width:38%">${esc(LABELS[k])}</td>` +
    `<td style="padding:8px 12px;border-bottom:1px solid #e5efe9;color:#0b2a20;white-space:pre-wrap">${esc(data[k])}</td></tr>`).join('');
  return `<table style="width:100%;border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px">${rows}</table>`;
}

function layout(title, intro, body) {
  return `<div style="background:#f1fbf7;padding:24px;font-family:Arial,sans-serif">
  <div style="max-width:640px;margin:auto;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #d6eee4">
    <div style="background:#04140F;color:#10E0A0;padding:18px 24px;font-size:20px;font-weight:800">AQUA-R-<span style="color:#fff">WEB</span></div>
    <div style="padding:24px"><h1 style="font-size:20px;color:#0b2a20;margin:0 0 10px">${title}</h1>
    <p style="color:#33574a;line-height:1.6;margin:0 0 18px">${intro}</p>${body}</div>
    <div style="padding:16px 24px;background:#f7fcfa;color:#5b7d70;font-size:12px">AQUA-R-WEB · Création de sites internet en Moselle · 07 87 20 25 94 · creation-web-moselle.fr</div>
  </div></div>`;
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
  for (const k of ORDER) data[k] = clean(body[k], k === 'message' || k === 'probleme_actuel' ? 4000 : 500);

  if (!data.nom || !data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    return res.status(400).json({ ok: false, error: 'Nom et e-mail valides obligatoires' });
  }
  if (!body.rgpd) return res.status(400).json({ ok: false, error: 'Consentement requis' });

  const from = process.env.RESEND_FROM || 'AQUA-R-WEB <onboarding@resend.dev>';
  const to = process.env.CONTACT_TO || 'aquaweb57@gmail.com';
  const type = data.type_demande || 'Demande';

  try {
    // 1) demande complète pour AQUA-R-WEB
    await sendResend({
      from, to: [to], reply_to: data.email,
      subject: `🆕 ${type} — ${data.entreprise || data.nom}${data.formule ? ' — ' + data.formule : ''}`,
      html: layout(`Nouvelle demande : ${esc(type)}`,
        `Demande reçue depuis le formulaire client de creation-web-moselle.fr. Répondez directement à cet e-mail pour écrire à ${esc(data.nom)}.`,
        table(data))
    });
  } catch (e) {
    console.error(e);
    return res.status(502).json({ ok: false, error: "L'envoi a échoué" });
  }

  // 2) accusé de réception automatique au client (ne bloque pas la réponse en cas d'échec)
  let confirmation = true;
  try {
    await sendResend({
      from, to: [data.email], reply_to: to,
      subject: 'Votre demande de projet web a bien été reçue — AQUA-R-WEB',
      html: layout(`Merci ${esc(data.nom)}, votre demande est bien arrivée ✅`,
        `Nous étudions votre projet et revenons vers vous <strong>sous 24h</strong> avec un devis gratuit et sans engagement. Voici le récapitulatif de ce que vous nous avez envoyé. Pour ajouter une précision, répondez simplement à cet e-mail ou appelez le 07 87 20 25 94.`,
        table(data))
    });
  } catch (e) { console.error(e); confirmation = false; }

  return res.status(200).json({ ok: true, confirmation });
};
