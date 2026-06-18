// ============================================================================
// Configuration
// ============================================================================

const SUPABASE_URL = "https://ihphfkwoiiyhvvvfipal.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_19kbJOQDarnTwoqzBLSHGg_YVwoodAD";

const BINANCE_API_BASE_URL = "https://api.binance.com/api/v3";
const DATA_SOURCE = "binance";

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

const PRICE_HISTORY_CONFIG = [
  {
    interval: "1d",
    limit: 400,
    tableName: "daily_prices",
    conflictTarget: "asset_id,date,source",
    cleanupRpc: "cleanup_daily_prices",
    mapCandle: mapDailyCandle
  },
  {
    interval: "4h",
    limit: 1000,
    tableName: "four_hour_prices",
    conflictTarget: "asset_id,open_time,source",
    cleanupRpc: "cleanup_four_hour_prices",
    mapCandle: mapFourHourCandle
  }
];

// ============================================================================
// App State and DOM
// ============================================================================

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

const elements = {
  appScreen: document.getElementById("app-screen"),
  loginBtn: document.getElementById("login-btn"),
  loginError: document.getElementById("login-error"),
  loginScreen: document.getElementById("login-screen"),
  logoutBtn: document.getElementById("logout-btn"),
  pricesDashboard: document.getElementById("prices-dashboard"),
  scoreBreakdown: document.getElementById("score-breakdown"),
  prepareDcaBtn: document.getElementById("prepare-dca-btn"),
};

// ============================================================================
// Formatting Helpers
// ============================================================================

function formatEuro(value) {
  return `€${Number(value || 0).toFixed(2)}`;
}

function formatUsd(value) {
  return `$${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

function formatPercent(value) {
  return `${(Number(value || 0) * 100).toFixed(2)}%`;
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

// ============================================================================
// DOM Helpers
// ============================================================================

function setTextById(id, value) {
  const element = document.getElementById(id);

  if (!element) {
    console.warn(`Missing DOM element: #${id}`);
    return;
  }

  element.textContent = value;
}

function createMetricElement(label, value) {
  const row = document.createElement("div");
  row.className = "metric";

  const labelElement = document.createElement("span");
  labelElement.textContent = label;

  const valueElement = document.createElement("strong");
  valueElement.textContent = value;

  row.append(labelElement, valueElement);
  return row;
}

function createSummaryRow(label, valueId, extraClassName = "") {
  const row = document.createElement("div");
  row.className = ["summary-row", extraClassName].filter(Boolean).join(" ");

  const labelElement = document.createElement("span");
  labelElement.textContent = label;

  const valueElement = document.createElement("strong");
  valueElement.id = valueId;
  valueElement.textContent = "--";

  row.append(labelElement, valueElement);
  return row;
}

function groupRowsBySymbolAndGroup(rows) {
  return rows.reduce((groupedRows, row) => {
    groupedRows[row.symbol] ||= {};
    groupedRows[row.symbol][row.group_name] ||= [];
    groupedRows[row.symbol][row.group_name].push(row);
    return groupedRows;
  }, {});
}

function pickFirstNumber(source, keys) {
  const key = keys.find((candidate) => source[candidate] !== undefined);
  return key ? source[key] : null;
}

// ============================================================================
// External API Helpers
// ============================================================================

async function fetchJson(url, errorMessage) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`${errorMessage}: HTTP ${response.status}`);
  }

  return response.json();
}

async function fetchBinanceKlines(binanceSymbol, interval, limit) {
  const params = new URLSearchParams({
    interval,
    limit: String(limit),
    symbol: binanceSymbol
  });

  return fetchJson(
    `${BINANCE_API_BASE_URL}/klines?${params}`,
    `Binance klines failed for ${binanceSymbol} ${interval}`
  );
}

async function fetchBinanceCurrentPrice(binanceSymbol) {
  const params = new URLSearchParams({
    symbol: binanceSymbol
  });

  return fetchJson(
    `${BINANCE_API_BASE_URL}/ticker/price?${params}`,
    `Binance current price failed for ${binanceSymbol}`
  );
}

// ============================================================================
// Supabase Read Helpers
// ============================================================================

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

async function fetchDcaPortfolioRecommendation() {
  const { data, error } = await supabaseClient
    .from("dca_portfolio_recommendation_view")
    .select("*")
    .single();

  if (error) {
    throw new Error(`DCA portfolio query failed: ${error.message}`);
  }

  return data;
}

