const MIN_WITHDRAW = 0.3;
const FEE_PCT = 10; // doit être le même que dans la fonction SQL request_withdrawal
let currentSolde = 0;
let operateur = "MTN";

const formMsg = document.getElementById("formMsg");
const submitBtn = document.getElementById("submitBtn");

const LOGOS = {
  MTN: { cls: "mtn", txt: "MTN", name: "MTN MoMo" },
  Moov: { cls: "moov", txt: "M", name: "Moov Money" },
  Celtiis: { cls: "celtiis", txt: "C", name: "Celtiis Cash" }
};

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

document.querySelectorAll(".method-card").forEach((card) => {
  card.addEventListener("click", () => {
    document.querySelectorAll(".method-card").forEach((c) => c.classList.remove("selected"));
    card.classList.add("selected");
    operateur = card.dataset.op;
  });
});

document.getElementById("maxLink").addEventListener("click", () => {
  document.getElementById("montant").value = currentSolde.toFixed(2);
});

function showSolde() {
  document.getElementById("balanceK").innerHTML = currentSolde.toFixed(2) + '<span class="unit">K</span>';
  document.getElementById("balanceFcfa").textContent =
    "≈ " + Math.round(currentSolde * 1000).toLocaleString("fr-FR") + " FCFA · Disponible maintenant";
  document.getElementById("maxLink").textContent = "Max: " + currentSolde.toFixed(2) + " K";
}

async function loadSolde(userId) {
  const { data } = await supabaseClient.from("profiles").select("solde").eq("id", userId).single();
  currentSolde = (data && typeof data.solde === "number") ? data.solde : 0;
  showSolde();
}

const STATUTS = { en_attente: "En attente", paye: "Réussi", refuse: "Refusé" };

// Tolère les variantes saisies à la main dans Supabase (payer, payé, réussi, refusé...)
function normalizeStatut(s) {
  const t = String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  if (t.startsWith("pay") || t.startsWith("reuss")) return "paye";
  if (t.startsWith("refus")) return "refuse";
  return "en_attente";
}

async function loadHistory() {
  const box = document.getElementById("history");
  const { data, error } = await supabaseClient
    .from("retraits")
    .select("montant, operateur, statut, created_at")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error || !data || data.length === 0) {
    box.innerHTML = '<div class="empty-history">Aucune demande pour le moment</div>';
    return;
  }

  box.innerHTML = data.map((r) => {
    const d = new Date(r.created_at);
    const date = d.toLocaleDateString("fr-FR") + " · " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    const logo = LOGOS[r.operateur] || { cls: "", txt: "?", name: r.operateur };
    const statut = normalizeStatut(r.statut);
    const label = STATUTS[statut];
    return '<div class="history-item">' +
      '<div class="history-left"><div class="method-logo ' + logo.cls + '">' + esc(logo.txt) + '</div>' +
      '<div><div class="history-amount" style="font-size:14px">' + esc(logo.name) + '</div>' +
      '<div class="history-meta">' + esc(date) + '</div></div></div>' +
      '<div class="history-right"><div class="history-amount neg">-' + Number(r.montant).toFixed(2) + ' K</div>' +
      '<span class="status-pill ' + statut + '">' + label + '</span></div></div>';
  }).join("");
}

// Ajoute le champ « Nom du compte » et l'aperçu des frais, en copiant le style du champ numéro
function setupExtraFields() {
  const numero = document.getElementById("numero");
  const form = document.getElementById("withdrawForm");
  if (!numero || !form || document.getElementById("nomCompte")) return;
  let g = numero;
  while (g.parentElement && g.parentElement !== form) g = g.parentElement;
  const copy = g.cloneNode(true);
  const inp = copy.querySelector("input");
  inp.id = "nomCompte";
  inp.type = "text";
  inp.value = "";
  inp.placeholder = "Ex: KOFFI Jean";
  inp.removeAttribute("name");
  inp.setAttribute("autocomplete", "off");
  copy.querySelectorAll("svg, img").forEach((n) => n.remove());
  const walker = document.createTreeWalker(copy, NodeFilter.SHOW_TEXT);
  let t;
  while ((t = walker.nextNode())) {
    if (/Num\S{1,2}ro/i.test(t.nodeValue)) { t.nodeValue = "Nom du compte (celui qui s'affiche au dépôt)"; break; }
  }
  g.parentElement.insertBefore(copy, g.nextSibling);

  const box = document.createElement("div");
  box.id = "feeBox";
  box.style.cssText = "margin:14px 0;padding:14px 16px;border-radius:16px;border:1px solid rgba(31,182,168,.35);background:rgba(31,182,168,.08);font-size:14px;line-height:1.5";
  copy.parentElement.insertBefore(box, copy.nextSibling);
  const m = document.getElementById("montant");
  m.addEventListener("input", updateFee);
  updateFee();
}
function updateFee() {
  const box = document.getElementById("feeBox");
  if (!box) return;
  const montant = parseFloat(document.getElementById("montant").value);
  if (isNaN(montant) || montant <= 0) {
    box.innerHTML = "Frais de retrait : <strong>" + FEE_PCT + " %</strong> gardés par l'application.";
    return;
  }
  const frais = Math.round(montant * FEE_PCT) / 100;
  const net = montant - frais;
  box.innerHTML = "Frais (" + FEE_PCT + " %) : <strong>" + frais.toFixed(2) + " K</strong><br>" +
    "Tu reçois : <strong>" + net.toFixed(2) + " K</strong> (≈ " + Math.round(net * 1000).toLocaleString("fr-FR") + " FCFA)";
}

async function init() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = "login.html";
    return;
  }
  await loadSolde(session.user.id);
  await loadHistory();
  setupExtraFields();

  document.getElementById("withdrawForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const montant = parseFloat(document.getElementById("montant").value);
    const numero = document.getElementById("numero").value.trim();

    const nomEl = document.getElementById("nomCompte");
    const nom = nomEl ? nomEl.value.trim() : "";

    formMsg.textContent = "";
    formMsg.className = "form-msg";

    if (isNaN(montant) || montant < MIN_WITHDRAW) {
      formMsg.textContent = "Le montant minimum est de 0,3 K.";
      formMsg.classList.add("error");
      return;
    }
    if (nom.length < 3) {
      formMsg.textContent = "Écris le nom du compte Mobile Money (celui qui s'affiche au dépôt).";
      formMsg.classList.add("error");
      return;
    }
    if (montant > currentSolde) {
      formMsg.textContent = "Solde insuffisant.";
      formMsg.classList.add("error");
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Envoi...";

    const { error } = await supabaseClient.rpc("request_withdrawal", {
      p_montant: montant,
      p_operateur: operateur,
      p_numero: numero,
      p_nom: nom
    });

    submitBtn.disabled = false;
    submitBtn.textContent = "Retirer maintenant →";

    if (error) {
      formMsg.textContent = error.message;
      formMsg.classList.add("error");
      return;
    }

    formMsg.textContent = "Demande envoyée. Elle sera traitée par notre équipe.";
    formMsg.classList.add("success");
    document.getElementById("montant").value = "";
    if (nomEl) nomEl.value = "";
    updateFee();
    await loadSolde(session.user.id);
    await loadHistory();
  });
}

init();
