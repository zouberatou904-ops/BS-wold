const REFERRAL_REWARD = 0.4;

async function init() {
  const { data: { session } } = await supabaseClient.auth.getSession();

  if (!session) {
    window.location.href = "login.html";
    return;
  }

  const user = session.user;
  document.getElementById("avatarInitial").textContent = (user.email || "M")[0].toUpperCase();

  let profile = null;
  try {
    const result = await supabaseClient
      .from("profiles")
      .select("solde, nom_complet, code_parrainage")
      .eq("id", user.id)
      .maybeSingle();
    profile = result.data;
  } catch (e) {}

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

      const refreshed = await supabaseClient
        .from("profiles")
        .select("solde, nom_complet, code_parrainage")
        .eq("id", user.id)
        .maybeSingle();
      profile = refreshed.data;
    } catch (e) {}
  }

  const solde = (profile && typeof profile.solde === "number") ? profile.solde : 0;
  const fcfa = Math.round(solde * 1000);
  const emailPrefix = (user.email || "").split("@")[0];
  const prenom = (profile && profile.nom_complet)
    ? profile.nom_complet.split(" ")[0]
    : (emailPrefix || "Membre");

  document.getElementById("welcomeName").textContent = prenom;
  document.getElementById("balanceK").innerHTML = solde.toFixed(2) + '<span class="unit">K</span>';
  document.getElementById("balanceFcfa").textContent = "≈ " + fcfa.toLocaleString("fr-FR") + " FCFA";

  // Gains parrainage = nombre de filleuls × récompense
  try {
    const { data: count } = await supabaseClient.rpc("count_my_referrals");
    const gainsParrainage = (count || 0) * REFERRAL_REWARD;
    document.getElementById("gainsParrainage").textContent = gainsParrainage.toFixed(2) + " K";
  } catch (e) {
    document.getElementById("gainsParrainage").textContent = "0.00 K";
  }

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
