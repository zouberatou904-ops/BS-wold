const registerForm = document.getElementById("registerForm");
const formMsg = document.getElementById("formMsg");
const submitBtn = document.getElementById("submitBtn");

registerForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  formMsg.textContent = "";
  formMsg.className = "form-msg";
  submitBtn.disabled = true;
  submitBtn.textContent = "Inscription...";

  const { data, error } = await supabaseClient.auth.signUp({ email, password });

  submitBtn.disabled = false;
  submitBtn.textContent = "S'inscrire";

  if (error) {
    formMsg.textContent = error.message;
    formMsg.classList.add("error");
    return;
  }

  formMsg.textContent = "Compte créé. Redirection...";
  formMsg.classList.add("success");

  setTimeout(() => {
    window.location.href = "login.html";
  }, 1200);
});
