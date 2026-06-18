"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useGameStore } from "@/store/useGameStore";
import { getLiveGameDataAction, saveLiveGameResultAction } from "@/app/actions/leagueEngine";
import {
  Loader2,
  ChevronLeft,
  Play,
  Pause,
  Zap,
  Activity,
  ShieldAlert,
  Coins,
  TrendingUp,
  Award
} from "lucide-react";
import PlayerAvatar from "@/components/PlayerAvatar";

// Tactical coaching options types
type Tactic = "Balanced" | "Run & Gun" | "Grit & Grind" | "Pound Inside" | "Full Court Press";

interface Player {
  id: string;
  firstName: string;
  lastName: string;
  position: string;
  overall: number;
  threePoint: number;
  insideScoring: number;
  playmaking: number;
  perimeterDefense: number;
  interiorDefense: number;
  rebounding: number;
  speed: number;
  stamina: number;
  isStarter: boolean;
  salary: number;
}

interface LiveStat {
  playerId: string;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fgm: number;
  fga: number;
  fg3m: number;
  fg3a: number;
  ftm: number;
  fta: number;
  secondsPlayed: number;
  minutes: number;
  stamina: number;
}

export default function LiveGamePage() {
  const params = useParams();
  const router = useRouter();
  const gameId = params.gameId as string;
  const { userTeamId, triggerAutosave } = useGameStore();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Loaded DB data
  const [game, setGame] = useState<any>(null);
  const [homeTeam, setHomeTeam] = useState<any>(null);
  const [awayTeam, setAwayTeam] = useState<any>(null);
  const [homeRoster, setHomeRoster] = useState<Player[]>([]);
  const [awayRoster, setAwayRoster] = useState<Player[]>([]);

  // Simulation controls
  const [isPlaying, setIsPlaying] = useState(false);
  const [simSpeed, setSimSpeed] = useState<number>(2); // 1 = 1x, 2 = 2x, 5 = 5x, 10 = 10x, 999 = Instant
  const [userTactic, setUserTactic] = useState<Tactic>("Balanced");
  const [activeTab, setActiveTab] = useState<"home" | "away">("home");

  // Live game scores and clocks
  const [quarter, setQuarter] = useState<number>(1); // 1-4, 5+ for OT
  const [clockSeconds, setClockSeconds] = useState<number>(720); // 12 mins = 720 secs
  const [homeScore, setHomeScore] = useState<number>(0);
  const [awayScore, setAwayScore] = useState<number>(0);
  const [possession, setPossession] = useState<"home" | "away">("home");
  const [gameCompleted, setGameCompleted] = useState(false);

  // Lineups on floor (arrays of player IDs)
  const [homeFloorIds, setHomeFloorIds] = useState<string[]>([]);
  const [awayFloorIds, setAwayFloorIds] = useState<string[]>([]);

  // Live statistics map: playerId -> stats
  const [statsMap, setStatsMap] = useState<Record<string, LiveStat>>({});
  const [commentaryList, setCommentaryList] = useState<string[]>([]);

  const commentaryEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const wasAtBottomRef = useRef(true);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Keep tactical coaching refs to avoid re-binding during loop ticks
  const tacticRef = useRef<Tactic>("Balanced");
  useEffect(() => {
    tacticRef.current = userTactic;
  }, [userTactic]);

  // Load game context from database
  useEffect(() => {
    const fetchGameData = async () => {
      try {
        setLoading(true);
        const res = await getLiveGameDataAction(gameId);
        if (res.success && res.game) {
          setGame(res.game);
          setHomeTeam(res.homeTeam);
          setAwayTeam(res.awayTeam);
          setHomeRoster(res.homePlayers as Player[]);
          setAwayRoster(res.awayPlayers as Player[]);

          // Initialize starting line-ups (first 5 players returned by server action sort)
          const homeStarters = (res.homePlayers as Player[]).slice(0, 5).map(p => p.id);
          const awayStarters = (res.awayPlayers as Player[]).slice(0, 5).map(p => p.id);
          setHomeFloorIds(homeStarters);
          setAwayFloorIds(awayStarters);

          // Initialize live stats for all players
          const initialStats: Record<string, LiveStat> = {};
          const initializePlayerStats = (player: Player) => {
            initialStats[player.id] = {
              playerId: player.id,
              points: 0,
              rebounds: 0,
              assists: 0,
              steals: 0,
              blocks: 0,
              turnovers: 0,
              fgm: 0,
              fga: 0,
              fg3m: 0,
              fg3a: 0,
              ftm: 0,
              fta: 0,
              secondsPlayed: 0,
              minutes: 0,
              stamina: 100,
            };
          };

          (res.homePlayers as Player[]).forEach(initializePlayerStats);
          (res.awayPlayers as Player[]).forEach(initializePlayerStats);
          setStatsMap(initialStats);

          // Determine jump ball winner randomly
          const initialPos = Math.random() < 0.5 ? "home" : "away";
          setPossession(initialPos);

          const jumpsMsg = `🏀 Jump ball at center court! The ref tosses it up... and it's controlled by the ${
            initialPos === "home" ? res.homeTeam.city : res.awayTeam.city
          }! Play begins!`;
          setCommentaryList([jumpsMsg]);
        } else {
          setError(res.error || "Failed to load game details.");
        }
      } catch (err: any) {
        console.error(err);
        setError("Error pulling live game data.");
      } finally {
        setLoading(false);
      }
    };

    fetchGameData();
  }, [gameId]);

  // Scroll commentary feed to bottom only if user is already near the bottom
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    if (wasAtBottomRef.current) {
      container.scrollTop = container.scrollHeight;
    }
  }, [commentaryList]);

  const handleScroll = () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    // Check if user is within 55px of the bottom (or container hasn't overflowed yet)
    const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight <= 55;
    wasAtBottomRef.current = isAtBottom;
  };

  // Commentary phrases repository
  const generateCommentary = (
    type: "3pm" | "3pa" | "2pm" | "2pa" | "to" | "steal" | "block" | "rebound_d" | "rebound_o" | "quarter_end" | "sub" | "foul" | "ftm" | "fta",
    player: Player,
    helper?: Player | null,
    opponentCity?: string
  ): string => {
    const name = `${player.firstName} ${player.lastName}`;
    const helperName = helper ? `${helper.firstName} ${helper.lastName}` : "";
    const rand = Math.random();

    switch (type) {
      case "3pm":
        if (rand < 0.25) return `🎯 ${name} pakawalan ang tres mula sa wing... BOOM! Pasok ang tirada!`;
        if (rand < 0.5) return `🎯 Mula sa logo, ${name} tumira para sa tatlo... SUNOG ANG NET! Tres puntos!`;
        if (rand < 0.75) return `🎯 ${name} steps back, pulls up from downtown... KABOOM! Walang duda!`;
        return `🎯 Pinakawalan ni ${name} ang gintong tirada mula sa perimeter... Pasok! Tres para sa Barangay!`;

      case "3pa":
        if (rand < 0.33) return `⚪ ${name} binitawan ang tres... KAPOS! Dumaplis lang sa ring.`;
        if (rand < 0.66) return `⚪ ${name} sumubok sa perimeter para sa tatlong puntos... SALPANG SA BAKAL! Sablay!`;
        return `⚪ ${name} pinilit ang tres sa depensa... Tumalbog sa ring, sablay ang gabi!`;

      case "2pm":
        if (rand < 0.2) return `🏀 ${name} umahon para sa layup... AND-ONE! Pasok pa rin kahit may foul!`;
        if (rand < 0.4) return `🏀 ${name} drive, spin move sa lane, sabay layup... Grabe ang ganda ng galaw!`;
        if (rand < 0.6) return `🏀 Pinasa kay ${name} sa ilalim, umikot... DAKDAK! Grabe ang bagsak ng ring!`;
        if (rand < 0.8) return `🏀 ${name} calls for the ball, faces up, and hits a beautiful turn-around jumper.`;
        return `🏀 ${name} cuts inside, gets the bounce pass, and floats it over the defender's outstretched arms!`;

      case "2pa":
        if (rand < 0.33) return `⚪ ${name} umatake, bumitaw ng floater... UMALOG SA RING! Sablay!`;
        if (rand < 0.66) return `⚪ ${name} drives hard, tries the hook shot... Masyadong malakas, tumama sa backboard.`;
        return `⚪ Tinira ni ${name} mula sa mid-range... SALPANG SA RING! Ref rebounds!`;

      case "to":
        if (rand < 0.5) return `⚠️ ${name} bad pass! Nawala ang kontrol sa bola, turn-over!`;
        return `⚠️ Travelling violation tinawag kay ${name}. Bola ng kalaban.`;

      case "steal":
        if (rand < 0.5) return `⚡ Nagnakaw ng bola si ${name}! Na-intercept ang pasa at tumakbo sa kabila!`;
        return `⚡ Agaw agad ni ${name}! Dinikitan ang dribbler at natapik ang bola! Fastbreak!`;

      case "block":
        if (rand < 0.5) return `🛡️ PERO SUPALPAL NI ${name}! Dinikitan at binalibag ang tirada! Hindi pwede yan dito!`;
        return `🛡️ Tries the layup... PINIGILAN NI ${name}! What a clean and thunderous rejection!`;

      case "rebound_d":
        if (rand < 0.5) return `🗑️ Inagaw ni ${name} ang depensa rebound. Clears the glass!`;
        return `🗑️ ${name} rebounds! Box-out masterclass at secure ang posesyon.`;

      case "rebound_o":
        if (rand < 0.5) return `🗑️ Offensive rebound ni ${name}! Umiwas sa depensa at nakuha ang ikalawang pagkakataon!`;
        return `🗑️ Nakuha ni ${name} ang sariling sablay! Second chance points on the way!`;

      case "sub":
        return `🔄 SUB: Pumasok si ${name} para pahingahin si ${helperName}.`;

      case "foul":
        return `💥 Foul! ${name} tinawagan ng referee. Dumiretso sa free throw line ang kalaban.`;

      case "ftm":
        return `🎯 Free Throw ni ${name}... Swish! Pasok ang benta.`;

      case "fta":
        return `⚪ Free Throw ni ${name}... Sablay! Sumabog sa bakal.`;

      default:
        return "";
    }
  };

  // Setup simulation clock and simulation loop tick
  const simulatePossession = useCallback(() => {
    if (gameCompleted) return;

    // 1. Choose line-up on court details
    const homeOnCourt = homeRoster.filter(p => homeFloorIds.includes(p.id));
    const awayOnCourt = awayRoster.filter(p => awayFloorIds.includes(p.id));

    if (homeOnCourt.length < 5 || awayOnCourt.length < 5) {
      console.warn("Rosters not fully initialized on floor yet.");
      return;
    }

    // Determine current off/def rosters
    const isHomeOffense = possession === "home";
    const offRoster = isHomeOffense ? homeOnCourt : awayOnCourt;
    const defRoster = isHomeOffense ? awayOnCourt : homeOnCourt;
    const offTeamName = isHomeOffense ? homeTeam.name : awayTeam.name;

    // Apply tactical coaching modifiers for the user team
    const isUserOffense = (isHomeOffense && homeTeam.id === userTeamId) || (!isHomeOffense && awayTeam.id === userTeamId);
    const isUserDefense = (!isHomeOffense && homeTeam.id === userTeamId) || (isHomeOffense && awayTeam.id === userTeamId);
    const activeTactic = tacticRef.current;

    // Base probabilities
    let prob3PT = 0.30;
    let prob2PT = 0.55;
    let probTO = 0.15;

    // Modify play selection frequencies based on tactics
    if (isUserOffense) {
      if (activeTactic === "Run & Gun") {
        prob3PT = 0.55;
        prob2PT = 0.32;
        probTO = 0.13;
      } else if (activeTactic === "Pound Inside") {
        prob3PT = 0.15;
        prob2PT = 0.73;
        probTO = 0.12;
      }
    }

    // Possession duration (10 to 24 seconds)
    let possessionSeconds = Math.floor(Math.random() * 15) + 10;
    if (isUserOffense && activeTactic === "Run & Gun") {
      possessionSeconds = Math.floor(Math.random() * 8) + 7; // Faster play
    } else if (isUserOffense && activeTactic === "Grit & Grind") {
      possessionSeconds = Math.floor(Math.random() * 10) + 14; // Slower play
    }

    const nextClock = Math.max(0, clockSeconds - possessionSeconds);
    const actualSecondsUsed = clockSeconds - nextClock;

    // Update stamina and minutes played in memory map
    setStatsMap(prev => {
      const nextStats = { ...prev };

      // Helper to degrade stamina & add seconds played
      const updateFloorStats = (pId: string) => {
        if (nextStats[pId]) {
          nextStats[pId].secondsPlayed += actualSecondsUsed;
          if (nextStats[pId].secondsPlayed >= 60) {
            const addedMin = Math.floor(nextStats[pId].secondsPlayed / 60);
            nextStats[pId].minutes += addedMin;
            nextStats[pId].secondsPlayed %= 60;
          }
          // Stamina loss: 0.15 stamina per second active
          nextStats[pId].stamina = Math.max(
            30,
            nextStats[pId].stamina - actualSecondsUsed * 0.15
          );
        }
      };

      // Rest bench players: recover 0.5 stamina per second rest
      const updateBenchStats = (player: Player) => {
        const pId = player.id;
        if (nextStats[pId]) {
          nextStats[pId].stamina = Math.min(
            100,
            nextStats[pId].stamina + actualSecondsUsed * 0.5
          );
        }
      };

      homeFloorIds.forEach(updateFloorStats);
      awayFloorIds.forEach(updateFloorStats);
      homeRoster.filter(p => !homeFloorIds.includes(p.id)).forEach(updateBenchStats);
      awayRoster.filter(p => !awayFloorIds.includes(p.id)).forEach(updateBenchStats);

      return nextStats;
    });

    // Auto-substitutions logic
    const attemptSubstitutions = (teamSide: "home" | "away", floorIds: string[], roster: Player[]) => {
      const tiredIds = floorIds.filter(id => {
        const st = statsMap[id]?.stamina ?? 100;
        return st < 65;
      });

      if (tiredIds.length === 0) return;

      const benchPlayers = roster.filter(p => !floorIds.includes(p.id));
      const healthyBench = benchPlayers.filter(p => (statsMap[p.id]?.stamina ?? 0) >= 80);

      if (healthyBench.length === 0) return;

      const newFloorIds = [...floorIds];
      const substitutionsMade: Array<{ inPlayer: Player; outPlayer: Player }> = [];

      for (const tiredId of tiredIds) {
        const tiredPlayer = roster.find(p => p.id === tiredId)!;
        const tiredPos = tiredPlayer.position;

        // Try to find same position, otherwise top overall
        let replacement = healthyBench.find(p => p.position === tiredPos);
        if (!replacement) {
          healthyBench.sort((a, b) => b.overall - a.overall);
          replacement = healthyBench[0];
        }

        if (replacement) {
          const idx = newFloorIds.indexOf(tiredId);
          if (idx !== -1) {
            newFloorIds[idx] = replacement.id;
            substitutionsMade.push({ inPlayer: replacement, outPlayer: tiredPlayer });

            // Remove replacement from temporary list so he isn't subbed in twice
            const repIdx = healthyBench.findIndex(p => p.id === replacement!.id);
            if (repIdx !== -1) healthyBench.splice(repIdx, 1);
          }
        }
      }

      if (substitutionsMade.length > 0) {
        if (teamSide === "home") setHomeFloorIds(newFloorIds);
        else setAwayFloorIds(newFloorIds);

        let logMsg = "";
        const teamName = teamSide === "home" ? homeTeam.name : awayTeam.name;

        if (substitutionsMade.length === 1) {
          const { inPlayer, outPlayer } = substitutionsMade[0];
          logMsg = `🔄 SUB [${teamName}]: Pasok si ${inPlayer.firstName} ${inPlayer.lastName} para kay ${outPlayer.firstName} ${outPlayer.lastName}.`;
        } else {
          const pairs = substitutionsMade.map(
            sub => `${sub.inPlayer.firstName} ${sub.inPlayer.lastName} for ${sub.outPlayer.firstName} ${sub.outPlayer.lastName}`
          );
          logMsg = `🔄 SUBS [${teamName}]: ${pairs.join(", ")}.`;
        }

        setCommentaryList(prev => [...prev, logMsg]);
      }
    };

    attemptSubstitutions("home", homeFloorIds, homeRoster);
    attemptSubstitutions("away", awayFloorIds, awayRoster);

    // 2. Select offensive player executing the play
    // Weighted by player attributes + tactic adjustments
    const playerWeights = offRoster.map(p => {
      const stats = statsMap[p.id];
      const staminaFactor = stats ? stats.stamina / 100 : 1.0;
      let w = p.overall * 0.4 + p.insideScoring * 0.3 + p.threePoint * 0.3;

      if (isUserOffense) {
        if (activeTactic === "Pound Inside" && (p.position === "C" || p.position === "PF")) {
          w *= 1.35;
        } else if (activeTactic === "Run & Gun" && p.threePoint >= 70) {
          w *= 1.30;
        }
      }

      return Math.max(10, w * staminaFactor);
    });

    const totalWeight = playerWeights.reduce((sum, w) => sum + w, 0);
    let r = Math.random() * totalWeight;
    let shooterIndex = 0;
    for (let i = 0; i < playerWeights.length; i++) {
      r -= playerWeights[i];
      if (r <= 0) {
        shooterIndex = i;
        break;
      }
    }
    const shooter = offRoster[shooterIndex];

    // Select defensive player for contested challenges
    const defender = defRoster[Math.floor(Math.random() * defRoster.length)];

    // 3. Resolve Possession Outcome
    const actionRoll = Math.random() * (prob3PT + prob2PT + probTO);
    let logs: string[] = [];

    // Setup statistical updates payload state
    let statsUpdate: Partial<LiveStat> = {};
    let shooterId = shooter.id;

    if (actionRoll < prob3PT) {
      // 3PT SHOT ATTEMPT
      statsUpdate = { fg3a: 1, fga: 1 };
      const shooterStamina = statsMap[shooterId]?.stamina ?? 100;
      const staminaPenalty = shooterStamina < 60 ? (shooterStamina < 40 ? 0.75 : 0.88) : 1.0;

      // Base accuracy odds
      let makeChance = (shooter.threePoint * 0.36 + 18) / 100;

      // Defenses & tactics
      if (isUserDefense && activeTactic === "Grit & Grind") makeChance -= 0.06;
      if (!isUserOffense && activeTactic === "Run & Gun") makeChance += 0.02; // Easier look

      makeChance *= staminaPenalty;
      const isMake = Math.random() < Math.max(0.12, makeChance);

      if (isMake) {
        // MADE 3PT
        statsUpdate = { fg3a: 1, fga: 1, fg3m: 1, fgm: 1, points: 3 };
        logs.push(generateCommentary("3pm", shooter));

        // Roll for assist
        const assistRoll = Math.random();
        if (assistRoll < 0.55) {
          const assistList = offRoster.filter(p => p.id !== shooterId);
          assistList.sort((a, b) => b.playmaking - a.playmaking);
          const passer = assistList[0];
          logs.push(`🤝 Galing kay ${passer.firstName} ${passer.lastName} ang matalinong pasa para sa assist.`);
          
          setStatsMap(prev => {
            const next = { ...prev };
            if (next[passer.id]) next[passer.id].assists++;
            return next;
          });
        }

        // Apply scores
        if (isHomeOffense) setHomeScore(s => s + 3);
        else setAwayScore(s => s + 3);

        setPossession(isHomeOffense ? "away" : "home");
      } else {
        // MISSED 3PT
        logs.push(generateCommentary("3pa", shooter));

        // Rebounding contest
        const defRebSum = defRoster.reduce((sum, p) => sum + p.rebounding + p.interiorDefense * 0.2, 0);
        const offRebSum = offRoster.reduce((sum, p) => sum + p.rebounding * 0.7, 0);
        const totalRebSum = defRebSum + offRebSum;

        const defRebChance = defRebSum / totalRebSum + 0.15; // 15% defender baseline boost
        const isDefRebound = Math.random() < Math.min(0.90, defRebChance);

        if (isDefRebound) {
          // DEFENSIVE REBOUND
          defRoster.sort((a, b) => b.rebounding - a.rebounding);
          const rebounder = defRoster[0];
          logs.push(generateCommentary("rebound_d", rebounder));
          
          setStatsMap(prev => {
            const next = { ...prev };
            if (next[rebounder.id]) next[rebounder.id].rebounds++;
            return next;
          });

          setPossession(isHomeOffense ? "away" : "home");
        } else {
          // OFFENSIVE REBOUND
          offRoster.sort((a, b) => b.rebounding - a.rebounding);
          const rebounder = offRoster[0];
          logs.push(generateCommentary("rebound_o", rebounder));

          setStatsMap(prev => {
            const next = { ...prev };
            if (next[rebounder.id]) next[rebounder.id].rebounds++;
            return next;
          });

          // Retain possession for offensive rebound
          setPossession(isHomeOffense ? "home" : "away");
        }
      }
    } else if (actionRoll < prob3PT + prob2PT) {
      // 2PT SHOT ATTEMPT
      statsUpdate = { fga: 1 };
      const shooterStamina = statsMap[shooterId]?.stamina ?? 100;
      const staminaPenalty = shooterStamina < 60 ? (shooterStamina < 40 ? 0.75 : 0.88) : 1.0;

      let makeChance = (shooter.insideScoring * 0.44 + 22) / 100;

      // Adjustments
      if (isUserOffense && activeTactic === "Pound Inside") makeChance += 0.05;
      if (isUserDefense && activeTactic === "Grit & Grind") makeChance -= 0.05;
      makeChance *= staminaPenalty;

      // Check block chance first: 8% defense rating based roll
      const blockChance = (defender.interiorDefense * 0.12) / 100;
      const isBlock = Math.random() < Math.max(0.02, blockChance * 0.6);

      if (isBlock) {
        // BLOCKED SHOT
        logs.push(generateCommentary("block", defender));
        setStatsMap(prev => {
          const next = { ...prev };
          if (next[defender.id]) next[defender.id].blocks++;
          return next;
        });

        // Defensive rebound resolved
        defRoster.sort((a, b) => b.rebounding - a.rebounding);
        const rebounder = defRoster[0];
        logs.push(generateCommentary("rebound_d", rebounder));
        setStatsMap(prev => {
          const next = { ...prev };
          if (next[rebounder.id]) next[rebounder.id].rebounds++;
          return next;
        });

        setPossession(isHomeOffense ? "away" : "home");
      } else {
        // Normal 2PT Shoot Resolution
        const isMake = Math.random() < Math.max(0.15, makeChance);

        if (isMake) {
          // MADE 2PT
          statsUpdate = { fga: 1, fgm: 1, points: 2 };
          logs.push(generateCommentary("2pm", shooter));

          // Roll for assist
          const assistRoll = Math.random();
          if (assistRoll < 0.60) {
            const assistList = offRoster.filter(p => p.id !== shooterId);
            assistList.sort((a, b) => b.playmaking - a.playmaking);
            const passer = assistList[0];
            logs.push(`🤝 Magandang pasa ni ${passer.firstName} ${passer.lastName} para sa salaksak.`);
            
            setStatsMap(prev => {
              const next = { ...prev };
              if (next[passer.id]) next[passer.id].assists++;
              return next;
            });
          }

          // Apply scores
          if (isHomeOffense) setHomeScore(s => s + 2);
          else setAwayScore(s => s + 2);

          setPossession(isHomeOffense ? "away" : "home");
        } else {
          // MISSED 2PT
          logs.push(generateCommentary("2pa", shooter));

          // Rebound battle
          const defRebSum = defRoster.reduce((sum, p) => sum + p.rebounding + p.interiorDefense * 0.2, 0);
          const offRebSum = offRoster.reduce((sum, p) => sum + p.rebounding * 0.7, 0);
          const totalRebSum = defRebSum + offRebSum;

          const defRebChance = defRebSum / totalRebSum + 0.15;
          const isDefRebound = Math.random() < Math.min(0.90, defRebChance);

          if (isDefRebound) {
            // DEF REB
            defRoster.sort((a, b) => b.rebounding - a.rebounding);
            const rebounder = defRoster[0];
            logs.push(generateCommentary("rebound_d", rebounder));
            setStatsMap(prev => {
              const next = { ...prev };
              if (next[rebounder.id]) next[rebounder.id].rebounds++;
              return next;
            });
            setPossession(isHomeOffense ? "away" : "home");
          } else {
            // OFF REB
            offRoster.sort((a, b) => b.rebounding - a.rebounding);
            const rebounder = offRoster[0];
            logs.push(generateCommentary("rebound_o", rebounder));
            setStatsMap(prev => {
              const next = { ...prev };
              if (next[rebounder.id]) next[rebounder.id].rebounds++;
              return next;
            });
            setPossession(isHomeOffense ? "home" : "away");
          }
        }
      }
    } else {
      // TURNOVER
      statsUpdate = { turnovers: 1 };

      // Steal check: 45% steal rate based on defenses
      const stealChance = (defender.perimeterDefense * 0.15) / 100;
      const isSteal = Math.random() < Math.max(0.1, stealChance * 1.2);

      if (isSteal) {
        logs.push(generateCommentary("steal", defender));
        setStatsMap(prev => {
          const next = { ...prev };
          if (next[defender.id]) next[defender.id].steals++;
          return next;
        });
      } else {
        logs.push(generateCommentary("to", shooter));
      }

      setPossession(isHomeOffense ? "away" : "home");
    }

    // Apply statistical increments to map state
    setStatsMap(prev => {
      const next = { ...prev };
      if (next[shooterId]) {
        Object.keys(statsUpdate).forEach(k => {
          const key = k as keyof LiveStat;
          (next[shooterId] as any)[key] += (statsUpdate as any)[key];
        });
      }
      return next;
    });

    // 4. Update Game Ticker / Logs Feed
    setCommentaryList(prev => [...prev, ...logs]);

    // 5. Update Time Remaining
    if (nextClock <= 0) {
      // END OF QUARTER
      const nextQ = quarter + 1;
      if (nextQ <= 4) {
        setQuarter(nextQ);
        setClockSeconds(720); // 12 mins
        setCommentaryList(prev => [
          ...prev,
          `🏁 End of Quarter ${quarter}! Score is: ${homeTeam.city} ${homeScore} – ${awayTeam.city} ${awayScore}.`
        ]);
      } else {
        // Tied Check at end of Q4
        if (homeScore === awayScore) {
          setQuarter(nextQ);
          setClockSeconds(300); // 5 mins OT
          setCommentaryList(prev => [
            ...prev,
            `🏁 END OF REGULATION: We are TIED at ${homeScore}! Advancing to Overtime! 🏀`
          ]);
        } else {
          // Game Completed!
          setIsPlaying(false);
          setGameCompleted(true);
          const finalMsg = `🏁 FINAL BUZZER: Game Completed! ${
            homeScore > awayScore ? homeTeam.city : awayTeam.city
          } wins! Final Score: ${homeScore} – ${awayScore}.`;
          setCommentaryList(prev => [...prev, finalMsg]);
        }
      }
    } else {
      setClockSeconds(nextClock);
    }
  }, [
    clockSeconds,
    quarter,
    homeScore,
    awayScore,
    possession,
    gameCompleted,
    homeFloorIds,
    awayFloorIds,
    homeRoster,
    awayRoster,
    homeTeam,
    awayTeam,
    userTeamId,
    statsMap
  ]);

  // Handle Play/Pause timer interval loop
  useEffect(() => {
    if (isPlaying && !gameCompleted) {
      // Instantly calculate if SimSpeed is very high
      if (simSpeed === 999) {
        // Fast-forward loop directly in one render cycle to bypass delays
        setIsPlaying(false);
        let currentHScore = homeScore;
        let currentAScore = awayScore;
        let currentClock = clockSeconds;
        let currentQuarter = quarter;
        let currentPossession = possession;

        // Clone current stats map to mutate directly
        const localStats = { ...statsMap };

        const homeOnCourt = homeRoster.filter(p => homeFloorIds.includes(p.id));
        const awayOnCourt = awayRoster.filter(p => awayFloorIds.includes(p.id));

        while (currentQuarter <= 4 || currentHScore === currentAScore) {
          const isHomeOff = currentPossession === "home";
          const offLineup = isHomeOff ? homeOnCourt : awayOnCourt;
          const defLineup = isHomeOff ? awayOnCourt : homeOnCourt;

          // Select shooter randomly
          const shooter = offLineup[Math.floor(Math.random() * offLineup.length)];
          const defender = defLineup[Math.floor(Math.random() * defLineup.length)];

          // Possessions subtract random clock seconds
          const used = Math.floor(Math.random() * 14) + 10;
          currentClock = Math.max(0, currentClock - used);

          // Record minutes played
          offLineup.forEach(p => {
            if (localStats[p.id]) {
              localStats[p.id].secondsPlayed += used;
              if (localStats[p.id].secondsPlayed >= 60) {
                localStats[p.id].minutes += Math.floor(localStats[p.id].secondsPlayed / 60);
                localStats[p.id].secondsPlayed %= 60;
              }
            }
          });
          defLineup.forEach(p => {
            if (localStats[p.id]) {
              localStats[p.id].secondsPlayed += used;
              if (localStats[p.id].secondsPlayed >= 60) {
                localStats[p.id].minutes += Math.floor(localStats[p.id].secondsPlayed / 60);
                localStats[p.id].secondsPlayed %= 60;
              }
            }
          });

          // Resolve action
          const roll = Math.random();
          if (roll < 0.30) {
            // 3PT shot
            localStats[shooter.id].fg3a++;
            localStats[shooter.id].fga++;
            const accuracy = (shooter.threePoint * 0.35 + 20) / 100;
            if (Math.random() < accuracy) {
              localStats[shooter.id].fg3m++;
              localStats[shooter.id].fgm++;
              localStats[shooter.id].points += 3;
              if (isHomeOff) currentHScore += 3; else currentAScore += 3;
              currentPossession = isHomeOff ? "away" : "home";
            } else {
              // Missed 3PT
              if (Math.random() < 0.70) {
                const reb = defLineup[Math.floor(Math.random() * defLineup.length)];
                localStats[reb.id].rebounds++;
                currentPossession = isHomeOff ? "away" : "home";
              } else {
                const reb = offLineup[Math.floor(Math.random() * offLineup.length)];
                localStats[reb.id].rebounds++;
                currentPossession = isHomeOff ? "home" : "away";
              }
            }
          } else if (roll < 0.85) {
            // 2PT shot
            localStats[shooter.id].fga++;
            const isBlock = Math.random() < 0.05;
            if (isBlock) {
              localStats[defender.id].blocks++;
              const reb = defLineup[Math.floor(Math.random() * defLineup.length)];
              localStats[reb.id].rebounds++;
              currentPossession = isHomeOff ? "away" : "home";
            } else {
              const accuracy = (shooter.insideScoring * 0.44 + 22) / 100;
              if (Math.random() < accuracy) {
                localStats[shooter.id].fgm++;
                localStats[shooter.id].points += 2;
                if (isHomeOff) currentHScore += 2; else currentAScore += 2;
                currentPossession = isHomeOff ? "away" : "home";
              } else {
                if (Math.random() < 0.70) {
                  const reb = defLineup[Math.floor(Math.random() * defLineup.length)];
                  localStats[reb.id].rebounds++;
                  currentPossession = isHomeOff ? "away" : "home";
                } else {
                  const reb = offLineup[Math.floor(Math.random() * offLineup.length)];
                  localStats[reb.id].rebounds++;
                  currentPossession = isHomeOff ? "home" : "away";
                }
              }
            }
          } else {
            // Turnover
            localStats[shooter.id].turnovers++;
            if (Math.random() < 0.50) {
              localStats[defender.id].steals++;
            }
            currentPossession = isHomeOff ? "away" : "home";
          }

          if (currentClock <= 0) {
            currentQuarter++;
            currentClock = currentQuarter <= 4 ? 720 : 300;
          }
        }

        // Set final scores
        setHomeScore(currentHScore);
        setAwayScore(currentAScore);
        setClockSeconds(0);
        setQuarter(currentQuarter - 1);
        setStatsMap(localStats);
        setGameCompleted(true);
        setCommentaryList(prev => [
          ...prev,
          `⚡ INSTANT SIMULATION COMPLETE.`,
          `🏁 FINAL Score: ${homeTeam.city} ${currentHScore} – ${awayTeam.city} ${currentAScore}.`
        ]);
        return;
      }

      // Interval speed mapping: 1x = 1100ms, 2x = 600ms, 5x = 250ms, 10x = 100ms
      const delay = simSpeed === 1 ? 1100 : simSpeed === 2 ? 600 : simSpeed === 5 ? 250 : 100;
      timerRef.current = setInterval(() => {
        simulatePossession();
      }, delay);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, simSpeed, simulatePossession, gameCompleted]);

  // Format time display (e.g. 12:00)
  const formatTime = (secs: number): string => {
    const mins = Math.floor(secs / 60);
    const remainder = secs % 60;
    return `${mins}:${remainder < 10 ? "0" : ""}${remainder}`;
  };

  // Save game results to database and go back to schedule
  const handleFinalizeGame = async () => {
    if (!gameCompleted) return;

    try {
      setSaving(true);
      const playerStatsToInsert = Object.keys(statsMap).map(pId => {
        const s = statsMap[pId];
        return {
          gameId: game.id,
          playerId: pId,
          points: s.points,
          rebounds: s.rebounds,
          assists: s.assists,
          steals: s.steals,
          blocks: s.blocks,
          turnovers: s.turnovers,
          fieldGoalsMade: s.fgm,
          fieldGoalsAttempted: s.fga,
          threePointMade: s.fg3m,
          threePointAttempted: s.fg3a,
          freeThrowsMade: s.ftm,
          freeThrowsAttempted: s.fta,
          minutes: s.minutes,
        };
      });

      const res = await saveLiveGameResultAction(game.id, homeScore, awayScore, playerStatsToInsert);
      if (res.success) {
        if (res.status === "REGULAR_SEASON_COMPLETE") {
          router.push("/dashboard/awards");
        } else {
          router.push("/dashboard/schedule");
        }
        router.refresh();
        await triggerAutosave();
      } else {
        alert(res.error || "Failed to save game stats. Please try again.");
      }
    } catch (err: any) {
      console.error(err);
      alert("Error finalizing game stats.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-36 space-y-4">
        <Loader2 className="w-12 h-12 text-orange-500 animate-spin" />
        <p className="text-zinc-500 text-sm font-semibold tracking-wide">Loading arena setup and team rosters...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20 text-zinc-500 space-y-4">
        <p className="font-semibold text-lg">{error}</p>
        <Link
          href="/dashboard/schedule"
          className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-zinc-900 border border-zinc-800 text-zinc-300 rounded-xl hover:text-white transition-colors text-sm font-bold"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Back to Schedule</span>
        </Link>
      </div>
    );
  }

  const activeRoster = activeTab === "home" ? homeRoster : awayRoster;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
      
      {/* Back to Schedule Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/dashboard/schedule"
          onClick={(e) => {
            if (!gameCompleted && isPlaying) {
              if (!confirm("Are you sure you want to exit? The game will pause and reset if you leave.")) {
                e.preventDefault();
              }
            }
          }}
          className="inline-flex items-center gap-1.5 text-zinc-550 hover:text-zinc-300 font-extrabold text-xs uppercase tracking-wider transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Back to Schedule</span>
        </Link>
        <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest bg-zinc-950 px-3 py-1 border border-zinc-900 rounded-full">
          🏟️ Smart Araneta Coliseum
        </span>
      </div>

      {/* Main Scoreboard HUD */}
      <div className="bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950 border border-zinc-850/80 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(249,115,22,0.02),transparent)] pointer-events-none" />

        {/* Home Team Scoreboard */}
        <div className="flex items-center gap-6 flex-1 justify-end w-full md:w-auto">
          <div className="text-right">
            <span className="text-[10px] font-extrabold bg-zinc-800/40 text-zinc-400 border border-zinc-800 px-2 py-0.5 rounded uppercase tracking-wider">
              {homeTeam.conference} Conference
            </span>
            <h3 className="text-xl md:text-2xl font-black text-white mt-1.5">{homeTeam.city}</h3>
            <p className="text-sm font-bold text-zinc-450">{homeTeam.name}</p>
          </div>
          <div className="w-16 h-16 shrink-0 bg-zinc-950 border border-zinc-850 rounded-2xl overflow-hidden flex items-center justify-center shadow-lg relative">
            {possession === "home" && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-orange-500 rounded-full border-2 border-zinc-950 animate-ping" />
            )}
            <PlayerAvatar
              playerId={homeRoster[0]?.id || "home"}
              firstName={homeTeam.city}
              lastName={homeTeam.name}
              position="TM"
              teamName={homeTeam.name}
              teamConference={homeTeam.conference}
            />
          </div>
        </div>

        {/* Central Display: Clock & Scores */}
        <div className="text-center min-w-[240px] px-6 py-3 bg-zinc-950/60 border border-zinc-850/60 rounded-3xl flex flex-col items-center justify-center relative">
          <span className="text-[10px] font-black text-orange-500 uppercase tracking-widest block mb-1">
            {quarter > 4 ? `Overtime ${quarter - 4}` : `Quarter ${quarter}`}
          </span>
          
          <div className="flex items-center gap-5 justify-center mb-1">
            <span className="text-4xl md:text-5xl font-black tracking-tighter text-white">
              {homeScore}
            </span>
            <span className="text-zinc-650 text-xl font-bold font-mono">
              {formatTime(clockSeconds)}
            </span>
            <span className="text-4xl md:text-5xl font-black tracking-tighter text-white">
              {awayScore}
            </span>
          </div>

          <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">
            Possession: {possession === "home" ? homeTeam.name : awayTeam.name}
          </span>
        </div>

        {/* Away Team Scoreboard */}
        <div className="flex items-center gap-6 flex-1 justify-start w-full md:w-auto">
          <div className="w-16 h-16 shrink-0 bg-zinc-950 border border-zinc-850 rounded-2xl overflow-hidden flex items-center justify-center shadow-lg relative">
            {possession === "away" && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-orange-500 rounded-full border-2 border-zinc-950 animate-ping" />
            )}
            <PlayerAvatar
              playerId={awayRoster[0]?.id || "away"}
              firstName={awayTeam.city}
              lastName={awayTeam.name}
              position="TM"
              teamName={awayTeam.name}
              teamConference={awayTeam.conference}
            />
          </div>
          <div>
            <span className="text-[10px] font-extrabold bg-zinc-800/40 text-zinc-400 border border-zinc-800 px-2 py-0.5 rounded uppercase tracking-wider">
              {awayTeam.conference} Conference
            </span>
            <h3 className="text-xl md:text-2xl font-black text-white mt-1.5">{awayTeam.city}</h3>
            <p className="text-sm font-bold text-zinc-455">{awayTeam.name}</p>
          </div>
        </div>

      </div>

      {/* Speed Controls & Action Center */}
      <div className="bg-zinc-900/40 border border-zinc-900 rounded-3xl p-4 md:p-6 shadow-xl flex flex-wrap items-center justify-between gap-4">
        {/* Play/Pause Buttons */}
        <div className="flex items-center gap-3">
          {isPlaying ? (
            <button
              onClick={() => setIsPlaying(false)}
              disabled={gameCompleted}
              className="px-5 py-2.5 bg-zinc-800 hover:bg-zinc-750 text-white rounded-xl border border-zinc-700 font-bold text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
            >
              <Pause className="w-4 h-4 fill-white" />
              <span>Pause Game</span>
            </button>
          ) : (
            <button
              onClick={() => setIsPlaying(true)}
              disabled={gameCompleted}
              className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-[0_3px_10px_rgba(249,115,22,0.25)] cursor-pointer disabled:opacity-40"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>Start Simulation</span>
            </button>
          )}
          
          {gameCompleted && (
            <button
              onClick={handleFinalizeGame}
              disabled={saving}
              className="px-6 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-extrabold text-xs shadow-[0_3px_12px_rgba(16,185,129,0.3)] flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Award className="w-4 h-4" />}
              <span>Finalize stats & Exit</span>
            </button>
          )}
        </div>

        {/* Speed Toggles */}
        <div className="flex items-center gap-2 bg-zinc-950 p-1 rounded-xl border border-zinc-850 self-start sm:self-auto">
          {[
            { label: "1x Speed", speed: 1 },
            { label: "2x", speed: 2 },
            { label: "5x", speed: 5 },
            { label: "10x", speed: 10 },
            { label: "Instant Sim ⚡", speed: 999 },
          ].map(s => (
            <button
              key={s.speed}
              onClick={() => setSimSpeed(s.speed)}
              disabled={gameCompleted}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer disabled:opacity-45 ${
                simSpeed === s.speed
                  ? "bg-zinc-900 text-white shadow-sm border border-zinc-800"
                  : "text-zinc-550 hover:text-zinc-350"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Core Layout: Commentary Log & Tactical Focus */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Ticker Log Column (8 cols) */}
        <div className="lg:col-span-8 flex flex-col space-y-4">
          <div className="bg-zinc-950/40 border border-zinc-900 rounded-3xl p-6 shadow-xl flex-1 flex flex-col min-h-[420px] max-h-[500px]">
            <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4 border-b border-zinc-900 pb-2">
              🎙️ Play-by-Play Live Ticker Feed
            </h4>
            
            <div ref={scrollContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto space-y-3.5 pr-2 custom-scrollbar">
              {commentaryList.map((log, i) => {
                const isSpecial = log.startsWith("🎯") || log.startsWith("🏀") || log.startsWith("💥") || log.startsWith("⚡");
                return (
                  <div
                    key={i}
                    className={`text-xs md:text-sm font-semibold leading-relaxed p-2.5 rounded-xl border transition-all ${
                      isSpecial
                        ? "bg-orange-500/5 border-orange-500/15 text-orange-400 font-extrabold shadow-sm"
                        : "bg-zinc-900/10 border-zinc-950 text-zinc-350"
                    }`}
                  >
                    {log}
                  </div>
                );
              })}
              <div ref={commentaryEndRef} />
            </div>
          </div>
        </div>

        {/* Right Tactical Coaching Sidebar (4 cols) */}
        <div className="lg:col-span-4 flex flex-col space-y-6">
          <div className="bg-zinc-900/30 border border-zinc-900 rounded-3xl p-6 shadow-xl space-y-5">
            <div className="border-b border-zinc-900 pb-3 flex items-center gap-2">
              <Zap className="w-5 h-5 text-orange-500" />
              <h4 className="text-xs font-extrabold text-white uppercase tracking-widest">
                Tactical Coaching Adjustments
              </h4>
            </div>

            <p className="text-zinc-550 text-xs font-medium">
              Swap your franchise coaching adjustments on-the-fly. Adjusting tactics alters play call rates and attribute coefficients mid-simulation.
            </p>

            <div className="flex flex-col gap-3">
              {[
                {
                  id: "Balanced",
                  label: "Balanced System",
                  desc: "Standard distributions. No bonuses or penalties applied.",
                },
                {
                  id: "Run & Gun",
                  label: "Run & Gun",
                  desc: "+25% 3PT shot frequency, faster play, but +10% turnover risk.",
                },
                {
                  id: "Grit & Grind",
                  label: "Grit & Grind",
                  desc: "+5 Perimeter/Interior Defense, slower pace, but +15% foul risk.",
                },
                {
                  id: "Pound Inside",
                  label: "Pound Inside",
                  desc: "+15% inside scoring frequency, +5 rebounding. Feeds centers.",
                },
                {
                  id: "Full Court Press",
                  label: "Full Court Press",
                  desc: "+10% steal chance, speeds opponent fatigue, +20% foul risk.",
                },
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setUserTactic(t.id as Tactic)}
                  disabled={gameCompleted}
                  className={`w-full text-left p-4 rounded-2xl border text-xs transition-all cursor-pointer disabled:opacity-40 hover:scale-[1.01] ${
                    userTactic === t.id
                      ? "bg-orange-500/10 border-orange-500/40 text-white shadow-md shadow-orange-500/5"
                      : "bg-zinc-950/40 border-zinc-900 text-zinc-400 hover:border-zinc-800"
                  }`}
                >
                  <span className="font-extrabold text-sm block mb-1">{t.label}</span>
                  <span className="text-[10px] text-zinc-550 block font-medium leading-relaxed">{t.desc}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

      </div>

      {/* Live Box Score Roster Panels */}
      <div className="bg-zinc-900/30 border border-zinc-900 rounded-3xl p-6 shadow-2xl space-y-6">
        
        {/* Tab Selection headers */}
        <div className="flex items-center justify-between border-b border-zinc-900 pb-4 flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <Activity className="w-5 h-5 text-orange-500" />
            <h4 className="text-base font-bold text-white">Live Box Score Sheet</h4>
          </div>
          
          <div className="flex bg-zinc-950 p-1 rounded-xl border border-zinc-850">
            <button
              onClick={() => setActiveTab("home")}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold tracking-wide transition-all cursor-pointer ${
                activeTab === "home"
                  ? "bg-zinc-900 text-white shadow"
                  : "text-zinc-550 hover:text-zinc-350"
              }`}
            >
              {homeTeam?.city} Roster
            </button>
            <button
              onClick={() => setActiveTab("away")}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold tracking-wide transition-all cursor-pointer ${
                activeTab === "away"
                  ? "bg-zinc-900 text-white shadow"
                  : "text-zinc-550 hover:text-zinc-350"
              }`}
            >
              {awayTeam?.city} Roster
            </button>
          </div>
        </div>

        {/* Box Score Stats Table */}
        <div className="w-full overflow-x-auto rounded-xl border border-zinc-900/60">
          <table className="w-full min-w-[800px] text-left border-collapse">
            <thead>
              <tr className="bg-zinc-950 border-b border-zinc-900 text-zinc-550 font-extrabold text-[10px] uppercase tracking-wider">
                <th className="py-3 px-4 w-1/4">Player</th>
                <th className="py-3 px-3 text-center">Pos</th>
                <th className="py-3 px-3 text-center">Min</th>
                <th className="py-3 px-3 text-center">Pts</th>
                <th className="py-3 px-3 text-center">Reb</th>
                <th className="py-3 px-3 text-center">Ast</th>
                <th className="py-3 px-3 text-center">Stl</th>
                <th className="py-3 px-3 text-center">Blk</th>
                <th className="py-3 px-3 text-center">Tov</th>
                <th className="py-3 px-3 text-center">FG</th>
                <th className="py-3 px-3 text-center">3PT</th>
                <th className="py-3 px-3 text-center">FT</th>
                <th className="py-3 px-4 text-center">Stamina</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900/50 bg-zinc-950/10">
              {activeRoster.map(player => {
                const s = statsMap[player.id] || {
                  points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0, turnovers: 0,
                  fgm: 0, fga: 0, fg3m: 0, fg3a: 0, ftm: 0, fta: 0, minutes: 0, stamina: 100
                };
                const fgPct = s.fga > 0 ? Math.round((s.fgm / s.fga) * 100) : 0;
                const fg3Pct = s.fg3a > 0 ? Math.round((s.fg3m / s.fg3a) * 100) : 0;
                const ftPct = s.fta > 0 ? Math.round((s.ftm / s.fta) * 100) : 0;

                const isFloor = activeTab === "home" ? homeFloorIds.includes(player.id) : awayFloorIds.includes(player.id);

                return (
                  <tr
                    key={player.id}
                    className={`hover:bg-zinc-900/20 transition-colors ${
                      isFloor ? "bg-orange-500/5 border-l-2 border-l-orange-500" : ""
                    }`}
                  >
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 bg-zinc-950 border border-zinc-850">
                          <PlayerAvatar
                            playerId={player.id}
                            firstName={player.firstName}
                            lastName={player.lastName}
                            position={player.position}
                            teamName={activeTab === "home" ? homeTeam.name : awayTeam.name}
                            teamConference={activeTab === "home" ? homeTeam.conference : awayTeam.conference}
                          />
                        </div>
                        <div>
                          <span className="font-extrabold text-sm text-zinc-200 block">
                            {player.firstName} {player.lastName}
                          </span>
                          {isFloor && (
                            <span className="text-[8px] font-black uppercase text-orange-500 tracking-wider">
                              On floor
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-3 text-center text-xs font-bold text-zinc-400">
                      {player.position}
                    </td>
                    <td className="py-3.5 px-3 text-center text-xs font-bold text-zinc-300">
                      {s.minutes}
                    </td>
                    <td className="py-3.5 px-3 text-center text-xs font-black text-orange-400">
                      {s.points}
                    </td>
                    <td className="py-3.5 px-3 text-center text-xs font-bold text-zinc-300">
                      {s.rebounds}
                    </td>
                    <td className="py-3.5 px-3 text-center text-xs font-bold text-zinc-300">
                      {s.assists}
                    </td>
                    <td className="py-3.5 px-3 text-center text-xs font-semibold text-zinc-400">
                      {s.steals}
                    </td>
                    <td className="py-3.5 px-3 text-center text-xs font-semibold text-zinc-400">
                      {s.blocks}
                    </td>
                    <td className="py-3.5 px-3 text-center text-xs text-zinc-500">
                      {s.turnovers}
                    </td>
                    <td className="py-3.5 px-3 text-center text-xs text-zinc-400 font-mono">
                      {s.fgm}/{s.fga} ({fgPct}%)
                    </td>
                    <td className="py-3.5 px-3 text-center text-xs text-zinc-400 font-mono">
                      {s.fg3m}/{s.fg3a} ({fg3Pct}%)
                    </td>
                    <td className="py-3.5 px-3 text-center text-xs text-zinc-400 font-mono">
                      {s.ftm}/{s.fta} ({ftPct}%)
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex flex-col items-center gap-1 min-w-[70px]">
                        <span className="text-[10px] font-bold text-zinc-300">{Math.round(s.stamina)}%</span>
                        <div className="w-16 bg-zinc-900 h-1 rounded-full overflow-hidden border border-zinc-950">
                          <div
                            className={`h-full rounded-full ${
                              s.stamina > 80
                                ? "bg-green-500"
                                : s.stamina > 60
                                ? "bg-yellow-500"
                                : "bg-red-500 animate-pulse"
                            }`}
                            style={{ width: `${s.stamina}%` }}
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

      </div>

    </div>
  );
}
