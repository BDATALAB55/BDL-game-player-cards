import fs from 'fs';
import path from 'path';

const [category, date, ...gameIds] = process.argv.slice(2);
const REPO_ROOT = process.cwd();
const RAW_DATA_DIR = path.join(REPO_ROOT, 'data/raw');
const OUTPUT_DIR = path.join(REPO_ROOT, `src/data/rankings/${category.toUpperCase()}`);
const OUTPUT_FILE = path.join(OUTPUT_DIR, `${date}.json`);

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

let allPlayers = [];

gameIds.forEach(gameId => {
  const filePath = path.join(RAW_DATA_DIR, `game_players_${gameId}.json`);
  if (!fs.existsSync(filePath)) {
    console.warn(`⚠️ File not found: ${filePath}`);
    return;
  }

  try {
    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    let rawPlayers = [];
    let hTeam = "HOME";
    let aTeam = "AWAY";

    // --- NBAデータの柔軟な解析 ---
    // パターン1: home/away オブジェクトがある場合
    if (content.home && content.away) {
      hTeam = (content.home.teamName || content.home.teamCity || "HOME").toUpperCase().replace(/\s+/g, '_');
      aTeam = (content.away.teamName || content.away.teamCity || "AWAY").toUpperCase().replace(/\s+/g, '_');
      
      const hPlayers = (content.home.players || []).map(p => ({ ...p, teamNameRaw: hTeam }));
      const aPlayers = (content.away.players || []).map(p => ({ ...p, teamNameRaw: aTeam }));
      rawPlayers = [...hPlayers, ...aPlayers];
    } 
    // パターン2: players 配列が直下にある場合
    else if (Array.isArray(content.players)) {
      rawPlayers = content.players;
    }

    if (rawPlayers.length === 0) {
      console.warn(`⚠️ No players found in game: ${gameId}`);
      return;
    }

    const playersWithCard = rawPlayers.map(p => {
      // 統計データの抽出 (statisticsオブジェクト内にある場合も考慮)
      const stats = p.statistics || p;
      const pts = parseInt(stats.points ?? stats.pts ?? 0);
      const reb = parseInt(stats.reboundsTotal ?? stats.reb ?? 0);
      const ast = parseInt(stats.assists ?? stats.ast ?? 0);

      const teamName = (p.teamNameRaw || p.teamName || "TEAM").toUpperCase().replace(/\s+/g, '_');
      const displayName = (p.name || p.playerName || "UNKNOWN").toUpperCase().trim();
      const searchName = displayName.replace(/'/g, '').replace(/\s+/g, '_');
      
      // 画像パスの構築
      const folderName = `game_${gameId}_${aTeam}_${hTeam}_${date}`;
      const fileName = `${teamName}_${p.jerseyNum || p.no || '0'}_${searchName}_${date}.png`;
      const cardPath = `output/NBAplayers/${category.toUpperCase()}/${date.slice(2)}/${folderName}/${fileName}`;
      
      return { 
        ...p, 
        pts, 
        reb, 
        ast, 
        name: displayName, 
        gameId, 
        cardPath,
        team: teamName 
      };
    });

    allPlayers = allPlayers.concat(playersWithCard);
    console.log(`✅ Processed: ${gameId} (${playersWithCard.length} players)`);

  } catch (e) {
    console.error(`❌ Error in ${gameId}:`, e.message);
  }
});

const getTop10 = (players, key) => {
  return [...players]
    .sort((a, b) => (b[key] - a[key]))
    .slice(0, 10);
};

const result = {
  category: category.toUpperCase(),
  date: date,
  pts: getTop10(allPlayers, 'pts'),
  reb: getTop10(allPlayers, 'reb'),
  ast: getTop10(allPlayers, 'ast')
};

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2));
console.log(`\n✨ NBA Ranking Generated: ${OUTPUT_FILE}`);
console.log(`✨ Total Players Processed: ${allPlayers.length}`);