async function syncBtcDailyPrices() {
  const { data: assets, error: assetError } = await supabaseClient
    .from("assets")
    .select("id, symbol")
    .eq("symbol", "BTC")
    .single();

  if (assetError) {
    alert("Could not find BTC asset");
    console.error(assetError);
    return;
  }

  const response = await fetch(
    "https://api.binance.com/api/v3/klines?symbol=BTCUSDC&interval=1d&limit=400"
  );

  const candles = await response.json();

  const rows = candles.map((candle) => ({
    asset_id: assets.id,
    date: new Date(candle[0]).toISOString().slice(0, 10),
    open: Number(candle[1]),
    high: Number(candle[2]),
    low: Number(candle[3]),
    close: Number(candle[4]),
    volume: Number(candle[5]),
    source: "binance"
  }));

  const { error: upsertError } = await supabaseClient
    .from("daily_prices")
    .upsert(rows, {
      onConflict: "asset_id,date,source"
    });

  if (upsertError) {
    alert("BTC daily upsert failed");
    console.error(upsertError);
    return;
  }

  const { error: cleanupError } = await supabaseClient.rpc(
    "cleanup_daily_prices",
    {
      p_asset_id: assets.id,
      p_keep_count: 400
    }
  );

  if (cleanupError) {
    alert("BTC daily cleanup failed");
    console.error(cleanupError);
    return;
  }

  alert(`BTC daily sync complete: ${rows.length} candles`);
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
  
  await syncBtcDailyPrices();
  
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