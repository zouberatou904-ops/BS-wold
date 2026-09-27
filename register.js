const registerForm = document.getElementById("registerForm");
const formMsg = document.getElementById("formMsg");
const submitBtn = document.getElementById("submitBtn");
const btnHomme = document.getElementById("btnHomme");
const btnFemme = document.getElementById("btnFemme");
const sexeInput = document.getElementById("sexe");
const codeReveal = document.getElementById("codeReveal");
const codeValue = document.getElementById("codeValue");
const codeCopied = document.getElementById("codeCopied");
const switchLinkBlock = document.getElementById("switchLinkBlock");

btnHomme.addEventListener("click", () => {
  btnHomme.classList.add("active");
  btnFemme.classList.remove("active");
  sexeInput.value = "Homme";
});
btnFemme.addEventListener("click", () => {
  btnFemme.classList.add("active");
  btnHomme.classList.remove("active");
  sexeInput.value = "Femme";
});

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function generateReferralCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

registerForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const nom = document.getElementById("nom").value.trim();
  const age = document.getElementById("age").value;
  const sexe = sexeInput.value;
  const whatsapp = document.getElementById("whatsapp").value.trim();
  const email = document.getElementById("email").value.trim();
  const code = generateCode();
  const myReferralCode = generateReferralCode();
  const refUsed = new URLSearchParams(window.location.search).get("ref");

  formMsg.textContent = "";
  formMsg.className = "form-msg";
  submitBtn.disabled = true;
  submitBtn.textContent = "Création du compte...";

  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password: code
  });

  submitBtn.disabled = false;
  submitBtn.textContent = "S'inscrire";

  if (error) {
    formMsg.textContent = error.message;
    formMsg.classList.add("error");
    return;
  }

  const profileData = { nom_complet: nom, age: Number(age), sexe, whatsapp, code_parrainage: myReferralCode };

  // Enregistre le profil complémentaire si une session est déjà active (confirmation email désactivée)
  if (data.session) {
    await supabaseClient.from("profiles").update(profileData).eq("id", data.user.id);

    if (refUsed) {
      const { data: parrain } = await supabaseClient
        .from("profiles")
        .select("id, solde")
        .eq("code_parrainage", refUsed)
        .single();

      if (parrain) {
        await supabaseClient.from("profiles").update({ parraine_par: parrain.id }).eq("id", data.user.id);
        await supabaseClient.from("profiles").update({ solde: (parrain.solde || 0) + 0.4 }).eq("id", parrain.id);
      }
    }
  } else {
    // Sinon, sera appliqué au premier login via dashboard.js
    localStorage.setItem(
      "bswoldcash_pending_profile",
      JSON.stringify({ ...profileData, ref_utilise: refUsed })
    );
  }

  registerForm.style.display = "none";
  switchLinkBlock.style.display = "none";
  codeValue.textContent = code;
  codeReveal.classList.add("visible");

  try {
    await navigator.clipboard.writeText(code);
    codeCopied.textContent = "✓ Code copié dans le presse-papiers";
  } catch (err) {
    codeCopied.textContent = "";
  }
});

document.getElementById("continueBtn").addEventListener("click", () => {
  window.location.href = "dashboard.html";
});
