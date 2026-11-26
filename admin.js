let currentUser = null;

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

async function init() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = "login.html";
    return;
  }
  currentUser = session.user;

  const { data: profile } = await supabaseClient
    .from("profiles")
    .select("est_admin")
    .eq("id", currentUser.id)
    .maybeSingle();

  if (!profile || !profile.est_admin) {
    document.getElementById("gate").innerHTML = '<div class="empty-history">Accès refusé.</div>';
    return;
  }

  document.getElementById("gate").style.display = "none";
  document.getElementById("adminApp").style.display = "block";

  document.querySelectorAll(".admin-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".admin-tab").forEach((t) => t.classList.remove("active"));
      document.querySelectorAll(".admin-panel").forEach((p) => p.classList.remove("visible"));
      tab.classList.add("active");
      document.getElementById("panel-" + tab.dataset.tab).classList.add("visible");
    });
  });

  loadAffil();
  loadActiv();
  loadCredit();
  loadRetraits();
}

// ---- Retraits ----
const RSTAT = { en_attente: "En attente", paye: "Payé", refuse: "Refusé" };

async function loadRetraits() {
  const box = document.getElementById("listRetraits");
  const { data, error } = await supabaseClient
    .from("retraits")
    .select("id, montant, operateur, numero, nom_compte, frais, statut, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error || !data || data.length === 0) {
    box.innerHTML = '<div class="empty-history">Aucun retrait</div>';
    return;
  }

  box.innerHTML = data.map((r) => {
    const d = new Date(r.created_at).toLocaleDateString("fr-FR");
    const actions = r.statut === "en_attente"
      ? '<div class="admin-row"><button class="admin-btn-ok" onclick="setRetrait(\'' + r.id + '\',\'paye\')">Marquer payé</button>' +
        '<button class="admin-btn-no" onclick="setRetrait(\'' + r.id + '\',\'refuse\')">Refuser</button></div>'
      : '<div class="status-banner ' + (r.statut === "paye" ? "en_attente" : "refuse") + '" style="margin-top:8px">' + (RSTAT[r.statut] || r.statut) + '</div>';
    return '<div class="admin-card">' +
      '<div class="admin-card-title">À envoyer : ' + (Number(r.montant) - Number(r.frais || 0)).toFixed(2) + ' K · ' + esc(r.operateur) + '</div>' +
      '<div class="admin-card-meta">' + esc(r.numero) + (r.nom_compte ? ' · Nom : <strong>' + esc(r.nom_compte) + '</strong>' : '') + ' · ' + d + '</div>' +
      '<div class="admin-card-meta">Demandé : ' + Number(r.montant).toFixed(2) + ' K · frais gardés : ' + Number(r.frais || 0).toFixed(2) + ' K</div>' +
      actions + '</div>';
  }).join("");
}

async function setRetrait(id, statut) {
  const { error } = await supabaseClient.rpc("admin_update_retrait", { p_id: id, p_statut: statut });
  if (error) { alert(error.message); return; }
  loadRetraits();
}

init();

