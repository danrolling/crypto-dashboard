async function testBinance() {
  const response = await fetch(
    "https://api.binance.com/api/v3/klines?symbol=BTCUSDC&interval=1d&limit=400"
  );

  const data = await response.json();

  alert(`Retrieved ${data.length} candles`);
}





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
  loginScreen.classList.remove("hidden");
  appScreen.classList.add("hidden");
}

async function showApp() {
  loginScreen.classList.add("hidden");
  appScreen.classList.remove("hidden");
  
  await testBinance();
  
  const { data, error } = await supabaseClient
    .from("portfolio_summary_view")
    .select("*")
    .single();

  if (error) {
    console.error("Portfolio summary error:", error);
    return;
  }

  console.log("Portfolio summary:", data);
}

async function checkSession() {
  const { data, error } = await supabaseClient.auth.getSession();

  if (error) {
    console.error("Session error:", error);
    showLogin();
    return;
  }

  if (data.session) {
    await showApp();
  } else {
    showLogin();
  }
}

loginBtn.addEventListener("click", async () => {
  loginError.textContent = "";

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  const { error } = await supabaseClient.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    loginError.textContent = error.message;
    return;
  }

  await showApp();
});

logoutBtn.addEventListener("click", async () => {
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