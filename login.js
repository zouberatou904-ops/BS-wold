const loginForm = document.getElementById("loginForm");
const formMsg = document.getElementById("formMsg");
const submitBtn = document.getElementById("submitBtn");

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  formMsg.textContent = "";
  formMsg.className = "form-msg";
  submitBtn.disabled = true;
  submitBtn.textContent = "Connexion...";

  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

  submitBtn.disabled = false;
  submitBtn.textContent = "Se connecter";

  if (error) {
    formMsg.textContent = "Email ou mot de passe incorrect.";
    formMsg.classList.add("error");
    return;
  }

  window.location.href = "dashboard.html";
});
