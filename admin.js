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
  loadCredit();
  loadVendeurs();
  loadProduits();
  loadRetraits();
  loadRetraitsFour();
  loadLivraisons();
  loadVentesCorbeau();
}

// ---- Vendeurs (plafond + certification) ----
async function loadVendeurs() {
  const box = document.getElementById("listCandidatures");
  const { data, error } = await supabaseClient.from("profiles")
    .select("id, nom_complet, certifie, plafond_fcfa").order("nom_complet").limit(100);
  if (error) { box.innerHTML = '<div class="empty-history">Erreur : ' + esc(error.message) + '</div>'; return; }
  if (!data || data.length === 0) { box.innerHTML = '<div class="empty-history">Aucun vendeur</div>'; return; }
  box.innerHTML = data.map((u) =>
    '<div class="admin-card"><div class="admin-card-title">' + esc(u.nom_complet || "Sans nom") + (u.certifie ? " ✅" : "") + '</div>' +
    '<div class="pct-row"><div class="pct-field"><label>Plafond (FCFA)</label><input type="number" id="pl-' + u.id + '" value="' + (u.plafond_fcfa || 5000) + '"></div></div>' +
    '<div class="admin-row"><button class="admin-btn-ok" onclick="saveVendeur(\'' + u.id + '\',' + (u.certifie ? "true" : "false") + ',false)">Enregistrer</button>' +
    '<button class="admin-btn-no" onclick="saveVendeur(\'' + u.id + '\',' + (u.certifie ? "true" : "false") + ',true)">' + (u.certifie ? "Retirer certif." : "Certifier") + '</button></div></div>'
  ).join("");
}
async function saveVendeur(id, certifie, toggle) {
  const plafond = parseInt(document.getElementById("pl-" + id).value, 10) || 5000;
  const { error } = await supabaseClient.from("profiles").update({ plafond_fcfa: plafond, certifie: toggle ? !certifie : certifie }).eq("id", id);
  if (error) alert(error.message);
  loadVendeurs();
}

// ---- Livraisons ----
async function loadLivraisons() {
  const box = document.getElementById("listLivraisons");
  const { data, error } = await supabaseClient.from("corbeau_attributions")
    .select("id, quantite, adresse_livraison, vendeur_id, produit_id, created_at, corbeau_produits(nom, stock_disponible)")
    .eq("statut", "a_livrer").order("created_at");
  if (error) { box.innerHTML = '<div class="empty-history">Erreur : ' + esc(error.message) + '</div>'; return; }
  if (!data || data.length === 0) { box.innerHTML = '<div class="empty-history">Aucune livraison en attente</div>'; return; }
  const ids = [...new Set(data.map((x) => x.vendeur_id))];
  const noms = {};
  ((await supabaseClient.from("profiles").select("id, nom_complet").in("id", ids)).data || []).forEach((r) => { noms[r.id] = r.nom_complet; });
  box.innerHTML = data.map((x) =>
    '<div class="admin-card"><div class="admin-card-title">' + esc(x.corbeau_produits ? x.corbeau_produits.nom : "Produit") + ' ×' + x.quantite + '</div>' +
    '<div class="admin-card-meta">' + esc(noms[x.vendeur_id] || "Revendeur") + ' · ' + esc(x.adresse_livraison || "") + '</div>' +
    '<div class="admin-row"><button class="admin-btn-ok" onclick="livrer(\'' + x.id + '\',\'' + x.produit_id + '\',' + x.quantite + ',' + (x.corbeau_produits ? x.corbeau_produits.stock_disponible : 0) + ')">Marquer livré</button></div></div>'
  ).join("");
}
async function livrer(id, produitId, qte, stock) {
  const r1 = await supabaseClient.from("corbeau_attributions").update({ statut: "livre" }).eq("id", id);
  if (r1.error) { alert(r1.error.message); return; }
  await supabaseClient.from("corbeau_produits").update({ stock_disponible: Math.max(0, stock - qte) }).eq("id", produitId);
  loadLivraisons();
}

