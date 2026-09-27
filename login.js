const loginForm = document.getElementById("loginForm");
const formMsg = document.getElementById("formMsg");
const submitBtn = document.getElementById("submitBtn");

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("email").value.trim();

  formMsg.textContent = "";
  formMsg.className = "form-msg";
  submitBtn.disabled = true;
  submitBtn.textContent = "Envoi en cours...";

  const { error } = await supabaseClient.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: window.location.origin + window.location.pathname.replace("login.html", "dashboard.html"),
      shouldCreateUser: false
    }
  });

  submitBtn.disabled = false;
  submitBtn.textContent = "Se connecter";

  if (error) {
    formMsg.textContent = error.message;
    formMsg.classList.add("error");
    return;
  }

  formMsg.textContent = "Vérifie ta boîte mail : clique sur le lien reçu pour te connecter.";
  formMsg.classList.add("success");
  submitBtn.disabled = true;
});
