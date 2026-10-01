const CPX_APP_ID = "36654";

async function init() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = "login.html";
    return;
  }

  const user = session.user;

  const { data: profile } = await supabaseClient
    .from("profiles")
    .select("nom_complet")
    .eq("id", user.id)
    .single();

  const params = new URLSearchParams({
    app_id: CPX_APP_ID,
    ext_user_id: user.id,
    username: (profile && profile.nom_complet) ? profile.nom_complet : "",
    email: user.email || ""
  });

  const iframe = document.createElement("iframe");
  iframe.src = "https://offers.cpx-research.com/index.php?" + params.toString();
  iframe.setAttribute("frameborder", "0");
  iframe.addEventListener("load", () => {
    const loading = document.getElementById("loading");
    if (loading) loading.remove();
  });

  document.getElementById("frameWrap").appendChild(iframe);

  loadHistory(user.id);
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

async function loadHistory(userId) {
  const box = document.getElementById("history");
  const { data, error } = await supabaseClient
    .from("cpx_transactions")
    .select("reward_k, amount_usd, statut, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error || !data || data.length === 0) {
    box.innerHTML = '<div class="empty-history">Aucun sondage complété pour le moment</div>';
    return;
  }

  box.innerHTML = data.map((r) => {
    const d = new Date(r.created_at);
    const date = d.toLocaleDateString("fr-FR") + " · " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    const annule = r.statut === "annule";
    const label = annule ? "Annulé" : "Confirmé";
    const pillClass = annule ? "refuse" : "paye";
    const signe = annule ? "" : "+";
    return '<div class="history-item">' +
      '<div><div class="history-amount">' + signe + Number(r.reward_k).toFixed(2) + ' K</div>' +
      '<div class="history-meta">' + esc(date) + '</div></div>' +
      '<span class="status-pill ' + pillClass + '">' + label + '</span></div>';
  }).join("");
}

init();
