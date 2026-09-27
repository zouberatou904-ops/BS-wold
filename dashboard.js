async function init() {
  const { data: { session } } = await supabaseClient.auth.getSession();

  if (!session) {
    window.location.href = "login.html";
    return;
  }

  const user = session.user;
  document.getElementById("avatarInitial").textContent = (user.email || "?")[0].toUpperCase();

  const { data: profile, error } = await supabaseClient
    .from("profiles")
    .select("solde")
    .eq("id", user.id)
    .single();

  // Si un profil était en attente (venant de l'inscription par lien magique), on l'enregistre maintenant
  const pending = localStorage.getItem("bswoldcash_pending_profile");
  if (pending) {
    try {
      const profileData = JSON.parse(pending);
      await supabaseClient.from("profiles").update(profileData).eq("id", user.id);
    } catch (e) {}
    localStorage.removeItem("bswoldcash_pending_profile");
  }

  const solde = (!error && profile && typeof profile.solde === "number") ? profile.solde : 0;
  const fcfa = Math.round(solde * 1000);

  document.getElementById("balanceK").innerHTML = solde.toFixed(2) + '<span class="unit">K</span>';
  document.getElementById("balanceFcfa").textContent = "≈ " + fcfa.toLocaleString("fr-FR") + " FCFA";

  renderBars([0, 0, 0, 0, 0, 0, 0]);
}

function renderBars(values) {
  const container = document.getElementById("barsContainer");
  container.innerHTML = "";
  const max = Math.max(...values, 1);

  values.forEach((v) => {
    const bar = document.createElement("div");
    bar.className = "bar";
    const heightPct = Math.max((v / max) * 100, 5);
    bar.style.height = heightPct + "%";
    container.appendChild(bar);
  });
}

document.getElementById("logoutBtn").addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  window.location.href = "login.html";
});

init();
