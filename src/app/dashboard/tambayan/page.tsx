"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useGameStore } from "@/store/useGameStore";
import { getTransactionsAction, getLeagueHistoryContextAction } from "@/app/actions/transactions";
import {
  MessageCircle,
  Share2,
  Heart,
  Repeat,
  TrendingUp,
  Send,
  Loader2,
  Activity,
  Sparkles,
  Award,
  Users,
  Search,
  MessageSquare,
  ThumbsUp,
  UserPlus
} from "lucide-react";
import PlayerAvatar from "@/components/PlayerAvatar";

interface Transaction {
  id: string;
  type: "Trade" | "Signing" | "Release" | "Injury" | "Draft";
  description: string;
  seasonYear: number;
  gameDay: number;
  createdAt: string | Date;
}

interface TambayanPost {
  id: string;
  authorName: string;
  authorHandle: string;
  authorRole: "FN" | "RP" | "GM" | "PL"; // Fan, Reporter, GM, Player
  avatarSeed: string;
  avatarProps: {
    playerId: string;
    firstName: string;
    lastName: string;
    position: string;
    teamName?: string | null;
    teamConference?: string | null;
  };
  content: string;
  timestamp: string;
  likes: number;
  retweets: number;
  repliesCount: number;
  hasLiked?: boolean;
  hasRetweeted?: boolean;
  category: "news" | "chatter" | "banter";
  hashtags: string[];
}

const FAN_NAMES = [
  { name: "Tito Boy", handle: "@tito_boy_77", role: "FN" as const },
  { name: "Kuya Jayson", handle: "@kuya_jayson_smc", role: "FN" as const },
  { name: "Kababayan Pride", handle: "@kababayan_hoops", role: "FN" as const },
  { name: "Ginebra Ako NSD", handle: "@ginebra_ako_nsd", role: "FN" as const },
  { name: "Liga Tambay", handle: "@liga_tambay_ph", role: "FN" as const },
  { name: "Ka-Basket", handle: "@ka_basket_23", role: "FN" as const },
  { name: "Magnolia Faithful", handle: "@magnolia_faith", role: "FN" as const },
  { name: "Hoops Hater", handle: "@hoops_hater_clown", role: "FN" as const },
  { name: "Analyst Pinoy", handle: "@analyst_pinoy", role: "FN" as const },
  { name: "Tita Baby", handle: "@tita_baby_chismis", role: "FN" as const },
];

const REPORTER_NAMES = [
  { name: "Chika Sports PH", handle: "@chika_sports", role: "RP" as const },
  { name: "Spin.ph Insider", handle: "@spin_insider", role: "RP" as const },
  { name: "Liga Updates Online", handle: "@liga_updates", role: "RP" as const },
  { name: "Homer Senator", handle: "@homer_reporter", role: "RP" as const },
];

const BOT_REPLIES = [
  "Luh, anong pinagsasabi mo lods? Di ako agree diyan 🤡",
  "TAMA KA DIYAN! Sobrang spot on nito. Kampeon na uli! 🏆",
  "Bardagulan na naman sa replies. Makikain muna ng lechon 🐖🍿",
  "Liga updates talaga ang pinaka-masayang tambayan. #Bardagulan",
  "GM gising!!! Kailangan natin ng boodle fight para sa chemistry!",
  "Sana all ganyan mag-isip. Bawas-bawasan ang kape kaibigan haha",
  "Wait, let him cook! may point siya ah 👀🔥",
  "Luto ang tawag niyan sa susunod na game panigurado! #Luto",
];

