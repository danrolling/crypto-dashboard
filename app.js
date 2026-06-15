const SUPABASE_URL = "https://ihphfkwoiiyhvvvfipal.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_19kbJOQDarnTwoqzBLSHGg_YVwoodAD";
console.log("app.js loaded");

if (!window.supabase) {
  alert("Supabase library did not load. Check index.html script tag.");
}

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

const loginScreen = document.getElementById("login-screen");
const appScreen = document.getElementById("app-screen");
const loginBtn = document.getElementById("login-btn");
const loginError = document.getElementById("login-error");

console.log({
  loginScreen,
  appScreen,
  loginBtn,
  loginError
});

if (!loginBtn) {
  alert("Login button not found. Check id='login-btn' in index.html.");
}

function showLogin() {
  loginScreen.classList.remove("hidden");
  appScreen.classList.add("hidden");
}

function showApp() {
  loginScreen.classList.add("hidden");
  appScreen.classList.remove("hidden");
}

async function checkSession() {
  const { data, error } = await supabaseClient.auth.getSession();

  if (error) {
    console.error(error);
    showLogin();
    return;
  }

  if (data.session) {
    showApp();
  } else {
    showLogin();
  }
}

loginBtn.addEventListener("click", async () => {
  alert("Login button clicked");

  loginError.textContent = "";

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  if (!email || !password) {
    loginError.textContent = "Email and password are required.";
    return;
  }

  const { error } = await supabaseClient.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    console.error(error);
    loginError.textContent = error.message;
    return;
  }

  showApp();
});

checkSession();