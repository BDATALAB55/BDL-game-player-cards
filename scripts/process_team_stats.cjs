const fs = require("fs");
const path = require("path");

const rawDataPath = path.join(process.cwd(), "data", "stats", "b1_team_stats.json");
const outputPath = path.join(process.cwd(), "data", "stats", "processed_team_stats.json");

if (!fs.existsSync(rawDataPath)) {
    console.error("❌ 元データが見つかりません。fetchを先に実行してください。");
    process.exit(1);
}

const rawData = JSON.parse(fs.readFileSync(rawDataPath, "utf8"));
const teams = rawData.teams;

// 現在の試合数を仮定 (2025-26シーズンの中盤想定。適宜調整してください)
const gamesPlayed = 36; 

function calculateAdvancedStats(team) {
    // 基本平均
    const avg = (val) => parseFloat((val / gamesPlayed).toFixed(1));
    
    // ポゼッション推計 (簡易式: FGA + 0.44 * FTA + TOV)
    const fga = (team.fg2a || 0) + (team.fg3a || 0);
    const possessions = fga + (0.44 * (team.fta || 0)) + (team.tov || 0);
    const pace = parseFloat(((possessions / gamesPlayed)).toFixed(1));

    // ORTG: (PTS / Possession) * 100
    const ortg = parseFloat(((team.pts / possessions) * 100).toFixed(1));
    
    // DRTG: (本来は失点が必要ですが、一旦ダミーまたはリーグ平均を入れる設計にします)
    // ※もし失点データが取れたらここを (oppPts / possessions) * 100 に差し替えます
    const drtg = 105.5; 

    return {
        ...team,
        displayPts: avg(team.pts),
        displayAst: avg(team.ast),
        displayReb: avg(team.reb),
        displayStl: avg(team.stl),
        displayBlk: avg(team.blk),
        displayTov: avg(team.tov),
        displayPf: avg(team.pf),
        // 成功率 (スクレイピング時のカラムズレを補正)
        fg2p: team.fg2m, 
        fg3p: team.fg3m,
        ftp: team.ftm,
        // アドバンスド
        pace,
        ortg,
        drtg,
        paintPts: team.paintPts,
        secondChancePts: avg(team.secondChancePts),
        fastBreakPts: team.fastBreakPts,
        ptsOffTov: avg(team.ptsOffTov),
    };
}

let processedTeams = teams.map(calculateAdvancedStats);

// ランキング計算
function addRank(list, key, reverse = false) {
    const sorted = [...list].sort((a, b) => reverse ? a[key] - b[key] : b[key] - a[key]);
    list.forEach(team => {
        team[`rank_${key}`] = sorted.findIndex(t => t.teamName === team.teamName) + 1;
    });
}

const rankKeys = ['displayPts', 'displayAst', 'displayReb', 'displayStl', 'displayBlk', 'displayTov', 'ortg', 'fg2p', 'fg3p', 'ftp'];
rankKeys.forEach(key => addRank(processedTeams, key, key === 'displayTov')); // TOVだけ低い方が高順位

// B1平均
const b1Avg = {};
rankKeys.forEach(key => {
    const sum = processedTeams.reduce((acc, t) => acc + t[key], 0);
    b1Avg[key] = parseFloat((sum / processedTeams.length).toFixed(1));
});

const finalOutput = {
    updatedAt: rawData.updatedAt,
    b1Avg,
    teams: processedTeams
};

fs.writeFileSync(outputPath, JSON.stringify(finalOutput, null, 2));
console.log("✅ カード用加工データの作成が完了しました！ (data/stats/processed_team_stats.json)");