// ---- Candidatures Affiliation ----
function waNum(tel) {
  const d = String(tel || "").replace(/\D/g, "");
  return d.length === 10 ? "229" + d : d;
}
async function loadAffil() {
  const box = document.getElementById("listAffil");
  const { data, error } = await supabaseClient.from("affiliation_candidatures")
    .select("*").order("created_at", { ascending: false }).limit(100);
  if (error) { box.innerHTML = '<div class="empty-history">Erreur : ' + esc(error.message) + '</div>'; return; }
  if (!data || data.length === 0) { box.innerHTML = '<div class="empty-history">Aucune candidature</div>'; return; }

  const attente = data.filter((c) => c.statut === "en_attente").length;
  document.getElementById("tabAffil").textContent = attente ? "Candidatures (" + attente + ")" : "Candidatures";

  const urls = await Promise.all(data.map(async (c) => {
    const r = await supabaseClient.storage.from("affiliation").createSignedUrl(c.piece_path, 3600);
    return r.data ? r.data.signedUrl : null;
  }));

  box.innerHTML = data.map((c, i) => {
    const etat = c.statut === "valide" ? "✅ Validé" : c.statut === "refuse" ? "❌ Refusé" : "⏳ En attente";
    return '<div class="admin-card"><div class="admin-card-title">' + esc(c.nom) + '</div>' +
      '<div style="font-size:13px;opacity:.8;line-height:1.5;margin:6px 0 10px">' +
      esc(c.ville) + '<br>' + esc(c.adresse) + '<br>' + esc(c.telephone) +
      ' · <a href="https://wa.me/' + waNum(c.telephone) + '" target="_blank" rel="noopener" style="color:inherit">WhatsApp</a><br>' +
      etat + ' · ' + new Date(c.created_at).toLocaleDateString("fr-FR") + '</div>' +
      (urls[i] ? '<a href="' + urls[i] + '" target="_blank" rel="noopener" style="color:inherit;font-size:14px">📎 Voir la pièce</a>' : '') +
      '<div class="admin-row" style="margin-top:10px">' +
      '<button class="admin-btn-ok" onclick="setAffil(\'' + c.id + '\',\'valide\')">Valider</button>' +
      '<button class="admin-btn-no" onclick="setAffil(\'' + c.id + '\',\'refuse\')">Refuser</button></div></div>';
  }).join("");
}
async function setAffil(id, statut) {
  const { error } = await supabaseClient.from("affiliation_candidatures").update({ statut: statut }).eq("id", id);
  if (error) { alert(error.message); return; }
  loadAffil();
}

// ---- Créditer manuellement un solde (en K) ----
let creditUsers = [];
async function loadCredit() {
  const box = document.getElementById("listCredit");
  const { data, error } = await supabaseClient.from("profiles")
    .select("id, nom_complet, solde").order("nom_complet").limit(500);
  if (error) { box.innerHTML = '<div class="empty-history">Erreur : ' + esc(error.message) + '</div>'; return; }
  creditUsers = data || [];
  renderCredit();
}
function renderCredit() {
  const box = document.getElementById("listCredit");
  const q = (document.getElementById("searchCredit").value || "").trim().toLowerCase();
  const list = creditUsers.filter((u) => !q || (u.nom_complet || "").toLowerCase().includes(q));
  if (list.length === 0) { box.innerHTML = '<div class="empty-history">Aucun résultat</div>'; return; }
  box.innerHTML = list.map((u) =>
    '<div class="admin-card"><div class="admin-card-title">' + esc(u.nom_complet || "Sans nom") + '</div>' +
    '<div class="admin-card-meta">Solde actuel : ' + Number(u.solde || 0).toFixed(2) + ' K</div>' +
    '<div class="pct-row">' +
    '<div class="pct-field"><label>Montant à ajouter (K)</label><input type="number" step="any" id="cm-' + u.id + '" placeholder="ex : 2.5"></div>' +
    '<div class="pct-field"><label>Note (vente, produit...)</label><input type="text" id="cn-' + u.id + '"></div>' +
    '</div>' +
    '<div class="admin-row"><button class="admin-btn-ok" onclick="creditUser(\'' + u.id + '\')">Créditer</button></div></div>'
  ).join("");
}
async function creditUser(id) {
  const m = parseFloat(document.getElementById("cm-" + id).value);
  const note = document.getElementById("cn-" + id).value.trim();
  const u = creditUsers.find((x) => x.id === id);
  if (!m) { alert("Entre un montant en K."); return; }
  if (!confirm("Ajouter " + m + " K à " + (u ? u.nom_complet : "cet utilisateur") + " ?")) return;
  const { data, error } = await supabaseClient.rpc("admin_crediter", { p_id: id, p_montant: m, p_note: note || null });
  if (error) { alert(error.message); return; }
  alert("Fait ✅ Nouveau solde : " + Number(data).toFixed(2) + " K");
  loadCredit();
}

