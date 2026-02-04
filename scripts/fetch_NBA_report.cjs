const fs = require("fs");
const path = require("path");

async function fetchNbaReportData(gameId) {
    // 実行ディレクトリを基準に保存先を設定
    const outDir = path.join(process.cwd(), "data", "reports");
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    const url = `https://cdn.nba.com/static/json/liveData/boxscore/boxscore_${gameId}.json`;

    try {
        const response = await fetch(url);
        const json = await response.json();
        const game = json.game;

        const mapTeam = (team) => {
            const s = team.statistics;
            return {
                id: String(team.teamId),
                total: {
                    pts: s.points,
                    fgm: s.fieldGoalsMade, fga: s.fieldGoalsAttempted,
                    f2m: s.fieldGoalsMade - s.threePointersMade, f2a: s.fieldGoalsAttempted - s.threePointersAttempted,
                    f3m: s.threePointersMade, f3a: s.threePointersAttempted,
                    ftm: s.freeThrowsMade, fta: s.freeThrowsAttempted,
                    reb: s.reboundsTotal, 
                    oreb: s.reboundsOffensive || 0,
                    dreb: s.reboundsDefensive || 0,
                    ast: s.assists, tov: s.turnovers, stl: s.steals, blk: s.blocks, pf: s.foulsPersonal
                },
                starters: team.players.filter(p => p.starter === "1").map(p => {
                    const rawMin = p.statistics.minutes; 
                    const m = rawMin.match(/PT(\d+)M(?:(\d+)(?:\.\d+)?S)?/);
                    let displayMin = "00:00";
                    if (m) {
                        const mins = m[1];
                        const secs = m[2] ? m[2].padStart(2, '0') : "00";
                        displayMin = `${mins}:${secs}`;
                    }
                    return {
                        no: p.jerseyNum,
                        name: `${p.firstName} ${p.familyName}`.toUpperCase(),
                        min: displayMin,
                        pts: p.statistics.points, 
                        reb: p.statistics.reboundsTotal, 
                        ast: p.statistics.assists
                    };
                })
            };
        };

        const rawDateString = game.gameTimeLocal || game.gameTimeUTC || "";
        const formattedDate = rawDateString.includes('T') 
            ? rawDateString.split('T')[0].replace(/-/g, '.') 
            : "0000.00.00";

        const result = {
            gameId,
            date: formattedDate,
            venue: game.arena.arenaName,
            attendance: game.attendance || 0,
            home: mapTeam(game.homeTeam),
            away: mapTeam(game.awayTeam)
        };

        fs.writeFileSync(path.join(outDir, `report_nba_${gameId}.json`), JSON.stringify(result, null, 2));
        return result;
    } catch (e) { 
        console.error(`❌ Game ID ${gameId} の取得中にエラーが発生しました:`, e.message); 
    }
}

module.exports = { fetchNbaReportData };