/**
 * CoinGecko API service for fetching token prices
 */

const COINGECKO_API_KEY = process.env.NEXT_PUBLIC_COINGECKO_API;
const COINGECKO_API_URL = "https://api.coingecko.com/api/v3";

export interface CoinGeckoPriceResponse {
  [coinId: string]: {
    usd: number;
    usd_24h_change?: number;
  };
}

/**
 * Fetch the current USD price for a token by its CoinGecko ID
 * @param coinId - The CoinGecko ID of the token (e.g., "ethereum", "bitcoin")
 * @returns The price in USD or null if not found
 */
export async function getTokenPrice(coinId: string): Promise<number | null> {
  if (!coinId) {
    return null;
  }

  try {
    const apiKeyParam = COINGECKO_API_KEY
      ? `&x_cg_demo_api_key=${COINGECKO_API_KEY}`
      : "";
    const url = `${COINGECKO_API_URL}/simple/price?ids=${coinId}&vs_currencies=usd${apiKeyParam}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      console.error(
        `CoinGecko API error: ${response.status} ${response.statusText}`
      );
      return null;
    }

    const data: CoinGeckoPriceResponse = await response.json();

    if (!data[coinId] || typeof data[coinId].usd !== "number") {
      return null;
    }

    return data[coinId].usd;
  } catch (error) {
    console.error("Error fetching token price from CoinGecko:", error);
    return null;
  }
}

/**
 * Fetch prices for multiple tokens at once
 * @param coinIds - Array of CoinGecko IDs
 * @returns Map of coin ID to price
 */
export async function getTokenPrices(
  coinIds: string[]
): Promise<Map<string, number>> {
  if (coinIds.length === 0) {
    return new Map();
  }

  // Filter out empty IDs
  const validIds = coinIds.filter((id) => id && id.trim() !== "");
  if (validIds.length === 0) {
    return new Map();
  }

  try {
    const apiKeyParam = COINGECKO_API_KEY
      ? `&x_cg_demo_api_key=${COINGECKO_API_KEY}`
      : "";
    const idsParam = validIds.join(",");
    const url = `${COINGECKO_API_URL}/simple/price?ids=${idsParam}&vs_currencies=usd${apiKeyParam}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      console.error(
        `CoinGecko API error: ${response.status} ${response.statusText}`
      );
      return new Map();
    }

    const data: CoinGeckoPriceResponse = await response.json();
    const priceMap = new Map<string, number>();

    for (const coinId of validIds) {
      if (data[coinId] && typeof data[coinId].usd === "number") {
        priceMap.set(coinId, data[coinId].usd);
      }
    }

    return priceMap;
  } catch (error) {
    console.error("Error fetching token prices from CoinGecko:", error);
    return new Map();
  }
}

/**
 * Calculate the USD value of a token amount
 * @param amount - The amount of tokens (as a number or string)
 * @param price - The price per token in USD
 * @returns The USD value
 */
export function calculateTokenValue(
  amount: number | string,
  price: number | null
): number {
  if (!price || price <= 0) {
    return 0;
  }

  const amountNum = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(amountNum) || amountNum <= 0) {
    return 0;
  }

  return amountNum * price;
}