// ---- Activation : "il a travaillé" => compte actif + parrain payé (0,4 K), sans créditer le filleul ----
let activUsers = [];
async function loadActiv() {
  const box = document.getElementById("listActiv");
  const { data, error } = await supabaseClient.from("profiles")
    .select("id, nom_complet, whatsapp, telephone, compte_actif, actif_le, parraine_par, parrainage_paye, created_at")
    .order("created_at", { ascending: false }).limit(1000);
  if (error) { box.innerHTML = '<div class="empty-history">Erreur : ' + esc(error.message) + '</div>'; return; }
  activUsers = data || [];
  const nb = activUsers.filter((u) => !u.compte_actif).length;
  document.getElementById("tabActiv").textContent = nb ? "Activation (" + nb + ")" : "Activation";
  renderActiv();
}
function renderActiv() {
  const box = document.getElementById("listActiv");
  const q = (document.getElementById("searchActiv").value || "").trim().toLowerCase();
  const digits = q.replace(/\D/g, "");
  const nom = (id) => { const p = activUsers.find((x) => x.id === id); return p ? (p.nom_complet || "Sans nom") : "?"; };
  let list = activUsers.filter((u) => {
    if (!q) return true;
    const t = ((u.nom_complet || "") + " " + (u.whatsapp || "") + " " + (u.telephone || "")).toLowerCase();
    if (t.includes(q)) return true;
    return digits.length >= 4 && ((u.whatsapp || "") + (u.telephone || "")).replace(/\D/g, "").includes(digits);
  });
  list.sort((a, b) => (a.compte_actif === b.compte_actif) ? 0 : (a.compte_actif ? 1 : -1));
  list = list.slice(0, 60);
  if (list.length === 0) { box.innerHTML = '<div class="empty-history">Aucun résultat</div>'; return; }
  box.innerHTML = list.map((u) => {
    const tel = u.whatsapp || u.telephone || "";
    let info = "";
    if (u.parraine_par) {
      const p = activUsers.find((x) => x.id === u.parraine_par);
      info = "Parrain : " + esc(nom(u.parraine_par)) +
        (u.parrainage_paye ? " · 0,4 K déjà versé ✅" : (p && !p.compte_actif ? " · parrain pas encore actif (payé quand il le sera)" : " · 0,4 K à verser"));
    } else { info = "Sans parrain"; }
    const etat = u.compte_actif ? "✅ Actif" + (u.actif_le ? " depuis le " + new Date(u.actif_le).toLocaleDateString("fr-FR") : "") : "⏳ Pas encore actif";
    const bouton = u.compte_actif ? "" :
      '<div class="admin-row" style="margin-top:10px"><button class="admin-btn-ok" onclick="activerTravail(\'' + u.id + '\')">Il a travaillé : activer</button></div>';
    return '<div class="admin-card"><div class="admin-card-title">' + esc(u.nom_complet || "Sans nom") + '</div>' +
      '<div class="admin-card-meta">' + esc(tel) + (tel ? ' · <a href="https://wa.me/' + waNum(tel) + '" target="_blank" rel="noopener" style="color:inherit">WhatsApp</a>' : '') + '</div>' +
      '<div style="font-size:13px;opacity:.85;line-height:1.5;margin-top:6px">' + etat + '<br>' + info + '</div>' + bouton + '</div>';
  }).join("");
}
async function activerTravail(id) {
  const u = activUsers.find((x) => x.id === id);
  if (!confirm("Confirmer : " + (u ? (u.nom_complet || "cette personne") : "cette personne") + " a vraiment travaillé ? Son compte sera activé" + (u && u.parraine_par ? " et son parrain recevra 0,4 K." : "."))) return;
  const { data, error } = await supabaseClient.rpc("admin_activer_travail", { p_id: id });
  if (error) { alert(error.message); return; }
  alert(data === "deja" ? "Ce compte était déjà actif." : "Fait ✅ Compte activé.");
  loadActiv();
  loadCredit();
}