async function fetchDcaDashboardSummaries() {
  const { data, error } = await supabaseClient
    .from("dca_dashboard_summary_view")
    .select("*");

  if (error) {
    throw new Error(`DCA summary query failed: ${error.message}`);
  }

  return data;
}

async function fetchScoreDetails() {
  const { data, error } = await supabaseClient
    .from("dca_score_details_view")
    .select("*")
    .order("symbol", { ascending: true })
    .order("sort_order", { ascending: true });

  if (error) {
    throw new Error(`Score breakdown query failed: ${error.message}`);
  }

  return data;
}

async function fetchPricesDashboard() {
  const { data, error } = await supabaseClient
    .from("prices_dashboard_view")
    .select("*");

  if (error) {
    throw new Error(`Prices dashboard query failed: ${error.message}`);
  }

  return data;
}

async function fetchPortfolioSummary() {
  const { data, error } = await supabaseClient
    .from("portfolio_summary_view")
    .select("*")
    .single();

  if (error) {
    throw new Error(`Portfolio summary query failed: ${error.message}`);
  }

  return data;
}

// ============================================================================
// Supabase Write Helpers
// ============================================================================

async function upsertRows(tableName, rows, conflictTarget, contextMessage) {
  if (!rows.length) return;

  const { error } = await supabaseClient
    .from(tableName)
    .upsert(rows, {
      onConflict: conflictTarget
    });

  if (error) {
    throw new Error(`${contextMessage} upsert failed: ${error.message}`);
  }
}

async function cleanupPriceRows(assetId, cleanupRpc, keepCount, contextMessage) {
  const { error } = await supabaseClient.rpc(cleanupRpc, {
    p_asset_id: assetId,
    p_keep_count: keepCount,
    p_source: DATA_SOURCE
  });

  if (error) {
    throw new Error(`${contextMessage} cleanup failed: ${error.message}`);
  }
}

async function upsertCurrentPrice(assetId, assetSymbol, price) {
  const { error } = await supabaseClient
    .from("current_prices")
    .upsert(
      {
        asset_id: assetId,
        fetched_at: new Date().toISOString(),
        price,
        source: DATA_SOURCE,
        symbol: assetSymbol
      },
      {
        onConflict: "asset_id,source"
      }
    );

  if (error) {
    throw new Error(`${assetSymbol} current price upsert failed: ${error.message}`);
  }
}

async function prepareDcaSession() {
  const [portfolio, summaries, prices] = await Promise.all([
    fetchDcaPortfolioRecommendation(),
    fetchDcaDashboardSummaries(),
    fetchPricesDashboard()
  ]);

  const { data: session, error: sessionError } = await supabaseClient
    .from("dca_sessions")
    .insert({
      status: "pending",
      total_budget_eur: 300,
      source: "dashboard"
    })
    .select()
    .single();

  if (sessionError) {
    throw new Error(`DCA session creation failed: ${sessionError.message}`);
  }

  const priceBySymbol = Object.fromEntries(
    prices.map((item) => [item.symbol, item.current_price])
  );

  const summaryBySymbol = Object.fromEntries(
    summaries.map((item) => [item.symbol, item])
  );

  const items = [
    {
      session_id: session.id,
      symbol: "BTC",
      recommended_amount_eur: portfolio.btc_amount,
      score: summaryBySymbol.BTC.score,
      recommendation: summaryBySymbol.BTC.recommendation,
      multiplier: summaryBySymbol.BTC.dca_multiplier,
      current_price_usdc: priceBySymbol.BTC,
      estimated_quantity: portfolio.btc_amount / priceBySymbol.BTC,
      market_regime: summaryBySymbol.BTC.regime
    },
    {
      session_id: session.id,
      symbol: "ETH",
      recommended_amount_eur: portfolio.eth_amount,
      score: summaryBySymbol.ETH.score,
      recommendation: summaryBySymbol.ETH.recommendation,
      multiplier: summaryBySymbol.ETH.dca_multiplier,
      current_price_usdc: priceBySymbol.ETH,
      estimated_quantity: portfolio.eth_amount / priceBySymbol.ETH,
      market_regime: summaryBySymbol.ETH.regime
    },
    {
      session_id: session.id,
      symbol: "USDC",
      recommended_amount_eur: portfolio.usdc_amount,
      score: null,
      recommendation: "Reserve allocation",
      multiplier: null,
      current_price_usdc: 1,
      estimated_quantity: portfolio.usdc_amount,
      market_regime: null
    }
  ];

  const { error: itemsError } = await supabaseClient
    .from("dca_session_items")
    .insert(items);

  if (itemsError) {
    throw new Error(`DCA session items creation failed: ${itemsError.message}`);
  }

  alert("DCA session prepared");
}

