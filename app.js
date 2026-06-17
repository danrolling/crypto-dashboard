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
    await syncCurrentPrice(asset.assetSymbol, asset.binanceSymbol);
  }
}


function formatEuro(value) {
  return `€${Number(value || 0).toFixed(2)}`;
}

async function loadDcaRecommendations() {
  const { data: portfolio, error: portfolioError } = await supabaseClient
    .from("dca_portfolio_recommendation_view")
    .select("*")
    .single();

  if (portfolioError) {
    console.error("DCA portfolio error:", portfolioError);
    return;
  }

  document.getElementById("btc-dca-amount").textContent = formatEuro(portfolio.btc_amount);
  document.getElementById("eth-dca-amount").textContent = formatEuro(portfolio.eth_amount);
  document.getElementById("usdc-dca-amount").textContent = formatEuro(portfolio.usdc_amount);

  const { data: summaries, error: summaryError } = await supabaseClient
    .from("dca_dashboard_summary_view")
    .select("*");

  if (summaryError) {
    console.error("DCA summary error:", summaryError);
    return;
  }

  summaries.forEach((item) => {
    const symbol = item.symbol;

    document.getElementById(`${symbol}-score-inline`).textContent = item.score;
    document.getElementById(`${symbol}-recommendation-inline`).textContent = item.recommendation;
    document.getElementById(`${symbol}-multiplier-inline`).textContent = `${item.dca_multiplier}x`;
    document.getElementById(`${symbol}-amount-inline`).textContent =
      formatEuro(item.recommended_amount_before_cap);
  });
}


function formatPoints(points) {
  if (points === null) return "Info";
  if (points > 0) return `+${points}`;
  return `${points}`;
}

function getPointsClass(points) {
  if (points === null || points === 0) return "points-neutral";
  if (points > 0) return "points-positive";
  return "points-negative";
}

const FACTOR_ORDER = {
  "TOTAL SCORE": 0,
  "200DMA slope": 1,
  "Regime": 2,
  "200DMA position": 3,
  "90D drawdown": 4,
  "4H trend": 5,
  "24H momentum": 6,
  "3D momentum": 7,
  "50MA 4H extension": 8,
  "21MA 4H extension": 9,
  "Volatility": 10
};

async function loadScoreBreakdown() {
  const { data, error } = await supabaseClient
    .from("dca_score_details_view")
    .select("*")
    .order("symbol", { ascending: true })
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("Score breakdown error:", error);
    return;
  }

  const container = document.getElementById("score-breakdown");
  container.innerHTML = "";

  const grouped = data.reduce((acc, row) => {
    if (!acc[row.symbol]) acc[row.symbol] = {};
    if (!acc[row.symbol][row.group_name]) acc[row.symbol][row.group_name] = [];
    acc[row.symbol][row.group_name].push(row);
    return acc;
  }, {});

  Object.entries(grouped).forEach(([symbol, groups]) => {
    const assetBlock = document.createElement("div");
    assetBlock.className = "breakdown-asset";

    assetBlock.innerHTML = `
      <h3>${symbol}</h3>

      <div class="asset-summary">
        <div class="summary-row">
          <span>Recommendation</span>
          <strong id="${symbol}-recommendation-inline">--</strong>
        </div>

        <div class="summary-row">
          <span>Multiplier</span>
          <strong id="${symbol}-multiplier-inline">--</strong>
        </div>

        <div class="summary-row">
          <span>Monthly DCA</span>
          <strong id="${symbol}-amount-inline">--</strong>
        </div>

        <div class="summary-row total-score">
          <span>Total Score</span>
          <strong id="${symbol}-score-inline">--</strong>
        </div>
      </div>
    `;

    Object.entries(groups).forEach(([groupName, rows]) => {
      const groupTitle = document.createElement("h4");
      groupTitle.className = "breakdown-group-title";
      groupTitle.textContent = groupName;
      assetBlock.appendChild(groupTitle);

      rows.forEach((row) => {
        const line = document.createElement("div");
        line.className = "breakdown-row";

        line.innerHTML = `
          <div>
            <span>${row.factor}: ${row.condition}</span>
            <small>${row.threshold}</small>
          </div>
          <strong class="${getPointsClass(row.points)}">${formatPoints(row.points)}</strong>
        `;

        assetBlock.appendChild(line);
      });
    });

    container.appendChild(assetBlock);
  });
}

async function syncCurrentPrice(assetSymbol, binanceSymbol) {
  const assetId = await getAssetId(assetSymbol);

  const response = await fetch(
    `https://api.binance.com/api/v3/ticker/price?symbol=${binanceSymbol}`
  );

  if (!response.ok) {
    throw new Error(`Current price fetch failed for ${binanceSymbol}`);
  }

  const quote = await response.json();

  const { error } = await supabaseClient
    .from("current_prices")
    .upsert(
      {
        asset_id: assetId,
        symbol: assetSymbol,
        price: Number(quote.price),
        source: "binance",
        fetched_at: new Date().toISOString()
      },
      {
        onConflict: "asset_id,source"
      }
    );

  if (error) {
    throw new Error(`${assetSymbol} current price upsert failed: ${error.message}`);
  }

  return Number(quote.price);
}

async function syncCurrentPrices() {
  for (const asset of MARKET_ASSETS) {
    await syncCurrentPrice(asset.assetSymbol, asset.binanceSymbol);
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
  
  
  try {
  await syncMarketData();
  alert("Market data sync complete");
  } catch (error) {
    console.error(error);
    alert(error.message);
  }

  await loadScoreBreakdown();
  await loadDcaRecommendations();
    
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