const fs = require("fs");
const path = require("path");

async function fetchNbaPlayerStats(gameId) {
    const url = `https://cdn.nba.com/static/json/liveData/boxscore/boxscore_${gameId}.json`;
    const response = await fetch(url);
    const json = await response.json();
    const game = json.game;

    const parseMin = (raw) => {
        if (!raw || raw === "PT00M00.00S" || raw === "PT0M0S") return "0:00";
        const m = raw.match(/PT(\d+)M(?:(\d+)(?:\.\d+)?S)?/);
        // 分を2桁(00)ではなく、render側が判定しやすい形式に統一
        return m ? `${m[1]}:${m[2] ? m[2].padStart(2, '0') : "00"}` : "0:00";
    };

    const processPlayers = (team) => {
        const calcPct = (made, att) => {
            return att > 0 ? ((made / att) * 100).toFixed(1) : "0.0";
        };

        return team.players.map(p => {
            const s = p.statistics;
            const f2m = s.fieldGoalsMade - s.threePointersMade;
            const f2a = s.fieldGoalsAttempted - s.threePointersAttempted;
            
            return {
                id: p.personId,
                no: p.jerseyNum,
                name: `${p.firstName} ${p.familyName}`,
                teamId: String(team.teamId),
                teamNameRaw: team.teamName,
                isStarter: p.starter === "1",
                min: parseMin(s.minutes), // ここで "0:00" になる
                pts: s.points,
                reb: s.reboundsTotal,
                oreb: s.reboundsOffensive,
                dreb: s.reboundsDefensive,
                ast: s.assists,
                stl: s.steals,
                blk: s.blocks,
                tov: s.turnovers, // 「to」から「tov」に変更 (renderと合わせる)
                pf: s.foulsPersonal,
                plusMinus: s.plusMinusPoints,
                
                fg2Pct: calcPct(f2m, f2a),
                fg2Str: `${f2m}/${f2a}`,
                
                fg3Pct: calcPct(s.threePointersMade, s.threePointersAttempted),
                fg3Str: `${s.threePointersMade}/${s.threePointersAttempted}`,
                
                ftPct: calcPct(s.freeThrowsMade, s.freeThrowsAttempted),
                ftStr: `${s.freeThrowsMade}/${s.freeThrowsAttempted}`,

                ptsRatio2P: s.points > 0 ? Math.round(((f2m * 2) / s.points) * 100) : 0,
                ptsRatio3P: s.points > 0 ? Math.round(((s.threePointersMade * 3) / s.points) * 100) : 0,
                ptsRatioFT: s.points > 0 ? Math.round((s.freeThrowsMade / s.points) * 100) : 0,
                attRatio2P: (f2a + s.threePointersAttempted) > 0 ? Math.round((f2a / (f2a + s.threePointersAttempted)) * 100) : 0,
                attRatio3P: (f2a + s.threePointersAttempted) > 0 ? Math.round((s.threePointersAttempted / (f2a + s.threePointersAttempted)) * 100) : 0
            };
        });
    };

    const result = {
        gameId,
        date: (game.gameTimeLocal || game.gameTimeUTC).split('T')[0].replace(/-/g, '.'),
        venue: game.arena.arenaName,
        attendance: game.attendance || 0,
        homeName: game.homeTeam.teamName,
        awayName: game.awayTeam.teamName,
        homeId: String(game.homeTeam.teamId),
        awayId: String(game.awayTeam.teamId),
        scoreHome: game.homeTeam.statistics.points,
        scoreAway: game.awayTeam.statistics.points,
        players: [...processPlayers(game.homeTeam), ...processPlayers(game.awayTeam)]
    };

    const outDir = path.join(__dirname, "..", "data", "raw");
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, `game_players_${gameId}.json`), JSON.stringify(result, null, 2));
    return result;
}

module.exports = { fetchNbaPlayerStats };