// ============================================================================
// Data Mappers
// ============================================================================

function mapDailyCandle(assetId, candle) {
  return {
    asset_id: assetId,
    close: Number(candle[4]),
    date: new Date(candle[0]).toISOString().slice(0, 10),
    high: Number(candle[2]),
    low: Number(candle[3]),
    open: Number(candle[1]),
    source: DATA_SOURCE,
    volume: Number(candle[5])
  };
}

function mapFourHourCandle(assetId, candle) {
  return {
    asset_id: assetId,
    close: Number(candle[4]),
    close_time: new Date(candle[6]).toISOString(),
    high: Number(candle[2]),
    low: Number(candle[3]),
    open: Number(candle[1]),
    open_time: new Date(candle[0]).toISOString(),
    source: DATA_SOURCE,
    volume: Number(candle[5])
  };
}

function mapCurrentPriceQuote(quote) {
  return Number(quote.price);
}

// ============================================================================
// Market Sync Workflows
// ============================================================================

async function syncPriceHistory(asset, historyConfig) {
  const assetId = await getAssetId(asset.assetSymbol);
  const candles = await fetchBinanceKlines(
    asset.binanceSymbol,
    historyConfig.interval,
    historyConfig.limit
  );

  const rows = candles.map((candle) => historyConfig.mapCandle(assetId, candle));
  const contextMessage = `${asset.assetSymbol} ${historyConfig.interval}`;

  await upsertRows(
    historyConfig.tableName,
    rows,
    historyConfig.conflictTarget,
    contextMessage
  );
  await cleanupPriceRows(
    assetId,
    historyConfig.cleanupRpc,
    historyConfig.limit,
    contextMessage
  );

  return rows.length;
}

async function syncCurrentPrice(asset) {
  const assetId = await getAssetId(asset.assetSymbol);
  const quote = await fetchBinanceCurrentPrice(asset.binanceSymbol);
  const price = mapCurrentPriceQuote(quote);

  await upsertCurrentPrice(assetId, asset.assetSymbol, price);
  return price;
}

async function syncAssetMarketData(asset) {
  for (const historyConfig of PRICE_HISTORY_CONFIG) {
    await syncPriceHistory(asset, historyConfig);
  }

  await syncCurrentPrice(asset);
}

async function syncMarketData() {
  for (const asset of MARKET_ASSETS) {
    await syncAssetMarketData(asset);
  }
}

// ============================================================================
// Renderers
// ============================================================================

function renderDcaPortfolioRecommendation(portfolio) {
  setTextById("btc-dca-amount", formatEuro(portfolio.btc_amount));
  setTextById("eth-dca-amount", formatEuro(portfolio.eth_amount));
  setTextById("usdc-dca-amount", formatEuro(portfolio.usdc_amount));
}

function renderDcaSummaries(summaries) {
  summaries.forEach((item) => {
    const symbol = item.symbol;

    setTextById(`${symbol}-score-inline`, item.score);
    setTextById(`${symbol}-recommendation-inline`, item.recommendation);
    setTextById(`${symbol}-multiplier-inline`, `${item.dca_multiplier}x`);
    setTextById(
      `${symbol}-amount-inline`,
      formatEuro(item.recommended_amount_before_cap)
    );
  });
}

function renderScoreBreakdown(scoreRows) {
  const groupedRows = groupRowsBySymbolAndGroup(scoreRows);
  elements.scoreBreakdown.innerHTML = "";

  Object.entries(groupedRows).forEach(([symbol, groups]) => {
    const assetBlock = document.createElement("div");
    assetBlock.className = "breakdown-asset";

    const title = document.createElement("h3");
    title.textContent = symbol;

    const summary = document.createElement("div");
    summary.className = "asset-summary";
    summary.append(
      createSummaryRow("Recommendation", `${symbol}-recommendation-inline`),
      createSummaryRow("Multiplier", `${symbol}-multiplier-inline`),
      createSummaryRow("Monthly DCA", `${symbol}-amount-inline`),
      createSummaryRow("Total Score", `${symbol}-score-inline`, "total-score")
    );

    assetBlock.append(title, summary);

    Object.entries(groups).forEach(([groupName, rows]) => {
      const groupTitle = document.createElement("h4");
      groupTitle.className = "breakdown-group-title";
      groupTitle.textContent = groupName;
      assetBlock.appendChild(groupTitle);

      rows.forEach((row) => {
        assetBlock.appendChild(createScoreBreakdownRow(row));
      });
    });

    elements.scoreBreakdown.appendChild(assetBlock);
  });
}