export default function TambayanPage() {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [posts, setPosts] = useState<TambayanPost[]>([]);
  const [activeTab, setActiveTab] = useState<"all" | "news" | "chatter" | "banter">("all");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // DB data references
  const [teamsList, setTeamsList] = useState<any[]>([]);
  const [playersList, setPlayersList] = useState<any[]>([]);

  // User team context
  const { userTeamId } = useGameStore();
  const [userTeam, setUserTeam] = useState<any>(null);

  // User post builder state
  const [postTone, setPostTone] = useState<string>("Boast");
  const [customPostContent, setCustomPostContent] = useState("");
  const [isPosting, setIsPosting] = useState(false);

  // Poll state
  const [pollVoted, setPollVoted] = useState(false);
  const [pollVotes, setPollVotes] = useState({ SMC: 42, Ginebra: 38, Magnolia: 20 });
  const [pollTitle, setPollTitle] = useState("Sino ang magwawagi sa Manila Clasico ngayong season?");

  useEffect(() => {
    setMounted(true);
  }, []);

  // Hash function for random number generation
  const hash = (str: string, max: number = 100) => {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = str.charCodeAt(i) + ((h << 5) - h);
    }
    return Math.abs(h) % max;
  };

  // Helper to construct deterministic fan posts for transactions
  const generateProceduralPosts = useCallback((
    txs: Transaction[],
    teams: any[],
    players: any[]
  ): TambayanPost[] => {
    const generated: TambayanPost[] = [];

    txs.forEach((tx) => {
      const isBlockbuster = tx.description.startsWith("BLOCKBUSTER:");
      const cleanDesc = tx.description.replace(/^BLOCKBUSTER:\s*/, "");

      // Match teams and players involved
      const involvedTeams = teams.filter(t => cleanDesc.includes(`${t.city} ${t.name}`));
      const involvedPlayers = players.filter(p => cleanDesc.includes(`${p.firstName} ${p.lastName}`));

      const primaryTeam = involvedTeams[0] || { city: "FBM", name: "League", conference: "Luzon" };
      const secondaryTeam = involvedTeams[1] || null;
      const primaryPlayer = involvedPlayers[0] || { firstName: "Coach", lastName: "Tito", position: "FN" };

      const txDateStr = `S${tx.seasonYear} • Day ${tx.gameDay}`;

      // 1. Generate Reporter Post
      const repSeed = tx.id + "-rep";
      const repInfo = REPORTER_NAMES[hash(repSeed, REPORTER_NAMES.length)];
      generated.push({
        id: tx.id + "-reporter",
        authorName: repInfo.name,
        authorHandle: repInfo.handle,
        authorRole: "RP",
        avatarSeed: repSeed,
        avatarProps: {
          playerId: repSeed,
          firstName: repInfo.name.split(" ")[0],
          lastName: repInfo.name.split(" ")[1] || "Insider",
          position: "RP",
          teamName: primaryTeam.name,
          teamConference: primaryTeam.conference
        },
        content: `🚨 **OFFICIAL NEWS**: ${tx.description}\n\nWhat are your thoughts on this move? #LigaLive`,
        timestamp: txDateStr,
        likes: hash(repSeed + "l", 250) + 120,
        retweets: hash(repSeed + "rt", 80) + 20,
        repliesCount: hash(repSeed + "rp", 40) + 5,
        category: "news",
        hashtags: ["#LigaLive", isBlockbuster ? "#Blockbuster" : ""].filter(Boolean)
      });

      // 2. Generate Fan Reaction Post (Banter or Chatter)
      const fanSeed = tx.id + "-fan";
      const fanInfo = FAN_NAMES[hash(fanSeed, FAN_NAMES.length)];
      
      let fanText = "";
      let category: "chatter" | "banter" = "chatter";
      let hashtags: string[] = [];

      if (tx.type === "Trade") {
        category = "banter";
        hashtags = ["#TradeAlert", "#Bardagulan"];
        const rand = hash(fanSeed + "t", 3);
        if (rand === 0) {
          fanText = `Lugi naman ang ${primaryTeam.city} dito! Anyare sa GM natin, pabili ng lechon lang ba inatupag? 😂🤦‍♂️`;
        } else if (rand === 1) {
          fanText = `Wow! Blockbuster trade is real! Welcome to ${secondaryTeam ? secondaryTeam.city : "our team"} ${primaryPlayer.firstName}! Siguradong solid ang chemistry! 🏆🔥`;
        } else {
          fanText = `Sana all marunong makipag-negosasyon. Iba talaga ang SMC-Ginebra connections, may hatak! 😂 #Luto`;
          hashtags.push("#Luto");
        }
      } else if (tx.type === "Signing") {
        category = "chatter";
        hashtags = ["#FreeAgency", "#Welcome"];
        const rand = hash(fanSeed + "s", 2);
        if (rand === 0) {
          fanText = `Solid na pirmahan to para sa ${primaryTeam.city} ${primaryTeam.name}! Malaking tulong si ${primaryPlayer.firstName} ${primaryPlayer.lastName} sa paint! 💪🇵🇭`;
        } else {
          fanText = `₱${hash(fanSeed, 10) + 3}M contract raw? Grabe, sana all ganyan kalaki ang budget! Pampakain din ng boodle fight yan! 🍚🍖`;
        }
      } else if (tx.type === "Release") {
        category = "banter";
        hashtags = ["#Waivers", "#Sayang"];
        fanText = `Bakit pinakawalan si ${primaryPlayer.firstName} ${primaryPlayer.lastName}? Sayang naman, may asim pa si kuya eh! Baka pwede kunin ng Ginebra. #NSD`;
        hashtags.push("#NSD");
      } else if (tx.type === "Injury") {
        category = "chatter";
        hashtags = ["#InjuryUpdate", "#GetWellSoon"];
        fanText = `Naku po! Injured si ${primaryPlayer.firstName} ${primaryPlayer.lastName}. Malaking bawas to sa rotations ng ${primaryTeam.city}. Pagsubok sa buong prangkisa. Get well soon! 🙏`;
      } else if (tx.type === "Draft") {
        category = "chatter";
        hashtags = ["#LigaDraft", "#Future"];
        fanText = `Sana all nakakuha ng star rookie! Handang mag-pakitang gilas si ${primaryPlayer.firstName} para sa barangay! Welcome, kid! 🇵🇭🌟`;
      }

      generated.push({
        id: tx.id + "-fan-reaction",
        authorName: fanInfo.name,
        authorHandle: fanInfo.handle,
        authorRole: "FN",
        avatarSeed: fanSeed,
        avatarProps: {
          playerId: fanSeed,
          firstName: fanInfo.name.split(" ")[0],
          lastName: fanInfo.name.split(" ")[1] || "Fan",
          position: "FN",
          teamName: primaryTeam.name,
          teamConference: primaryTeam.conference
        },
        content: fanText,
        timestamp: txDateStr,
        likes: hash(fanSeed + "l", 120) + 15,
        retweets: hash(fanSeed + "rt", 35) + 3,
        repliesCount: hash(fanSeed + "rp", 18) + 1,
        category,
        hashtags
      });

      // 3. Player Reaction (if blockbuster or signature player)
      if (tx.type === "Trade" || tx.type === "Signing") {
        const plSeed = tx.id + "-player-tweet";
        const isPlUserTeam = primaryTeam.id === userTeamId || (secondaryTeam && secondaryTeam.id === userTeamId);

        generated.push({
          id: tx.id + "-player-tweet",
          authorName: `${primaryPlayer.firstName} ${primaryPlayer.lastName}`,
          authorHandle: `@${primaryPlayer.firstName.toLowerCase()}_${primaryPlayer.lastName.toLowerCase()}`,
          authorRole: "PL",
          avatarSeed: primaryPlayer.id,
          avatarProps: {
            playerId: primaryPlayer.id,
            firstName: primaryPlayer.firstName,
            lastName: primaryPlayer.lastName,
            position: primaryPlayer.position,
            teamName: primaryTeam.name,
            teamConference: primaryTeam.conference
          },
          content: tx.type === "Trade"
            ? `Exited for this next chapter. Salamat sa suporta sa dating team! Kahit saan mapunta, handang lumaban para sa ${primaryTeam.city} ${primaryTeam.name}! 💪🇵🇭`
            : `Salamat sa tiwala ng management ng ${primaryTeam.city} ${primaryTeam.name}. Simulan na natin ang trabaho para sa pangarap na kampeonato! 🏆 #NewHome`,
          timestamp: txDateStr,
          likes: hash(plSeed + "l", 500) + 250,
          retweets: hash(plSeed + "rt", 150) + 40,
          repliesCount: hash(plSeed + "rp", 80) + 10,
          category: "chatter",
          hashtags: tx.type === "Trade" ? ["#NewChapter"] : ["#NewHome", "#SalamatTiwala"]
        });
      }
    });

    // Add 4-5 static funny/ambient social posts to fill the tambayan
    const defaultDate = "Season Active • Day Current";
    
    // Boodle fight post
    generated.push({
      id: "boodle-fight-feed",
      authorName: "Kuya Jayson",
      authorHandle: "@kuya_jayson_smc",
      authorRole: "FN",
      avatarSeed: "boodle",
      avatarProps: {
        playerId: "boodle",
        firstName: "Jayson",
        lastName: "Kuya",
        position: "FN",
        teamName: "Supremos"
      },
      content: `Boodle fight night kasama ang buong koponan! 🐖 Rice is life, lechon is support! Dito nagsisimula ang solid team chemistry! Sa susunod na game, tapos ang kalaban! #BoodleFight #LechonDay`,
      timestamp: defaultDate,
      likes: 342,
      retweets: 54,
      repliesCount: 22,
      category: "chatter",
      hashtags: ["#BoodleFight", "#LechonDay"]
    });

    // Referee luto post
    generated.push({
      id: "referee-luto-feed",
      authorName: "Hoops Hater",
      authorHandle: "@hoops_hater_clown",
      authorRole: "FN",
      avatarSeed: "hater",
      avatarProps: {
        playerId: "hater",
        firstName: "Hater",
        lastName: "Hoops",
        position: "FN"
      },
      content: `Pangit na naman ng tawag kagabi sa Manila Clasico! Masyadong pinaboran ang SMC team! Halatang may luto! Liga management kailan niyo paparusahan ang bulag na ref? 🦓🦓 #Luto #LigaLive`,
      timestamp: defaultDate,
      likes: 128,
      retweets: 92,
      repliesCount: 68,
      category: "banter",
      hashtags: ["#Luto", "#LigaLive"]
    });

    // MVP race
    if (players.length > 5) {
      const mvpSeed = "mvp-chatter";
      const topPl1 = players[0];
      const topPl2 = players[1];
      generated.push({
        id: "mvp-race-feed",
        authorName: "Analyst Pinoy",
        authorHandle: "@analyst_pinoy",
        authorRole: "FN",
        avatarSeed: mvpSeed,
        avatarProps: {
          playerId: mvpSeed,
          firstName: "Pinoy",
          lastName: "Analyst",
          position: "FN"
        },
        content: `Sino ang MVP niyo ngayong season? Si ${topPl1.firstName} ${topPl1.lastName} ba na may dominant rebounds, o si ${topPl2.firstName} ${topPl2.lastName} na puro clutch three-pointers? Para sakin parehong deserving pero lamang sa chemistry si ${topPl1.firstName}! 🏆`,
        timestamp: defaultDate,
        likes: 210,
        retweets: 18,
        repliesCount: 45,
        category: "chatter",
        hashtags: ["#MVP", "#LigaTalk"]
      });
    }

    // Sort generated posts so reporters/news are mixed but generally transactions flow cleanly
    return generated;
  }, [userTeamId]);

  const loadTambayanData = async (showRefresh = false) => {
    try {
      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      // Fetch transactions & contexts
      const txRes = await getTransactionsAction();
      const contextRes = await getLeagueHistoryContextAction();

      if (contextRes.success) {
        setTeamsList(contextRes.teams || []);
        setPlayersList(contextRes.players || []);

        // Find user team if available
        if (userTeamId && contextRes.teams) {
          const uT = contextRes.teams.find((t: any) => t.id === userTeamId);
          if (uT) setUserTeam(uT);
        }

        // Build feed
        const txList = (txRes as unknown as Transaction[]) || [];
        const builtPosts = generateProceduralPosts(txList, contextRes.teams || [], contextRes.players || []);
        setPosts(builtPosts);
      }
    } catch (err) {
      console.error("Failed to load tambayan social chatter:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (mounted) {
      loadTambayanData();
    }
  }, [mounted]);

  // Click interaction: Likes
  const handleLike = (postId: string) => {
    setPosts(prev =>
      prev.map(p => {
        if (p.id === postId) {
          const nextLiked = !p.hasLiked;
          return {
            ...p,
            hasLiked: nextLiked,
            likes: nextLiked ? p.likes + 1 : p.likes - 1
          };
        }
        return p;
      })
    );
  };

  // Click interaction: Retweet
  const handleRetweet = (postId: string) => {
    setPosts(prev =>
      prev.map(p => {
        if (p.id === postId) {
          const nextRt = !p.hasRetweeted;
          return {
            ...p,
            hasRetweeted: nextRt,
            retweets: nextRt ? p.retweets + 1 : p.retweets - 1
          };
        }
        return p;
      })
    );
  };

  // Submit User Post
  const handleUserPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customPostContent.trim()) return;

    setIsPosting(true);

    // Create custom user post
    const newId = "user-post-" + Date.now();
    const tCity = userTeam?.city || "User";
    const tName = userTeam?.name || "Franchise";
    const postText = customPostContent;

    const userPost: TambayanPost = {
      id: newId,
      authorName: `${tCity} ${tName} Front Office (You)`,
      authorHandle: `@${tName.toLowerCase()}_gm`,
      authorRole: "GM",
      avatarSeed: userTeamId || "user-gm",
      avatarProps: {
        playerId: userTeamId || "user-gm",
        firstName: tCity,
        lastName: "GM",
        position: "GM",
        teamName: tName,
        teamConference: userTeam?.conference || "Luzon"
      },
      content: postText,
      timestamp: "Just now",
      likes: 1,
      retweets: 0,
      repliesCount: 0,
      hasLiked: true,
      category: postTone === "Banter" ? "banter" : "chatter",
      hashtags: postTone === "Banter" ? ["#GM_Banter"] : ["#GM_Update", "#FBM"]
    };

    // Prepend to posts list
    setPosts(prev => [userPost, ...prev]);
    setCustomPostContent("");
    setIsPosting(false);

    // Trigger funny fan replies after a short delay (1.5 seconds)
    setTimeout(() => {
      const replySeed1 = newId + "-rep1";
      const replySeed2 = newId + "-rep2";
      
      const bot1 = FAN_NAMES[hash(replySeed1, FAN_NAMES.length)];
      const bot2 = FAN_NAMES[hash(replySeed2, FAN_NAMES.length)];

      const text1 = BOT_REPLIES[hash(replySeed1, BOT_REPLIES.length)];
      const text2 = BOT_REPLIES[hash(replySeed2, BOT_REPLIES.length)];

      const r1: TambayanPost = {
        id: replySeed1,
        authorName: bot1.name,
        authorHandle: bot1.handle,
        authorRole: "FN",
        avatarSeed: replySeed1,
        avatarProps: {
          playerId: replySeed1,
          firstName: bot1.name.split(" ")[0],
          lastName: bot1.name.split(" ")[1] || "Fan",
          position: "FN"
        },
        content: `Replying to ${userPost.authorHandle}: ${text1}`,
        timestamp: "1s ago",
        likes: hash(replySeed1, 30),
        retweets: 0,
        repliesCount: 0,
        category: "chatter",
        hashtags: []
      };

      const r2: TambayanPost = {
        id: replySeed2,
        authorName: bot2.name,
        authorHandle: bot2.handle,
        authorRole: "FN",
        avatarSeed: replySeed2,
        avatarProps: {
          playerId: replySeed2,
          firstName: bot2.name.split(" ")[0],
          lastName: bot2.name.split(" ")[1] || "Fan",
          position: "FN"
        },
        content: `Replying to ${userPost.authorHandle}: ${text2}`,
        timestamp: "1s ago",
        likes: hash(replySeed2, 20),
        retweets: 0,
        repliesCount: 0,
        category: "chatter",
        hashtags: []
      };

      setPosts(prev => {
        // Find user post index to place replies right after it
        const idx = prev.findIndex(p => p.id === newId);
        if (idx !== -1) {
          const next = [...prev];
          next.splice(idx + 1, 0, r1, r2);
          return next;
        }
        return [r1, r2, ...prev];
      });
    }, 1500);
  };

  // Select post template helper
  const applyTemplate = (tone: string) => {
    setPostTone(tone);
    const tCity = userTeam?.city || "Ating Team";
    const tName = userTeam?.name || "Koponan";

    if (tone === "Boast") {
      setCustomPostContent(`Sobrang ganda ng chemistry at laro ng ${tCity} ${tName} kamakailan! Sino ba susunod na kakalabanin? Ihanda na ang boodle fight! 🍛🐖🔥`);
    } else if (tone === "Banter") {
      setCustomPostContent(`Wala talagang binatbat ang SMC at San Miguel sa depensa namin. Practice game lang ba yun? 😂 #Bardagulan #Chismis`);
    } else if (tone === "Complain") {
      setCustomPostContent(`Kailangan natin mag-training focus sa shooting at floor spacing! Masyadong maluwag ang perimeter defense! GM Mode is active, adjustments incoming! 📐🏀`);
    }
  };

  // Handle Poll Vote
  const handlePollVote = (option: "SMC" | "Ginebra" | "Magnolia") => {
    if (pollVoted) return;

    setPollVotes(prev => {
      const next = { ...prev };
      next[option] = next[option] + 1;
      return next;
    });
    setPollVoted(true);
  };

  if (!mounted || loading) {
    return (
      <div className="flex flex-col items-center justify-center py-36 space-y-4">
        <Loader2 className="w-12 h-12 text-orange-500 animate-spin" />
        <p className="text-zinc-500 text-sm font-semibold tracking-wide">Connecting to HoopsPH Tambayan servers...</p>
      </div>
    );
  }

  // Filter posts
  const filteredPosts = posts.filter(post => {
    // 1. Tag Filter
    if (selectedTag && !post.hashtags.includes(selectedTag)) {
      return false;
    }
    // 2. Tab Filter
    if (activeTab !== "all" && post.category !== activeTab) {
      return false;
    }
    // 3. Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const inAuthor = post.authorName.toLowerCase().includes(q) || post.authorHandle.toLowerCase().includes(q);
      const inContent = post.content.toLowerCase().includes(q);
      if (!inAuthor && !inContent) return false;
    }
    return true;
  });

  const totalPollVotes = pollVotes.SMC + pollVotes.Ginebra + pollVotes.Magnolia;
  const smcPct = Math.round((pollVotes.SMC / totalPollVotes) * 100);
  const ginebraPct = Math.round((pollVotes.Ginebra / totalPollVotes) * 100);
  const magnoliaPct = Math.round((pollVotes.Magnolia / totalPollVotes) * 100);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-zinc-900/40 border border-zinc-900 rounded-3xl p-6 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-orange-500/10 rounded-2xl text-orange-500">
            <MessageSquare className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-white tracking-tight">HoopsPH Tambayan</h3>
            <p className="text-zinc-550 text-sm font-semibold tracking-wide">
              Ang pambansang tambayan ng basketball fans — chismis, balitaktakan, at mainit na bardagulan sa liga!
            </p>
          </div>
        </div>

        <button
          onClick={() => loadTambayanData(true)}
          disabled={refreshing}
          className="w-full md:w-auto flex items-center justify-center gap-2 px-5 py-3 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 rounded-xl font-semibold cursor-pointer text-sm transition-all"
        >
          <Loader2 className={`w-4 h-4 text-zinc-400 ${refreshing ? "animate-spin" : "hidden"}`} />
          <span>Refresh Feed</span>
        </button>
      </div>

      {/* Main Social Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column Feed Scroll (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* User Post Composer Box */}
          <div className="bg-zinc-900/30 border border-zinc-900 rounded-3xl p-5 shadow-xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 bg-zinc-950 border border-zinc-850">
                <PlayerAvatar
                  playerId={userTeamId || "user-gm"}
                  firstName={userTeam?.city || "User"}
                  lastName="GM"
                  position="GM"
                  teamName={userTeam?.name}
                  teamConference={userTeam?.conference}
                />
              </div>
              <div>
                <span className="font-extrabold text-sm text-zinc-200 block">
                  {userTeam?.city} {userTeam?.name} Front Office
                </span>
                <span className="text-[10px] text-zinc-500 font-bold block uppercase tracking-wider">
                  Post to Tambayan Feed
                </span>
              </div>
            </div>

            <form onSubmit={handleUserPost} className="space-y-3">
              <textarea
                value={customPostContent}
                onChange={(e) => setCustomPostContent(e.target.value)}
                placeholder="Ano ang inyong chismis o patutsada tungkol sa liga ngayon?"
                maxLength={240}
                className="w-full min-h-[80px] bg-zinc-950/60 border border-zinc-850 rounded-2xl p-4 text-zinc-200 text-sm focus:border-orange-500 focus:outline-none placeholder-zinc-650 resize-none font-semibold leading-relaxed"
              />

              <div className="flex flex-wrap items-center justify-between gap-3">
                {/* Prompt templates shortcuts */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] text-zinc-550 font-bold uppercase tracking-wider mr-1">Templates:</span>
                  {[
                    { label: "Flex Win 🏆", type: "Boast" },
                    { label: "Banter/Trash Talk 🤫", type: "Banter" },
                    { label: "Adjustments 📐", type: "Complain" },
                  ].map((t) => (
                    <button
                      key={t.type}
                      type="button"
                      onClick={() => applyTemplate(t.type)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all border cursor-pointer ${
                        postTone === t.type && customPostContent
                          ? "bg-orange-500/10 border-orange-500/30 text-white"
                          : "bg-zinc-950 border-zinc-850 text-zinc-400 hover:text-zinc-250"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                <button
                  type="submit"
                  disabled={isPosting || !customPostContent.trim()}
                  className="px-5 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-md transition-all self-end"
                >
                  {isPosting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  <span>Post Chismis</span>
                </button>
              </div>
            </form>
          </div>

          {/* Timeline Feed Filters */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-zinc-900/10 border border-zinc-900/60 p-2.5 rounded-2xl">
            <div className="flex bg-zinc-950 p-0.5 rounded-xl border border-zinc-850 gap-0.5 flex-wrap">
              {[
                { label: "For You 🔥", value: "all" },
                { label: "News & Rumors 📰", value: "news" },
                { label: "Fan Bardagulan 💬", value: "banter" },
                { label: "General Chatter 🏀", value: "chatter" },
              ].map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => {
                    setActiveTab(tab.value as any);
                    setSelectedTag(null); // Clear tag filter on tab change
                  }}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold tracking-wide transition-all cursor-pointer ${
                    activeTab === tab.value
                      ? "bg-zinc-900 text-white shadow border border-zinc-800"
                      : "text-zinc-550 hover:text-zinc-350"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* In-feed search */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-zinc-550" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Tambayan..."
                className="w-full bg-zinc-950 border border-zinc-850 rounded-xl pl-10 pr-4 py-2 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-700 font-semibold"
              />
            </div>
          </div>

          {/* Active Tag banner display */}
          {selectedTag && (
            <div className="flex items-center justify-between bg-orange-500/10 border border-orange-500/20 text-orange-400 px-4 py-2 rounded-xl text-xs font-bold">
              <span>Filtering timeline by tag: {selectedTag}</span>
              <button
                onClick={() => setSelectedTag(null)}
                className="text-[10px] underline hover:text-white uppercase font-black cursor-pointer"
              >
                Clear Filter
              </button>
            </div>
          )}

          {/* Social Posts Loop Container */}
          {filteredPosts.length === 0 ? (
            <div className="bg-zinc-900/20 border border-zinc-900 rounded-3xl p-16 text-center max-w-lg mx-auto">
              <MessageSquare className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
              <h4 className="text-base font-bold text-zinc-350">Walang Chismis Dito</h4>
              <p className="text-zinc-550 text-xs mt-2 max-w-xs mx-auto font-medium">
                No social posts matching your filters or search terms. Try clicking other hashtags or clear search queries!
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredPosts.map((post) => {
                const isUser = post.authorRole === "GM";
                const isReporter = post.authorRole === "RP";
                const isPlayer = post.authorRole === "PL";

                return (
                  <div
                    key={post.id}
                    className={`bg-zinc-950/40 border hover:border-zinc-800 rounded-3xl p-5 shadow-lg transition-all flex gap-4 ${
                      isUser
                        ? "border-orange-500/20 bg-orange-500/[0.01]"
                        : isReporter
                        ? "border-blue-500/15 bg-blue-500/[0.01]"
                        : "border-zinc-900"
                    }`}
                  >
                    {/* Author Avatar */}
                    <div className="w-11 h-11 rounded-xl overflow-hidden shrink-0 bg-zinc-950 border border-zinc-850 shadow">
                      <PlayerAvatar
                        playerId={post.avatarProps.playerId}
                        firstName={post.avatarProps.firstName}
                        lastName={post.avatarProps.lastName}
                        position={post.avatarProps.position}
                        teamName={post.avatarProps.teamName}
                        teamConference={post.avatarProps.teamConference}
                      />
                    </div>

                    {/* Post Content Wrapper */}
                    <div className="flex-1 space-y-2.5 min-w-0">
                      
                      {/* Post Header Row */}
                      <div className="flex items-start justify-between flex-wrap gap-x-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-extrabold text-sm text-zinc-200 hover:text-white">
                            {post.authorName}
                          </span>
                          <span className="text-zinc-500 text-xs font-semibold">
                            {post.authorHandle}
                          </span>
                          
                          {/* Role tag badges */}
                          {isUser && (
                            <span className="px-1.5 py-0.5 bg-orange-500/10 text-orange-400 border border-orange-500/20 text-[8px] font-black rounded uppercase tracking-wider">
                              GM / User
                            </span>
                          )}
                          {isReporter && (
                            <span className="px-1.5 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[8px] font-black rounded uppercase tracking-wider">
                              Reporter 📢
                            </span>
                          )}
                          {isPlayer && (
                            <span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[8px] font-black rounded uppercase tracking-wider">
                              Player 🏀
                            </span>
                          )}
                        </div>

                        <span className="text-[10px] text-zinc-650 font-bold uppercase tracking-wider">
                          {post.timestamp}
                        </span>
                      </div>

                      {/* Post Body text */}
                      <div className="text-zinc-300 text-sm leading-relaxed font-semibold whitespace-pre-line break-words">
                        {post.content}
                      </div>

                      {/* Hashtag List */}
                      {post.hashtags.length > 0 && (
                        <div className="flex items-center gap-2 flex-wrap">
                          {post.hashtags.map((tag) => (
                            <button
                              key={tag}
                              onClick={() => setSelectedTag(tag)}
                              className="text-orange-400 hover:text-orange-300 hover:underline text-xs font-extrabold cursor-pointer"
                            >
                              {tag}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Engagement Bar buttons */}
                      <div className="flex items-center gap-6 pt-2 border-t border-zinc-900/50 text-zinc-500">
                        {/* Likes */}
                        <button
                          onClick={() => handleLike(post.id)}
                          className={`flex items-center gap-1.5 text-xs font-bold transition-colors cursor-pointer group hover:text-rose-500 ${
                            post.hasLiked ? "text-rose-500" : ""
                          }`}
                        >
                          <Heart className={`w-4 h-4 transition-transform group-hover:scale-110 ${post.hasLiked ? "fill-rose-500 stroke-rose-500" : ""}`} />
                          <span>{post.likes}</span>
                        </button>

                        {/* Retweets */}
                        <button
                          onClick={() => handleRetweet(post.id)}
                          className={`flex items-center gap-1.5 text-xs font-bold transition-colors cursor-pointer group hover:text-green-500 ${
                            post.hasRetweeted ? "text-green-500" : ""
                          }`}
                        >
                          <Repeat className={`w-4 h-4 transition-transform group-hover:rotate-180 duration-300 ${post.hasRetweeted ? "stroke-green-500" : ""}`} />
                          <span>{post.retweets}</span>
                        </button>

                        {/* Comment counts */}
                        <div className="flex items-center gap-1.5 text-xs font-bold">
                          <MessageCircle className="w-4 h-4 text-zinc-650" />
                          <span>{post.repliesCount}</span>
                        </div>
                      </div>

                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>

        {/* Right Columns (4 cols) - Trends & Fan Polls */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Trending Topics Sidebar */}
          <div className="bg-zinc-900/30 border border-zinc-900 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="border-b border-zinc-900 pb-3 flex items-center gap-2 text-zinc-100">
              <TrendingUp className="w-5 h-5 text-orange-500" />
              <h4 className="text-xs font-extrabold uppercase tracking-widest">Trending sa Liga</h4>
            </div>

            <p className="text-zinc-550 text-xs font-semibold leading-relaxed">
              Mainit na trending topics sa pambansang hoops social circles. I-click ang tag para salain ang timeline.
            </p>

            <div className="flex flex-col gap-3">
              {[
                { tag: "#LigaLive", count: "125.4K posts", desc: "Main league discussions" },
                { tag: "#Luto", count: "89.2K posts", desc: "Controversial ref calls debates" },
                { tag: "#BoodleFight", count: "64.1K posts", desc: "Team building & chemistry leaks" },
                { tag: "#ManilaClasico", count: "54.8K posts", desc: "SMC vs. Ginebra vs. Magnolia rivalries" },
                { tag: "#NSD", count: "32.1K posts", desc: "Ginebra-like never say die comebacks" },
                { tag: "#Blockbuster", count: "18.5K posts", desc: "Major superstar trades and movement" }
              ].map((t) => (
                <button
                  key={t.tag}
                  onClick={() => setSelectedTag(t.tag)}
                  className={`w-full text-left p-3.5 rounded-2xl border transition-all cursor-pointer hover:scale-[1.01] ${
                    selectedTag === t.tag
                      ? "bg-orange-500/10 border-orange-500/40 text-white"
                      : "bg-zinc-950/40 border-zinc-900 text-zinc-400 hover:border-zinc-800"
                  }`}
                >
                  <span className="font-extrabold text-sm block text-orange-400 mb-0.5">{t.tag}</span>
                  <span className="text-[10px] text-zinc-500 font-bold block mb-1 uppercase tracking-wider">{t.count}</span>
                  <span className="text-[10px] text-zinc-550 block font-medium leading-relaxed">{t.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Dynamic Fan Poll Sidebar */}
          <div className="bg-zinc-900/30 border border-zinc-900 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="border-b border-zinc-900 pb-3 flex items-center gap-2 text-zinc-100">
              <Award className="w-5 h-5 text-orange-500" />
              <h4 className="text-xs font-extrabold uppercase tracking-widest">Boses ng Barangay (Fans Poll)</h4>
            </div>

            <p className="text-zinc-200 text-sm font-bold leading-snug">
              {pollTitle}
            </p>

            <div className="space-y-3 pt-2">
              {pollVoted ? (
                // Display poll results
                <div className="space-y-4 font-semibold text-xs text-zinc-300">
                  {/* Option 1: SMC */}
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span>San Miguel Beermen (SMC)</span>
                      <span className="font-black text-orange-400">{smcPct}%</span>
                    </div>
                    <div className="w-full bg-zinc-950 h-2.5 rounded-full overflow-hidden border border-zinc-900">
                      <div className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full" style={{ width: `${smcPct}%` }} />
                    </div>
                  </div>

                  {/* Option 2: Ginebra */}
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span>Barangay Ginebra</span>
                      <span className="font-black text-orange-400">{ginebraPct}%</span>
                    </div>
                    <div className="w-full bg-zinc-950 h-2.5 rounded-full overflow-hidden border border-zinc-900">
                      <div className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full" style={{ width: `${ginebraPct}%` }} />
                    </div>
                  </div>

                  {/* Option 3: Magnolia */}
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span>Magnolia Hotshots</span>
                      <span className="font-black text-orange-400">{magnoliaPct}%</span>
                    </div>
                    <div className="w-full bg-zinc-950 h-2.5 rounded-full overflow-hidden border border-zinc-900">
                      <div className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full" style={{ width: `${magnoliaPct}%` }} />
                    </div>
                  </div>

                  <p className="text-[10px] text-zinc-550 font-bold uppercase tracking-wider text-center pt-2">
                    Total Votes Cast: {totalPollVotes} • Simulated fan survey
                  </p>
                </div>
              ) : (
                // Choice Buttons
                <div className="flex flex-col gap-2.5">
                  <button
                    onClick={() => handlePollVote("SMC")}
                    className="w-full text-left p-3.5 bg-zinc-950/60 border border-zinc-900 hover:border-zinc-800 text-xs font-bold text-zinc-300 rounded-2xl cursor-pointer hover:bg-zinc-900/30 transition-all"
                  >
                    San Miguel Beermen (SMC)
                  </button>
                  <button
                    onClick={() => handlePollVote("Ginebra")}
                    className="w-full text-left p-3.5 bg-zinc-950/60 border border-zinc-900 hover:border-zinc-800 text-xs font-bold text-zinc-300 rounded-2xl cursor-pointer hover:bg-zinc-900/30 transition-all"
                  >
                    Barangay Ginebra
                  </button>
                  <button
                    onClick={() => handlePollVote("Magnolia")}
                    className="w-full text-left p-3.5 bg-zinc-950/60 border border-zinc-900 hover:border-zinc-800 text-xs font-bold text-zinc-300 rounded-2xl cursor-pointer hover:bg-zinc-900/30 transition-all"
                  >
                    Magnolia Hotshots
                  </button>
                </div>
              )}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
