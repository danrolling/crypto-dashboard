const SUPABASE_URL = "https://ihphfkwoiiyhvvvfipal.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_19kbJOQDarnTwoqzBLSHGg_YVwoodAD";

function debug(message) {
  let box = document.getElementById("debug-box");

  if (!box) {
    box = document.createElement("div");
    box.id = "debug-box";
    box.style.position = "fixed";
    box.style.top = "0";
    box.style.left = "0";
    box.style.right = "0";
    box.style.zIndex = "99999";
    box.style.background = "#111827";
    box.style.color = "#22c55e";
    box.style.fontSize = "12px";
    box.style.padding = "8px";
    box.style.maxHeight = "180px";
    box.style.overflow = "auto";
    document.body.appendChild(box);
  }

  box.innerHTML += `<div>${message}</div>`;
}

debug("APP.JS LOADED");

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

const loginScreen = document.getElementById("login-screen");
const appScreen = document.getElementById("app-screen");
const loginBtn = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");
const loginError = document.getElementById("login-error");

debug("ELEMENTS LOADED");

function showLogin() {
  debug("SHOW LOGIN");

  loginScreen.style.display = "flex";
  appScreen.style.display = "none";
}

async function showApp() {
  debug("SHOW APP");

  loginScreen.style.display = "none";
  appScreen.style.display = "block";

  const { data, error } = await supabaseClient
    .from("portfolio_summary_view")
    .select("*");

  debug("PORTFOLIO DATA: " + JSON.stringify(data));
  debug("PORTFOLIO ERROR: " + JSON.stringify(error));
}

async function checkSession() {
  debug("CHECK SESSION");

  const { data, error } = await supabaseClient.auth.getSession();

  debug("SESSION EXISTS: " + Boolean(data.session));
  debug("SESSION ERROR: " + JSON.stringify(error));

  if (data.session) {
    await showApp();
  } else {
    showLogin();
  }
}

loginBtn.addEventListener("click", async () => {
  debug("LOGIN BUTTON CLICKED");

  loginError.textContent = "";

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  const { error } = await supabaseClient.auth.signInWithPassword({
    email,
    password
  });

  debug("LOGIN ERROR: " + JSON.stringify(error));

  if (error) {
    loginError.textContent = error.message;
    return;
  }

  await showApp();
});

logoutBtn.addEventListener("click", async () => {
  debug("LOGOUT BUTTON CLICKED");

  await supabaseClient.auth.signOut();
  showLogin();
});

document.querySelectorAll(".nav-btn").forEach((button) => {
  button.addEventListener("click", () => {
    const targetPage = button.dataset.page;

    debug("NAV CLICKED: " + targetPage);

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