const REFERRAL_REWARD = 0.4;

async function init() {
  const { data: { session } } = await supabaseClient.auth.getSession();

  if (!session) {
    window.location.href = "login.html";
    return;
  }

  const user = session.user;
  document.getElementById("avatarInitial").textContent = (user.email || "?")[0].toUpperCase();

  let { data: profile, error } = await supabaseClient
    .from("profiles")
    .select("solde, nom_complet, code_parrainage")
    .eq("id", user.id)
    .single();

  // Si un profil était en attente (venant de l'inscription), on l'enregistre maintenant
  const pending = localStorage.getItem("bswoldcash_pending_profile");
  if (pending) {
    try {
      const p = JSON.parse(pending);
      const refUsed = p.ref_utilise;
      delete p.ref_utilise;
      await supabaseClient.from("profiles").update(p).eq("id", user.id);

      if (refUsed) {
        await supabaseClient.rpc("credit_referral", { p_code: refUsed });
      }
      localStorage.removeItem("bswoldcash_pending_profile");

      // recharge le profil après application
      const refreshed = await supabaseClient.from("profiles").select("solde, nom_complet, code_parrainage").eq("id", user.id).single();
      profile = refreshed.data;
    } catch (e) {}
  }

  const solde = (profile && typeof profile.solde === "number") ? profile.solde : 0;
  const fcfa = Math.round(solde * 1000);
  const prenom = (profile && profile.nom_complet) ? profile.nom_complet.split(" ")[0] : (user.email || "").split("@")[0];

  document.getElementById("welcomeName").textContent = prenom;
  document.getElementById("balanceK").innerHTML = solde.toFixed(2) + '<span class="unit">K</span>';
  document.getElementById("balanceFcfa").textContent = "≈ " + fcfa.toLocaleString("fr-FR") + " FCFA";

  // Gains parrainage = nombre de filleuls × récompense
  const { count } = await supabaseClient
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("parraine_par", user.id);

  const gainsParrainage = (count || 0) * REFERRAL_REWARD;
  document.getElementById("gainsParrainage").textContent = gainsParrainage.toFixed(2) + " K";

  // Placeholders en attendant les tables de gains détaillés (jour / sondages / tâches)
  document.getElementById("gainsJour").textContent = "0,00 K";
  document.getElementById("sondagesGain").textContent = "0,00 K";
  document.getElementById("tachesGain").textContent = "0,00 K";
}

document.getElementById("logoutBtn").addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  window.location.href = "login.html";
});

init();
