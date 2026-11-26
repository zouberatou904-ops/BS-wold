let me = null;          // utilisateur connecté
let avatarUrl = null;   // photo actuelle
let newPhoto = null;    // Blob de la nouvelle photo (pas encore envoyée)

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Photo réduite et recadrée en carré (512 px) avant l'envoi : légère pour le téléphone
function squarePhoto(file, size) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const s = Math.min(img.width, img.height);
      const c = document.createElement("canvas");
      c.width = c.height = size;
      const g = c.getContext("2d");
      g.fillStyle = "#fff"; g.fillRect(0, 0, size, size);
      g.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
      URL.revokeObjectURL(url);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error("Photo illisible."))), "image/jpeg", 0.85);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Photo illisible. Choisis une photo JPG ou PNG.")); };
    img.src = url;
  });
}

function render(profile) {
  const nom = profile.nom_complet || "";
  const initial = (nom || (me.email || "M"))[0].toUpperCase();
  document.getElementById("pfBox").innerHTML =
    '<div class="pf-photo">' +
      '<div class="pf-avatar" id="pfAvatar"' + (avatarUrl ? ' style="background-image:url(\'' + esc(avatarUrl) + '\')"' : '') + '>' +
        '<span id="pfInitial">' + (avatarUrl ? "" : esc(initial)) + '</span>' +
        '<div class="pf-cam"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#06201d" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg></div>' +
      '</div>' +
      '<button class="pf-btn small ghost" type="button" id="pfPick">Changer la photo</button>' +
    '</div>' +
    '<div class="pf-field"><label for="pfNom">Ton nom</label><input id="pfNom" maxlength="60" autocomplete="name" value="' + esc(nom) + '" placeholder="Ex : KOFFI Jean"></div>' +
    '<div class="pf-field"><label for="pfWa">WhatsApp</label><input id="pfWa" readonly value="' + esc(profile.whatsapp || "") + '"></div>' +
    '<div class="pf-field"><label for="pfMail">Email</label><input id="pfMail" readonly value="' + esc(me.email || "") + '"></div>' +
    '<div class="pf-msg" id="pfMsg" role="status"></div>' +
    '<button class="pf-btn" type="button" id="pfSave">Enregistrer</button>' +
    '<button class="pf-btn ghost" type="button" id="pfOut">Se déconnecter</button>';

  document.getElementById("pfPick").addEventListener("click", () => document.getElementById("pfFile").click());
  document.getElementById("pfAvatar").addEventListener("click", () => document.getElementById("pfFile").click());
  document.getElementById("pfSave").addEventListener("click", save);
  document.getElementById("pfOut").addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
    window.location.href = "login.html";
  });
}

function say(t, cls) {
  const m = document.getElementById("pfMsg");
  m.textContent = t || "";
  m.className = "pf-msg" + (cls ? " " + cls : "");
}

document.getElementById("pfFile").addEventListener("change", async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  try {
    newPhoto = await squarePhoto(f, 512);
    const url = URL.createObjectURL(newPhoto);
    const a = document.getElementById("pfAvatar");
    a.style.backgroundImage = "url('" + url + "')";
    document.getElementById("pfInitial").textContent = "";
    say("Photo prête. Appuie sur Enregistrer.", "ok");
  } catch (err) { say(err.message, "err"); }
});

async function save() {
  const nom = document.getElementById("pfNom").value.trim().replace(/\s+/g, " ");
  if (nom.length < 2) { say("Écris ton nom (2 lettres minimum).", "err"); return; }
  const btn = document.getElementById("pfSave");
  btn.disabled = true; btn.textContent = "Enregistrement...";
  say("");
  try {
    const patch = { nom_complet: nom };
    if (newPhoto) {
      const path = me.id + "/avatar.jpg";
      const up = await supabaseClient.storage.from("avatars").upload(path, newPhoto, { contentType: "image/jpeg", upsert: true, cacheControl: "3600" });
      if (up.error) throw up.error;
      const pub = supabaseClient.storage.from("avatars").getPublicUrl(path).data.publicUrl;
      patch.avatar_url = pub + "?v=" + Date.now();   // force l'affichage de la nouvelle photo
    }
    const r = await supabaseClient.from("profiles").update(patch).eq("id", me.id);
    if (r.error) throw r.error;
    if (patch.avatar_url) { avatarUrl = patch.avatar_url; newPhoto = null; }
    say("Profil enregistré ✅", "ok");
  } catch (err) {
    const m = (err && err.message) || "";
    say(/bucket not found/i.test(m) ? "Les photos ne sont pas encore activées (profil.sql à lancer)." : /avatar_url/i.test(m) ? "Colonne photo manquante (profil.sql à lancer)." : m || "Une erreur est survenue.", "err");
  }
  btn.disabled = false; btn.textContent = "Enregistrer";
}

async function init() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) { window.location.href = "login.html"; return; }
  me = session.user;
  let profile = null;
  let r = await supabaseClient.from("profiles").select("nom_complet, whatsapp, avatar_url").eq("id", me.id).maybeSingle();
  if (r.error) {   // colonne photo pas encore créée : on affiche quand même le nom
    r = await supabaseClient.from("profiles").select("nom_complet, whatsapp").eq("id", me.id).maybeSingle();
  }
  profile = r.data || {};
  avatarUrl = profile.avatar_url || null;
  render(profile);
}
init();
