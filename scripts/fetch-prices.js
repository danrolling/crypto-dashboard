// import { createClient } from "@supabase/supabase-js";

// const SUPABASE_URL = process.env.SUPABASE_URL;
// const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  // throw new Error("Missing Supabase environment variables");
// }

// const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// const ASSET_SYMBOLS = ["BTC", "ETH"];

// const BINANCE_SYMBOLS = {
  // BTC: "BTCUSDC",
  // ETH: "ETHUSDC"
// };

// async function getAssets() {
  // const { data, error } = await supabase
    // .from("assets")
    // .select("id, symbol");

  // if (error) throw error;

  // return Object.fromEntries(data.map((asset) => [asset.symbol, asset.id]));
// }

// async function fetchKlines(symbol, interval, limit) {
  // const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;

  // const response = await fetch(url);

  // if (!response.ok) {
    // throw new Error(`Binance error ${response.status} for ${symbol} ${interval}`);
  // }

  // return response.json();
// }

// function mapDailyCandle(assetId, candle) {
  // return {
    // asset_id: assetId,
    // date: new Date(candle[0]).toISOString().slice(0, 10),
    // open: Number(candle[1]),
    // high: Number(candle[2]),
    // low: Number(candle[3]),
    // close: Number(candle[4]),
    // volume: Number(candle[5]),
    // source: "binance"
  // };
// }

// function mapFourHourCandle(assetId, candle) {
  // return {
    // asset_id: assetId,
    // open_time: new Date(candle[0]).toISOString(),
    // close_time: new Date(candle[6]).toISOString(),
    // open: Number(candle[1]),
    // high: Number(candle[2]),
    // low: Number(candle[3]),
    // close: Number(candle[4]),
    // volume: Number(candle[5]),
    // source: "binance"
  // };
// }

// async function upsertDailyPrices(rows) {
  // const { error } = await supabase
    // .from("daily_prices")
    // .upsert(rows, {
      // onConflict: "asset_id,date,source"
    // });

  // if (error) throw error;
// }

// async function upsertFourHourPrices(rows) {
  // const { error } = await supabase
    // .from("four_hour_prices")
    // .upsert(rows, {
      // onConflict: "asset_id,open_time,source"
    // });

  // if (error) throw error;
// }

// async function main() {
  // console.log("Starting Binance price ingestion");

  // const assets = await getAssets();

  // for (const assetSymbol of ASSET_SYMBOLS) {
    // const assetId = assets[assetSymbol];
    // const binanceSymbol = BINANCE_SYMBOLS[assetSymbol];

    // if (!assetId) {
      // throw new Error(`Missing asset in Supabase: ${assetSymbol}`);
    // }

    // console.log(`Fetching daily candles for ${binanceSymbol}`);
    // const dailyCandles = await fetchKlines(binanceSymbol, "1d", 300);
    // const dailyRows = dailyCandles.map((candle) =>
      // mapDailyCandle(assetId, candle)
    // );

    // await upsertDailyPrices(dailyRows);
    // console.log(`Upserted ${dailyRows.length} daily rows for ${assetSymbol}`);

    // console.log(`Fetching 4h candles for ${binanceSymbol}`);
    // const fourHourCandles = await fetchKlines(binanceSymbol, "4h", 500);
    // const fourHourRows = fourHourCandles.map((candle) =>
      // mapFourHourCandle(assetId, candle)
    // );

    // await upsertFourHourPrices(fourHourRows);
    // console.log(`Upserted ${fourHourRows.length} 4h rows for ${assetSymbol}`);
  // }

  // console.log("Price ingestion complete");
// }

// main().catch((error) => {
  // console.error(error);
  // process.exit(1);
// });