export interface TokenRates {
  promptUsdPerMillion: number;
  completionUsdPerMillion: number;
}

export function usageCost(
  usage: { promptTokens: number; completionTokens: number },
  rates: TokenRates
): number {
  return (usage.promptTokens * rates.promptUsdPerMillion + usage.completionTokens * rates.completionUsdPerMillion) / 1_000_000;
}
