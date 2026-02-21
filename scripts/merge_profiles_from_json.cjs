const fs = require("fs");
const path = require("path");

function mergeProfiles() {
    const statsPath = path.join(process.cwd(), "data", "all_players_stats.json");
    const masterPath = path.join(process.cwd(), "output", "rosters", "all_teams.json");

    if (!fs.existsSync(statsPath) || !fs.existsSync(masterPath)) {
        console.error("ファイルが見つかりません。パスを確認してください。");
        return;
    }

    const statsPlayers = JSON.parse(fs.readFileSync(statsPath, "utf-8"));
    const masterPlayers = JSON.parse(fs.readFileSync(masterPath, "utf-8"));

    console.log("プロフィールのマージを開始します...");

    // 比較用に文字列をクリーニングする関数（スペース、中黒、全角を除去）
    const clean = (str) => {
        if (!str) return "";
        return str.replace(/[\s　・.・]/g, "").toLowerCase();
    };

    let matchCount = 0;
    statsPlayers.forEach(p => {
        // チーム名は無視して、名前(clean済み)だけで検索
        const targetCleanName = clean(p.nameJp);
        
        const found = masterPlayers.find(m => clean(m.name_ja) === targetCleanName);

        if (found) {
            p.nameEn = found.name_en;
            p.ht = found.height_cm ? found.height_cm.toString() : "---";
            
            // PlayerIDも更新
            if (found.url) {
                const idMatch = found.url.match(/PlayerID=(\d+)/);
                if (idMatch) p.playerId = idMatch[1];
            }
            matchCount++;
        }
    });

    fs.writeFileSync(statsPath, JSON.stringify(statsPlayers, null, 2));

    console.log(`\n✅ 補填完了！`);
    console.log(`対象選手: ${statsPlayers.length} 名`);
    console.log(`補填成功: ${matchCount} 名`);

    const missing = statsPlayers.filter(p => !p.nameEn || p.nameEn === "");
    if (missing.length > 0) {
        console.log(`\n⚠️ まだ補填できていない選手 (${missing.length}名):`);
        console.log(missing.map(p => `${p.team}: ${p.nameJp}`).join(", "));
    }
}

mergeProfiles();