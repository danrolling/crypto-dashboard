const MARKET_ASSETS = [
  {
    assetSymbol: "BTC",
    binanceSymbol: "BTCUSDC"
  },
  {
    assetSymbol: "ETH",
    binanceSymbol: "ETHUSDC"
  }
];

async function getAssetId(symbol) {
  const { data, error } = await supabaseClient
    .from("assets")
    .select("id, symbol")
    .eq("symbol", symbol)
    .single();

  if (error) {
    throw new Error(`Could not find asset ${symbol}: ${error.message}`);
  }

  return data.id;
}

async function fetchBinanceKlines(binanceSymbol, interval, limit) {
  const url =
    `https://api.binance.com/api/v3/klines?symbol=${binanceSymbol}&interval=${interval}&limit=${limit}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Binance error ${response.status} for ${binanceSymbol} ${interval}`);
  }

  return response.json();
}

function mapDailyCandle(assetId, candle) {
  return {
    asset_id: assetId,
    date: new Date(candle[0]).toISOString().slice(0, 10),
    open: Number(candle[1]),
    high: Number(candle[2]),
    low: Number(candle[3]),
    close: Number(candle[4]),
    volume: Number(candle[5]),
    source: "binance"
  };
}

function mapFourHourCandle(assetId, candle) {
  return {
    asset_id: assetId,
    open_time: new Date(candle[0]).toISOString(),
    close_time: new Date(candle[6]).toISOString(),
    open: Number(candle[1]),
    high: Number(candle[2]),
    low: Number(candle[3]),
    close: Number(candle[4]),
    volume: Number(candle[5]),
    source: "binance"
  };
}

async function syncDailyPrices(assetSymbol, binanceSymbol) {
  const assetId = await getAssetId(assetSymbol);
  const candles = await fetchBinanceKlines(binanceSymbol, "1d", 400);

  const rows = candles.map((candle) => mapDailyCandle(assetId, candle));

  const { error: upsertError } = await supabaseClient
    .from("daily_prices")
    .upsert(rows, {
      onConflict: "asset_id,date,source"
    });

  if (upsertError) {
    throw new Error(`${assetSymbol} daily upsert failed: ${upsertError.message}`);
  }

  const { error: cleanupError } = await supabaseClient.rpc(
    "cleanup_daily_prices",
    {
      p_asset_id: assetId,
      p_source: "binance",
      p_keep_count: 400
    }
  );

  if (cleanupError) {
    throw new Error(`${assetSymbol} daily cleanup failed: ${cleanupError.message}`);
  }

  return rows.length;
}

async function syncFourHourPrices(assetSymbol, binanceSymbol) {
  const assetId = await getAssetId(assetSymbol);
  const candles = await fetchBinanceKlines(binanceSymbol, "4h", 1000);

  const rows = candles.map((candle) => mapFourHourCandle(assetId, candle));

  const { error: upsertError } = await supabaseClient
    .from("four_hour_prices")
    .upsert(rows, {
      onConflict: "asset_id,open_time,source"
    });

  if (upsertError) {
    throw new Error(`${assetSymbol} 4h upsert failed: ${upsertError.message}`);
  }

  const { error: cleanupError } = await supabaseClient.rpc(
    "cleanup_four_hour_prices",
    {
      p_asset_id: assetId,
      p_source: "binance",
      p_keep_count: 1000
    }
  );

  if (cleanupError) {
    throw new Error(`${assetSymbol} 4h cleanup failed: ${cleanupError.message}`);
  }

  return rows.length;
}

async function syncMarketData() {
  for (const asset of MARKET_ASSETS) {
    await syncDailyPrices(asset.assetSymbol, asset.binanceSymbol);
    await syncFourHourPrices(asset.assetSymbol, asset.binanceSymbol);
  }
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