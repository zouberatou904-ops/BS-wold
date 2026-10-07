const WHATSAPP_NUMBER = "2290129496270"; // +229 01 29 49 62 70
const BUCKET = "affiliation";
const MAX_FILE = 5 * 1024 * 1024;

let currentUser = null;
const box = () => document.getElementById("content");

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function waLink(nom) {
  const msg = "Bonjour, je suis " + (nom || "") + ". Ma candidature Affiliation BS WOLD a été validée, je voudrais commencer.";
  return "https://wa.me/" + WHATSAPP_NUMBER + "?text=" + encodeURIComponent(msg);
}

async function init() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) { window.location.href = "login.html"; return; }
  currentUser = session.user;
  await render();
}

async function render() {
  const { data, error } = await supabaseClient.from("affiliation_candidatures")
    .select("*").eq("user_id", currentUser.id).maybeSingle();

  if (error) {
    box().innerHTML = '<div class="aff-card"><p>Erreur : ' + esc(error.message) + '</p></div>';
    return;
  }
  if (!data) return showForm();
  if (data.statut === "valide") return showValide(data);
  if (data.statut === "refuse") return showRefuse(data);
  return showAttente(data);
}

async function showForm() {
  let prefill = "";
  try {
    const { data: p } = await supabaseClient.from("profiles").select("nom_complet").eq("id", currentUser.id).maybeSingle();
    if (p && p.nom_complet) prefill = p.nom_complet;
  } catch (e) {}

  box().innerHTML =
    '<div class="aff-card"><h2>Devenir revendeur</h2>' +
    '<p>Remplis ce formulaire. Après vérification, tu seras mis en contact sur WhatsApp pour recevoir tes produits.</p>' +
    '<div class="aff-field"><label>Nom complet</label><input type="text" id="f-nom" value="' + esc(prefill) + '"></div>' +
    '<div class="aff-field"><label>Numéro WhatsApp</label><input type="tel" id="f-tel" placeholder="01 XX XX XX XX"></div>' +
    '<div class="aff-field"><label>Ville et quartier</label><input type="text" id="f-ville"></div>' +
    '<div class="aff-field"><label>Adresse du domicile (repères)</label><textarea id="f-adresse" rows="3"></textarea></div>' +
    '<div class="aff-field"><label>Photo de ta pièce d\'identité ou carte scolaire</label><input type="file" id="f-piece" accept="image/*"></div>' +
    '<button class="aff-btn" id="f-send">Envoyer ma candidature</button>' +
    '<div class="aff-err" id="f-err"></div></div>';

  document.getElementById("f-send").addEventListener("click", submitForm);
}

async function submitForm() {
  const err = document.getElementById("f-err");
  const btn = document.getElementById("f-send");
  err.textContent = "";

  const nom = document.getElementById("f-nom").value.trim();
  const tel = document.getElementById("f-tel").value.trim();
  const ville = document.getElementById("f-ville").value.trim();
  const adresse = document.getElementById("f-adresse").value.trim();
  const file = document.getElementById("f-piece").files[0];

  if (!nom || !tel || !ville || !adresse) { err.textContent = "Remplis tous les champs."; return; }
  if (!file) { err.textContent = "Ajoute la photo de ta pièce."; return; }
  if (!file.type.startsWith("image/")) { err.textContent = "Le fichier doit être une image."; return; }
  if (file.size > MAX_FILE) { err.textContent = "Image trop lourde (5 Mo maximum)."; return; }

  btn.disabled = true; btn.textContent = "Envoi...";

  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = currentUser.id + "/" + Date.now() + "." + (ext || "jpg");

  const up = await supabaseClient.storage.from(BUCKET).upload(path, file, { contentType: file.type });
  if (up.error) { err.textContent = "Erreur photo : " + up.error.message; btn.disabled = false; btn.textContent = "Envoyer ma candidature"; return; }

  const ins = await supabaseClient.from("affiliation_candidatures").insert({
    user_id: currentUser.id, nom: nom, telephone: tel, ville: ville, adresse: adresse, piece_path: path
  });
  if (ins.error) { err.textContent = "Erreur : " + ins.error.message; btn.disabled = false; btn.textContent = "Envoyer ma candidature"; return; }

  await render();
}

function showAttente(c) {
  box().innerHTML =
    '<div class="aff-card"><div class="aff-big">⏳</div><h2 style="text-align:center">Candidature en cours d\'examen</h2>' +
    '<p style="text-align:center">Merci ' + esc(c.nom) + '. Ton dossier est en cours de vérification. Reviens ici : dès qu\'il est validé, tu auras accès à WhatsApp.</p>' +
    '<button class="aff-btn ghost" id="refresh">Actualiser</button></div>';
  document.getElementById("refresh").addEventListener("click", render);
}

function showValide(c) {
  box().innerHTML =
    '<div class="aff-card"><div class="aff-big">✅</div><h2 style="text-align:center">Candidature validée</h2>' +
    '<p style="text-align:center">Bienvenue ' + esc(c.nom) + ' ! Continue sur WhatsApp : c\'est là que tu recevras tes produits et que ton suivi sera fait.</p>' +
    '<a class="aff-btn wa" href="' + waLink(c.nom) + '" target="_blank" rel="noopener">Ouvrir WhatsApp</a></div>';
}

function showRefuse(c) {
  box().innerHTML =
    '<div class="aff-card"><div class="aff-big">❌</div><h2 style="text-align:center">Candidature non retenue</h2>' +
    '<p style="text-align:center">Ton dossier n\'a pas été accepté pour le moment. Tu peux nous écrire sur WhatsApp pour en savoir plus.</p>' +
    '<a class="aff-btn ghost" href="https://wa.me/' + WHATSAPP_NUMBER + '" target="_blank" rel="noopener">Nous contacter</a></div>';
}

init();