// ---- Produits Corbeau ----
async function loadProduits() {
  const box = document.getElementById("listProduits");
  const { data, error } = await supabaseClient
    .from("corbeau_produits")
    .select("id, nom, description, prix_fcfa, stock_disponible, age_minimum, commission_pct, part_app_pct, statut, created_at")
    .order("created_at", { ascending: false });

  if (error || !data || data.length === 0) {
    box.innerHTML = '<div class="empty-history">Aucun produit proposé</div>';
    return;
  }

  box.innerHTML = data.map((p) => {
    const d = new Date(p.created_at).toLocaleDateString("fr-FR");
    const etat = p.statut === "approuve"
      ? '<div class="status-banner en_attente" style="margin-top:8px">✅ En vente</div>'
      : p.statut === "refuse"
        ? '<div class="status-banner refuse" style="margin-top:8px">❌ Refusé</div>'
        : '';
    const actions = etat +
      '<div class="pct-row">' +
      '<div class="pct-field"><label>% total retiré</label><input type="number" id="pct-' + p.id + '" value="' + (p.commission_pct != null ? p.commission_pct : 30) + '"></div>' +
      '<div class="pct-field"><label>dont % app</label><input type="number" id="app-' + p.id + '" value="' + (p.part_app_pct != null ? p.part_app_pct : 5) + '"></div>' +
      '</div>' +
      '<div class="admin-row"><button class="admin-btn-ok" onclick="setProduit(\'' + p.id + '\',\'approuve\')">' + (p.statut === "approuve" ? "Mettre à jour" : "Approuver") + '</button>' +
      '<button class="admin-btn-no" onclick="setProduit(\'' + p.id + '\',\'refuse\')">Refuser</button></div>';
    return '<div class="admin-card">' +
      '<div class="admin-card-title">' + esc(p.nom) + ' — ' + Number(p.prix_fcfa).toLocaleString("fr-FR") + ' F</div>' +
      '<div class="admin-card-meta">' + esc(p.description || "") + ' · stock ' + p.stock_disponible + ' · âge min ' + p.age_minimum + ' · ' + d + '</div>' +
      actions + '</div>';
  }).join("");
}

async function setProduit(id, statut) {
  const updates = { statut };
  if (statut === "approuve") {
    const pctInput = document.getElementById("pct-" + id);
    const appInput = document.getElementById("app-" + id);
    updates.commission_pct = parseFloat(pctInput.value);
    updates.part_app_pct = parseFloat(appInput.value);
    updates.actif = true;
  } else {
    updates.actif = false;
  }
  const { error } = await supabaseClient.from("corbeau_produits").update(updates).eq("id", id);
  if (error) alert(error.message);
  loadProduits();
}

// ---- Retraits ----
const RSTAT = { en_attente: "En attente", paye: "Payé", refuse: "Refusé" };

async function loadRetraits() {
  const box = document.getElementById("listRetraits");
  const { data, error } = await supabaseClient
    .from("retraits")
    .select("id, montant, operateur, numero, statut, created_at")
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
      '<div class="admin-card-title">' + Number(r.montant).toFixed(2) + ' K · ' + esc(r.operateur) + '</div>' +
      '<div class="admin-card-meta">' + esc(r.numero) + ' · ' + d + '</div>' +
      actions + '</div>';
  }).join("");
}

async function setRetrait(id, statut) {
  const { error } = await supabaseClient.rpc("admin_update_retrait", { p_id: id, p_statut: statut });
  if (error) { alert(error.message); return; }
  loadRetraits();
}

