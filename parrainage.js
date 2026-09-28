const REFERRAL_REWARD = 0.4;

async function init() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = "login.html";
    return;
  }

  const user = session.user;

  const { data: profile } = await supabaseClient
    .from("profiles")
    .select("code_parrainage")
    .eq("id", user.id)
    .single();

  const code = profile ? profile.code_parrainage : null;
  document.getElementById("refCode").textContent = code || "—";

  const { data: count } = await supabaseClient.rpc("count_my_referrals");

  const filleuls = count || 0;
  document.getElementById("filleulsCount").textContent = filleuls;
  document.getElementById("gainsTotal").textContent = (filleuls * REFERRAL_REWARD).toFixed(2) + " K";

  document.getElementById("copyLinkBtn").addEventListener("click", async () => {
    const link = window.location.origin + window.location.pathname.replace("parrainage.html", "register.html") + "?ref=" + code;
    const feedback = document.getElementById("copyFeedback");
    try {
      await navigator.clipboard.writeText(link);
      feedback.textContent = "✓ Lien copié";
    } catch (e) {
      feedback.textContent = link;
    }
  });
}

init();
