export function calculateContractDemand(
  player: { id: string; overall: number; salary: number },
  recentDeltaOvr = 0,
  hasAward = false,
  hasAllLeague = false
): number {
  const ovr = player.overall;
  let baseDemand = 0;

  if (ovr <= 50) {
    baseDemand = 500000;
  } else if (ovr <= 65) {
    baseDemand = 500000 + (ovr - 50) * 66000; // 51 to 65: ₱600k to ₱1.5M
  } else if (ovr <= 75) {
    baseDemand = 1500000 + (ovr - 65) * 200000; // 66 to 75: ₱1.7M to ₱3.5M
  } else if (ovr <= 80) {
    baseDemand = 3500000 + (ovr - 75) * 700000; // 76 to 80: ₱4.2M to ₱7.0M
  } else if (ovr <= 85) {
    baseDemand = 7000000 + (ovr - 80) * 900000; // 81 to 85: ₱7.9M to ₱11.5M
  } else {
    baseDemand = 11500000 + (ovr - 85) * 1150000; // 86 to 99: ₱12.65M to ₱27.6M
  }

  let multiplier = 1.0;
  if (recentDeltaOvr > 0) {
    multiplier += Math.min(0.3, recentDeltaOvr * 0.05); // up to +30%
  }
  if (hasAward) {
    multiplier += 0.25; // +25%
  }
  if (hasAllLeague) {
    multiplier += 0.15; // +15%
  }

  const finalDemand = Math.round((baseDemand * multiplier) / 10000) * 10000;
  
  // Ensure the demand is at least the league minimum (500k)
  // If the player had progression, they expect a raise, so demand should be at least 15% higher than previous salary.
  // Otherwise, they'd expect at least their previous salary (unless they are regressing).
  const minRequired = Math.max(
    500000, 
    recentDeltaOvr > 0 
      ? Math.round((player.salary * 1.15) / 10000) * 10000 
      : player.salary
  );

  // If the player regressed significantly (recentDeltaOvr < 0), allow demand to be lower than previous salary
  if (recentDeltaOvr < 0) {
    return Math.max(500000, finalDemand);
  }

  return Math.max(finalDemand, minRequired);
}

export function calculateRookieSalary(overall: number): number {
  // Rookie scale is lower than veteran contracts.
  // 50 OVR: ₱800k. 80 OVR: ₱3.8M. 87 OVR: ₱4.5M.
  const base = 800000 + (overall - 50) * 100000;
  return Math.round(Math.max(500000, Math.min(5000000, base)) / 10000) * 10000;
}