function createScoreBreakdownRow(row) {
  const line = document.createElement("div");
  line.className = "breakdown-row";

  const detail = document.createElement("div");

  const condition = document.createElement("span");
  condition.textContent = `${row.factor}: ${row.condition}`;

  const threshold = document.createElement("small");
  threshold.textContent = row.threshold;

  const points = document.createElement("strong");
  points.className = getPointsClass(row.points);
  points.textContent = formatPoints(row.points);

  detail.append(condition, threshold);
  line.append(detail, points);

  return line;
}

function renderPricesDashboard(priceRows) {
  elements.pricesDashboard.innerHTML = "";

  priceRows.forEach((item) => {
    const card = document.createElement("div");
    card.className = "price-asset";

    const title = document.createElement("h3");
    title.textContent = item.symbol;

    card.append(
      title,
      createMetricElement("Current Price", formatUsd(item.current_price)),
      createMetricElement("24H Change", formatPercent(item.change_24h)),
      createMetricElement("3D Change", formatPercent(item.change_3d)),
      createMetricElement("4H Trend", item.short_term_trend),
      createMetricElement("Regime", item.market_regime),
      createMetricElement("200DMA Distance", formatPercent(item.distance_from_200d_ma)),
      createMetricElement("90D High Drawdown", formatPercent(item.pullback_pct)),
      createMetricElement(
        "Volatility",
        `${item.volatility_state} (${formatPercent(item.volatility_30d)})`
      ),
      createMetricElement("DCA Score", item.score)
    );

    elements.pricesDashboard.appendChild(card);
  });
}

function renderPortfolioSummary(summary) {
  // Note: field names are inferred from the current DOM IDs; missing fields are left unchanged.
  const totalValue = pickFirstNumber(summary, ["total_value", "portfolio_value"]);
  const totalInvested = pickFirstNumber(summary, ["total_invested", "invested_amount"]);
  const unrealizedPl = pickFirstNumber(summary, ["unrealized_pl", "unrealized_pnl"]);
  const btcAllocation = pickFirstNumber(summary, ["btc_allocation", "btc_allocation_pct"]);
  const ethAllocation = pickFirstNumber(summary, ["eth_allocation", "eth_allocation_pct"]);
  const usdcAllocation = pickFirstNumber(summary, ["usdc_allocation", "usdc_allocation_pct"]);

  if (totalValue !== null) setTextById("total-value", formatEuro(totalValue));
  if (totalInvested !== null) setTextById("total-invested", formatEuro(totalInvested));
  if (unrealizedPl !== null) setTextById("unrealized-pl", formatEuro(unrealizedPl));
  if (btcAllocation !== null) setTextById("btc-allocation", formatPercent(btcAllocation));
  if (ethAllocation !== null) setTextById("eth-allocation", formatPercent(ethAllocation));
  if (usdcAllocation !== null) setTextById("usdc-allocation", formatPercent(usdcAllocation));
}

// ============================================================================
// Dashboard Loaders
// ============================================================================

async function loadScoreBreakdown() {
  try {
    const scoreRows = await fetchScoreDetails();
    renderScoreBreakdown(scoreRows);
  } catch (error) {
    console.error(error);
  }
}

async function loadDcaRecommendations() {
  try {
    const [portfolio, summaries] = await Promise.all([
      fetchDcaPortfolioRecommendation(),
      fetchDcaDashboardSummaries()
    ]);

    renderDcaPortfolioRecommendation(portfolio);
    renderDcaSummaries(summaries);
  } catch (error) {
    console.error(error);
  }
}

function formatDateTime(value) {
  if (!value) return "--";

  return new Date(value).toLocaleString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "short"
  });
}

function createAssetSection(symbol, rows) {
  return `
    <div class="price-asset">
      <h3>${symbol}</h3>
      ${rows}
    </div>
  `;
}