// ---- Dépôts Corbeau (déclarations de vente) ----
async function loadVentesCorbeau() {
  const box = document.getElementById("listVentesCorbeau");
  const { data, error } = await supabaseClient
    .from("corbeau_ventes")
    .select("id, vendeur_id, quantite_vendue, montant_total_fcfa, montant_a_reverser_fcfa, montant_revendeur_fcfa, statut, created_at")
    .order("created_at", { ascending: false }).limit(50);
  if (error) { box.innerHTML = '<div class="empty-history">Erreur : ' + esc(error.message) + '</div>'; return; }
  if (!data || data.length === 0) { box.innerHTML = '<div class="empty-history">Aucune déclaration de vente</div>'; return; }
  const ids = [...new Set(data.map((v) => v.vendeur_id))];
  const noms = {};
  ((await supabaseClient.from("profiles").select("id, nom_complet").in("id", ids)).data || []).forEach((r) => { noms[r.id] = r.nom_complet; });

  box.innerHTML = data.map((v) => {
    const d = new Date(v.created_at).toLocaleDateString("fr-FR");
    const nom = noms[v.vendeur_id] || "Revendeur";
    const actions = v.statut === "en_attente"
      ? '<div class="admin-row"><button class="admin-btn-ok" onclick="confirmVente(\'' + v.id + '\')">Dépôt reçu, confirmer</button></div>'
      : '<div class="status-banner en_attente" style="margin-top:8px">✅ Confirmé</div>';
    return '<div class="admin-card">' +
      '<div class="admin-card-title">' + esc(nom) + ' · ' + v.quantite_vendue + ' vendu(s)</div>' +
      '<div class="admin-card-meta">Total vente : ' + Number(v.montant_total_fcfa).toLocaleString("fr-FR") + ' F · À reverser : ' + Number(v.montant_a_reverser_fcfa).toLocaleString("fr-FR") + ' F · Part revendeur : ' + Number(v.montant_revendeur_fcfa).toLocaleString("fr-FR") + ' F · ' + d + '</div>' +
      actions + '</div>';
  }).join("");
}

async function confirmVente(id) {
  const { error } = await supabaseClient.rpc("admin_confirm_vente", { p_id: id });
  if (error) { alert(error.message); return; }
  loadVentesCorbeau();
}

// ---- Retraits des fournisseurs ----
async function loadRetraitsFour() {
  const box = document.getElementById("listRetraitsFour");
  const { data, error } = await supabaseClient.from("corbeau_retraits_fournisseurs")
    .select("id, fournisseur_id, montant_fcfa, frais_fcfa, methode, numero, statut, created_at").order("created_at", { ascending: false }).limit(50);
  if (error) { box.innerHTML = '<div class="empty-history">Erreur : ' + esc(error.message) + '</div>'; return; }
  if (!data || data.length === 0) { box.innerHTML = '<div class="empty-history">Aucun retrait fournisseur</div>'; return; }
  const ids = [...new Set(data.map((r) => r.fournisseur_id))];
  const noms = {};
  ((await supabaseClient.from("profiles").select("id, nom_complet").in("id", ids)).data || []).forEach((r) => { noms[r.id] = r.nom_complet; });
  box.innerHTML = data.map((r) => {
    const actions = r.statut === "en_attente"
      ? '<div class="admin-row"><button class="admin-btn-ok" onclick="setRetraitFour(\'' + r.id + '\',\'complete\')">Marquer payé</button>' +
        '<button class="admin-btn-no" onclick="setRetraitFour(\'' + r.id + '\',\'refuse\')">Refuser</button></div>'
      : '<div class="status-banner ' + (r.statut === "complete" ? "en_attente" : "refuse") + '" style="margin-top:8px">' + (r.statut === "complete" ? "Payé" : "Refusé") + '</div>';
    return '<div class="admin-card"><div class="admin-card-title">' + esc(noms[r.fournisseur_id] || "Fournisseur") + ' · ' + Number(r.montant_fcfa).toLocaleString("fr-FR") + ' F</div>' +
      '<div class="admin-card-meta">' + esc(r.methode) + ' · ' + esc(r.numero) + ' · frais ' + Number(r.frais_fcfa).toLocaleString("fr-FR") + ' F · ' + new Date(r.created_at).toLocaleDateString("fr-FR") + '</div>' + actions + '</div>';
  }).join("");
}
async function setRetraitFour(id, statut) {
  const { error } = await supabaseClient.from("corbeau_retraits_fournisseurs").update({ statut }).eq("id", id);
  if (error) alert(error.message);
  loadRetraitsFour();
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
