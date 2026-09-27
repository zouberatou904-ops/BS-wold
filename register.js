const registerForm = document.getElementById("registerForm");
const formMsg = document.getElementById("formMsg");
const submitBtn = document.getElementById("submitBtn");
const btnHomme = document.getElementById("btnHomme");
const btnFemme = document.getElementById("btnFemme");
const sexeInput = document.getElementById("sexe");

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

registerForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const nom = document.getElementById("nom").value.trim();
  const age = document.getElementById("age").value;
  const sexe = sexeInput.value;
  const whatsapp = document.getElementById("whatsapp").value.trim();
  const email = document.getElementById("email").value.trim();

  formMsg.textContent = "";
  formMsg.className = "form-msg";
  submitBtn.disabled = true;
  submitBtn.textContent = "Envoi en cours...";

  // Sauvegarde temporaire du profil : sera appliquée après le clic sur le lien magique
  localStorage.setItem(
    "bswoldcash_pending_profile",
    JSON.stringify({ nom_complet: nom, age: Number(age), sexe, whatsapp })
  );

  const { error } = await supabaseClient.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: window.location.origin + window.location.pathname.replace("register.html", "dashboard.html"),
      shouldCreateUser: true
    }
  });

  submitBtn.disabled = false;
  submitBtn.textContent = "S'inscrire";

  if (error) {
    formMsg.textContent = error.message;
    formMsg.classList.add("error");
    return;
  }

  formMsg.textContent = "Vérifie ta boîte mail : clique sur le lien reçu pour activer ton compte.";
  formMsg.classList.add("success");
  registerForm.querySelector("button").disabled = true;
});