function createMetricHtml(label, value) {
  return `
    <div class="metric">
      <span>${label}</span>
      <strong>${value ?? "--"}</strong>
    </div>
  `;
}

async function loadPricesDashboard() {
  const { data, error } = await supabaseClient
    .from("prices_dashboard_view")
    .select("*")
    .order("symbol", { ascending: true });

  if (error) {
    console.error("Prices dashboard error:", error);
    return;
  }

  const livePrices = document.getElementById("live-prices");
  const shortTerm = document.getElementById("short-term-market");
  const structure = document.getElementById("market-structure");
  const valuationRisk = document.getElementById("valuation-risk");

  livePrices.innerHTML = "";
  shortTerm.innerHTML = "";
  structure.innerHTML = "";
  valuationRisk.innerHTML = "";

  data.forEach((item) => {
    livePrices.innerHTML += createAssetSection(
      item.symbol,
      createMetricHtml("Current Price", formatUsd(item.current_price)) +
      createMetricHtml("Last Update", formatDateTime(item.fetched_at))
    );

    shortTerm.innerHTML += createAssetSection(
      item.symbol,
      createMetricHtml("24H Change", formatPercent(item.change_24h)) +
      createMetricHtml("3D Change", formatPercent(item.change_3d)) +
      createMetricHtml("4H Trend", item.short_term_trend)
    );

    structure.innerHTML += createAssetSection(
      item.symbol,
      createMetricHtml("Regime", item.market_regime) +
      createMetricHtml("200DMA Distance", formatPercent(item.distance_from_200d_ma)) +
      createMetricHtml(
        "200DMA Slope",
        `${item.ma_200d_slope_state} (${formatPercent(item.ma_200d_slope_30d)} / 30d)`
      )
    );

    valuationRisk.innerHTML += createAssetSection(
      item.symbol,
      createMetricHtml("90D Pullback", formatPercent(item.pullback_pct)) +
      createMetricHtml(
        "Volatility",
        `${item.volatility_state} (${formatPercent(item.volatility_30d)})`
      )
    );
  });
}

async function loadPortfolioSummary() {
  try {
    const summary = await fetchPortfolioSummary();
    renderPortfolioSummary(summary);
    console.log("Portfolio summary:", summary);
  } catch (error) {
    console.error(error);
  }
}

async function refreshDashboardData() {
  try {
    await syncMarketData();
    alert("Market data sync complete");
  } catch (error) {
    console.error(error);
    alert(error.message);
  }

  await loadScoreBreakdown();
  await Promise.all([
    loadDcaRecommendations(),
    loadPortfolioSummary(),
    loadPricesDashboard()
  ]);
}

// ============================================================================
// Screen and Navigation
// ============================================================================

function showLogin() {
  elements.loginScreen.classList.remove("hidden");
  elements.appScreen.classList.add("hidden");
}

async function showApp() {
  elements.loginScreen.classList.add("hidden");
  elements.appScreen.classList.remove("hidden");

  await refreshDashboardData();
}

function showPage(targetPageId) {
  document.querySelectorAll(".page").forEach((page) => {
    page.classList.toggle("active-page", page.id === targetPageId);
  });

  document.querySelectorAll(".nav-btn").forEach((button) => {
    button.classList.toggle("active", button.dataset.page === targetPageId);
  });
}

// ============================================================================
// Auth Handlers
// ============================================================================

async function checkSession() {
  const { data, error } = await supabaseClient.auth.getSession();

  if (error) {
    console.error("Session error:", error);
    showLogin();
    return;
  }

  if (data.session) {
    await showApp();
    return;
  }

  showLogin();
}

async function handleLogin() {
  elements.loginError.textContent = "";

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  const { error } = await supabaseClient.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    elements.loginError.textContent = error.message;
    return;
  }

  await showApp();
}

async function handleLogout() {
  await supabaseClient.auth.signOut();
  showLogin();
}

// ============================================================================
// Startup
// ============================================================================

function bindEvents() {
  elements.loginBtn.addEventListener("click", handleLogin);
  elements.logoutBtn.addEventListener("click", handleLogout);

  document.querySelectorAll(".nav-btn").forEach((button) => {
    button.addEventListener("click", () => showPage(button.dataset.page));
  });

  elements.prepareDcaBtn.addEventListener("click", async () => {
  try {
    await prepareDcaSession();
  } catch (error) {
    console.error(error);
    alert(error.message);
  }
});
}

function init() {
  bindEvents();
  checkSession();
}

init();
