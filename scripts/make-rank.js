// scripts/make-rank.js
import fs from 'fs';
import path from 'path';

// 引数の取得: node scripts/make-rank.js [カテゴリー] [日付] [試合ID...]
const [category, date, ...gameIds] = process.argv.slice(2);

if (!category || !date || gameIds.length === 0) {
  console.error("使用法: node scripts/make-rank.js [B1|B2] [日付(YYYYMMDD)] [試合ID1] [試合ID2] ...");
  process.exit(1);
}

const REPO_ROOT = process.cwd();
const REPORTS_DIR = path.join(REPO_ROOT, 'data/reports');
const OUTPUT_DIR = path.join(REPO_ROOT, `src/data/rankings/${category.toUpperCase()}`);
const OUTPUT_FILE = path.join(OUTPUT_DIR, `${date}.json`);

// 出力先ディレクトリの準備
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

let allPlayers = [];

gameIds.forEach(gameId => {
  const filePath = path.join(REPORTS_DIR, `report_${gameId}.json`);
  
  if (fs.existsSync(filePath)) {
    try {
      const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (content.players) {
        const playersWithCard = content.players.map(p => {
          // 1. 表示用の名前（記号を維持）
          // p.name, p.name_en, p.nameJp の順で優先して取得し、大文字化
          const displayName = (p.name || p.name_en || p.nameJp || "").toUpperCase().trim();

          // 2. 画像ファイル検索用の名前（アポストロフィを削除）
          // ファイル名との一致を優先するため、記号を消してアンダースコア化
          const searchName = displayName
            .replace(/'/g, '')        // SHAWN O'MARA -> SHAWN OMARA
            .replace(/\s+/g, '_');    // スペースを _ に

          const teamName = (p.teamNameRaw || "").toUpperCase().trim().replace(/\s+/g, '_');
          
          // 3. フォルダ名・ファイル名の組み立て
          // home_en などが無い場合に備えて、予備のプロパティ (homeName) も参照
          const home = content.home_en || content.homeName || "HOME";
          const away = content.away_en || content.awayName || "AWAY";
          const folderName = `game_${gameId}_${home}_${away}_${date}`;
          const fileName = `${teamName}_${p.no}_${searchName}_${date}.png`;

          const cardPath = `output/Bplayers/${category.toUpperCase()}/${date.slice(2)}/${folderName}/${fileName}`;
          
          return {
            ...p,
            name: displayName, // ★ボタンの表示用（O'MARA になる）
            gameId,
            cardPath           // ★画像の読み込みパス（OMARA になる）
          };
        });
        allPlayers = [...allPlayers, ...playersWithCard];
      }
      console.log(`✅ Loaded: ${category} - Game ${gameId}`);
    } catch (e) {
      console.error(`❌ Error parsing ${gameId}:`, e);
    }
  } else {
    console.warn(`⚠️ File not found: ${filePath}`);
  }
});

// 指標別トップ10の抽出関数
const getTop10 = (players, key) => {
  return players
    .sort((a, b) => (Number(b[key]) || 0) - (Number(a[key]) || 0))
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
console.log(`\n✨ Ranking JSON Created: ${OUTPUT_FILE}`);