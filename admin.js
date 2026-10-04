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

  loadCandidatures();
  loadProduits();
  loadRetraits();
  loadVentesCorbeau();
}

// ---- Candidatures d'affiliation ----
async function loadCandidatures() {
  const box = document.getElementById("listCandidatures");
  const { data, error } = await supabaseClient
    .from("candidatures_affiliation")
    .select("id, nom, prenom, age, est_eleve, type_piece, tuteur_whatsapp, statut, created_at")
    .order("created_at", { ascending: false });

  if (error || !data || data.length === 0) {
    box.innerHTML = '<div class="empty-history">Aucune candidature</div>';
    return;
  }

  box.innerHTML = data.map((c) => {
    const d = new Date(c.created_at).toLocaleDateString("fr-FR");
    const eleve = c.est_eleve ? "Élève" : "Non élève";
    const tuteur = c.tuteur_whatsapp ? " · Tuteur : " + esc(c.tuteur_whatsapp) : "";
    const actions = c.statut === "en_attente"
      ? '<div class="admin-row"><button class="admin-btn-ok" onclick="setCandidature(\'' + c.id + '\',\'approuve\')">Approuver</button>' +
        '<button class="admin-btn-no" onclick="setCandidature(\'' + c.id + '\',\'refuse\')">Refuser</button></div>'
      : '<div class="status-banner ' + (c.statut === "approuve" ? "en_attente" : "refuse") + '" style="margin-top:8px">' + (c.statut === "approuve" ? "✅ Approuvée" : "❌ Refusée") + '</div>';
    return '<div class="admin-card">' +
      '<div class="admin-card-title">' + esc(c.prenom) + ' ' + esc(c.nom) + ' · ' + c.age + ' ans</div>' +
      '<div class="admin-card-meta">' + eleve + ' · Pièce : ' + esc(c.type_piece) + tuteur + ' · ' + d + '</div>' +
      actions + '</div>';
  }).join("");
}

async function setCandidature(id, statut) {
  await supabaseClient.from("candidatures_affiliation").update({ statut }).eq("id", id);
  loadCandidatures();
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
    const actions = p.statut === "en_attente"
      ? '<div class="pct-row">' +
        '<div class="pct-field"><label>% total retiré</label><input type="number" id="pct-' + p.id + '" value="' + p.commission_pct + '"></div>' +
        '<div class="pct-field"><label>dont % app</label><input type="number" id="app-' + p.id + '" value="' + p.part_app_pct + '"></div>' +
        '</div>' +
        '<div class="admin-row"><button class="admin-btn-ok" onclick="setProduit(\'' + p.id + '\',\'approuve\')">Approuver</button>' +
        '<button class="admin-btn-no" onclick="setProduit(\'' + p.id + '\',\'refuse\')">Refuser</button></div>'
      : '<div class="status-banner ' + (p.statut === "approuve" ? "en_attente" : "refuse") + '" style="margin-top:8px">' + (p.statut === "approuve" ? "✅ En vente" : "❌ Refusé") + '</div>';
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
  }
  await supabaseClient.from("corbeau_produits").update(updates).eq("id", id);
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
    .select("id, quantite_vendue, montant_total_fcfa, montant_a_reverser_fcfa, montant_revendeur_fcfa, statut, created_at, profiles(nom_complet)")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error || !data || data.length === 0) {
    box.innerHTML = '<div class="empty-history">Aucune déclaration de vente</div>';
    return;
  }

  box.innerHTML = data.map((v) => {
    const d = new Date(v.created_at).toLocaleDateString("fr-FR");
    const nom = v.profiles ? v.profiles.nom_complet : "Revendeur";
    const actions = v.statut === "en_attente"
      ? '<div class="admin-row"><button class="admin-btn-ok" onclick="confirmVente(\'' + v.id + '\')">Dépôt reçu, confirmer</button></div>'
      : '<div class="status-banner en_attente" style="margin-top:8px">✅ Confirmé</div>';
    return '<div class="admin-card">' +
      '<div class="admin-card-title">' + esc(nom || "Revendeur") + ' · ' + v.quantite_vendue + ' vendu(s)</div>' +
      '<div class="admin-card-meta">Total vente : ' + Number(v.montant_total_fcfa).toLocaleString("fr-FR") + ' F · À reverser : ' + Number(v.montant_a_reverser_fcfa).toLocaleString("fr-FR") + ' F · Part revendeur : ' + Number(v.montant_revendeur_fcfa).toLocaleString("fr-FR") + ' F · ' + d + '</div>' +
      actions + '</div>';
  }).join("");
}

async function confirmVente(id) {
  const { error } = await supabaseClient.rpc("admin_confirm_vente", { p_id: id });
  if (error) { alert(error.message); return; }
  loadVentesCorbeau();
}

init();
