import fs from 'fs';
import path from 'path';

const [category, date, ...gameIds] = process.argv.slice(2);
const REPO_ROOT = process.cwd();
const REPORTS_DIR = path.join(REPO_ROOT, 'data/reports');
const OUTPUT_DIR = path.join(REPO_ROOT, `src/data/rankings/${category.toUpperCase()}`);
const OUTPUT_FILE = path.join(OUTPUT_DIR, `${date}.json`);

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

let allPlayers = [];

gameIds.forEach(gameId => {
  const filePath = path.join(REPORTS_DIR, `report_${gameId}.json`);
  if (!fs.existsSync(filePath)) return;

  try {
    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    let rawPlayers = [];

    // --- データの抽出 (新旧両方のフォーマットに対応) ---
    if (content.players) {
      // 505173 形式 (直下にplayersがある)
      rawPlayers = content.players;
    } else if (content.home && content.away) {
      // 505167 形式 (home/awayの中に分かれている)
      const hStarters = (content.home.starters || []).map(p => ({ ...p, teamNameRaw: content.homeName }));
      const hBench = (content.home.bench || []).map(p => ({ ...p, teamNameRaw: content.homeName }));
      const aStarters = (content.away.starters || []).map(p => ({ ...p, teamNameRaw: content.awayName }));
      const aBench = (content.away.bench || []).map(p => ({ ...p, teamNameRaw: content.awayName }));
      rawPlayers = [...hStarters, ...hBench, ...aStarters, ...aBench];
    }

    if (rawPlayers.length === 0) return;

    const home = (content.home_en || content.homeName || "HOME").replace(/\s+/g, '_');
    const away = (content.away_en || content.awayName || "AWAY").replace(/\s+/g, '_');

    const playersWithCard = rawPlayers.map(p => {
      const pts = parseInt(p.pts) || 0;
      const reb = parseInt(p.reb) || 0;
      const ast = parseInt(p.ast) || 0;

      // 505167用: teamNameRawがなければ親のhomeName/awayNameから補完済み
      const teamName = (p.teamNameRaw || "TEAM").toUpperCase().trim().replace(/\s+/g, '_');
      const displayName = (p.name || p.nameJp || "UNKNOWN").toUpperCase().trim();
      const searchName = displayName.replace(/'/g, '').replace(/\s+/g, '_');
      
      const folderName = `game_${gameId}_${home}_${away}_${date}`;
      const fileName = `${teamName}_${p.no || '0'}_${searchName}_${date}.png`;
      const cardPath = `output/Bplayers/${category.toUpperCase()}/${date.slice(2)}/${folderName}/${fileName}`;
      
      return { ...p, pts, reb, ast, name: displayName, gameId, cardPath };
    });

    allPlayers = allPlayers.concat(playersWithCard);
    console.log(`✅ Loaded: ${gameId} (${playersWithCard.length} players)`);

  } catch (e) {
    console.error(`❌ Error in ${gameId}:`, e.message);
  }
});

// 指標別トップ10
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
console.log(`\n✨ Total Players: ${allPlayers.length}`);