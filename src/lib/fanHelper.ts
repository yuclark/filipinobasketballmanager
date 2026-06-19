export function calculateFanChange(isWinner: boolean, scoreDiff: number, isHome: boolean): number {
  if (isWinner) {
    let delta = 800 + Math.floor(Math.random() * 400); // 800 - 1200
    if (scoreDiff >= 18) {
      delta += 300; // Blowout bonus
    } else if (scoreDiff <= 5) {
      delta += 150; // Close game/clutch bonus
    }
    if (isHome) {
      delta = Math.round(delta * 1.1); // Home game boost
    }
    return delta;
  } else {
    // Loss
    let delta = -(300 + Math.floor(Math.random() * 200)); // -300 to -500
    if (scoreDiff >= 18) {
      delta -= 200; // Blowout penalty
    } else if (scoreDiff <= 5) {
      delta += 150; // Close loss penalty reduction
    }
    if (!isHome) {
      delta = Math.round(delta * 0.9); // Away loss hurts slightly less
    }
    return delta;
  }
}
