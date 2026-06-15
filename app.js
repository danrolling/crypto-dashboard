console.log("APP.JS LOADED");

const SUPABASE_URL = "https://ihphfkwoiiyhvvvfipal.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_19kbJOQDarnTwoqzBLSHGg_YVwoodAD";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

const loginScreen = document.getElementById("login-screen");
const appScreen = document.getElementById("app-screen");
const loginBtn = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");
const loginError = document.getElementById("login-error");

function showLogin() {
  console.log("SHOW LOGIN");

  loginScreen.style.display = "flex";
  appScreen.style.display = "none";
}

async function showApp() {
  console.log("SHOW APP");

  loginScreen.style.display = "none";
  appScreen.style.display = "block";

  const { data, error } = await supabaseClient
    .from("portfolio_summary_view")
    .select("*");

  console.log("portfolio summary:", data);
  console.log("portfolio error:", error);
}

async function checkSession() {
  console.log("CHECK SESSION");

  const { data, error } = await supabaseClient.auth.getSession();

  console.log("session data:", data);
  console.log("session error:", error);

  if (data.session) {
    await showApp();
  } else {
    showLogin();
  }
}

loginBtn.addEventListener("click", async () => {
  console.log("LOGIN BUTTON CLICKED");

  loginError.textContent = "";

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  const { error } = await supabaseClient.auth.signInWithPassword({
    email,
    password
  });

  console.log("login error:", error);

  if (error) {
    loginError.textContent = error.message;
    return;
  }

  await showApp();
});

logoutBtn.addEventListener("click", async () => {
  console.log("LOGOUT BUTTON CLICKED");

  await supabaseClient.auth.signOut();
  showLogin();
});

document.querySelectorAll(".nav-btn").forEach((button) => {
  button.addEventListener("click", () => {
    const targetPage = button.dataset.page;

    document.querySelectorAll(".page").forEach((page) => {
      page.classList.remove("active-page");
    });

    document.getElementById(targetPage).classList.add("active-page");

    document.querySelectorAll(".nav-btn").forEach((btn) => {
      btn.classList.remove("active");
    });

    button.classList.add("active");
  });
});

checkSession();