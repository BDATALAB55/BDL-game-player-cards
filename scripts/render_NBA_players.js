const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

async function renderNbaPlayerCards(gameId, roundText = "") {
    const dataPath = path.join(__dirname, "..", "data", "raw", `game_players_${gameId}.json`);
    const colorPath = path.join(__dirname, "..", "data", "NBA_team_colors.json");
    
    const gameData = JSON.parse(fs.readFileSync(dataPath, "utf8"));
    const colorData = JSON.parse(fs.readFileSync(colorPath, "utf8"));

    const getStyle = (id) => colorData.teams[id] || { color: "#333", dark: "#111", color2: "#555", text: "#fff", city: "NBA", nickname: "TEAM", abbr: "NBA" };
    
    const hStyle = getStyle(gameData.homeId);
    const aStyle = getStyle(gameData.awayId);

    const folderName = `NBA_Cards_${gameId}_${gameData.date.replace(/\./g,'')}`;
    const outputDir = path.join(__dirname, "..", "output", "players", folderName);
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    const templateHtml = fs.readFileSync(path.join(__dirname, "..", "template", "NBA_player.html"), "utf8");

    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1200, height: 1653 });

    for (const player of gameData.players) {
        // --- 超強力版：出場判定ロジック ---
        const rawMin = String(player.min || "").trim().toUpperCase();
        
        // 1. DNP等の文字列が含まれる場合は即スキップ
        const isDnp = /DNP|DND|NWT|INA|DEC/.test(rawMin);
        
        // 2. 数値的な出場時間を計算 (例: "32:51" -> 32*60 + 51 = 1971秒)
        let totalSeconds = 0;
        if (rawMin.includes(":")) {
            const parts = rawMin.split(":");
            const mins = parseInt(parts[0]) || 0;
            const secs = parseInt(parts[1]) || 0;
            totalSeconds = (mins * 60) + secs;
        } else {
            totalSeconds = parseInt(rawMin) || 0;
        }

        // DNPである、または合計秒数が 0 の場合は生成しない
        if (!player.min || isDnp || totalSeconds === 0) {
            continue; 
        }

        const pStyle = getStyle(player.teamId);
        let html = templateHtml; 

        // すべての値を文字列に変換し、undefined を防ぐ
        const reps = {
            "__HOME_BG__": String(hStyle.color),
            "__AWAY_BG__": String(aStyle.color),
            "__HOME_DARK__": String(hStyle.dark),
            "__AWAY_DARK__": String(aStyle.dark),
            "__HOME_COLOR2__": String(hStyle.color2 || hStyle.color),
            "__AWAY_COLOR2__": String(aStyle.color2 || aStyle.color),
            "__HOME_CITY__": String(hStyle.city).toUpperCase(),
            "__HOME_NICK__": String(hStyle.nickname).toUpperCase(),
            "__AWAY_CITY__": String(aStyle.city).toUpperCase(),
            "__AWAY_NICK__": String(aStyle.nickname).toUpperCase(),
            "__HOME_SCORE__": String(gameData.scoreHome),
            "__AWAY_SCORE__": String(gameData.scoreAway),
            "__DATE__": String(gameData.date),
            "__VENUE__": String(gameData.venue || "UNKNOWN").toUpperCase(),
            "__ATTENDANCE__": Number(gameData.attendance || 0).toLocaleString(),
            "__LEAGUE_TYPE__": "NBA",
            "__ROUND__": String(roundText).toUpperCase(),
            
            "__PLAYER_BG__": String(pStyle.color),
            "__PLAYER_COLOR2__": String(pStyle.color2 || pStyle.color),
            "__PLAYER_DARK__": String(pStyle.dark || pStyle.color),
            "__PLAYER_TEXT__": String(pStyle.text || "#FFFFFF"),
            "__PLAYER_NO__": String(player.no || "0"),
            "__PLAYER_NAME__": String(player.name || "PLAYER").toUpperCase(),
            "__PLAYER_TEAM_RAW__": String(pStyle.nickname).toUpperCase(),
            "__STARTER__": player.isStarter ? "S" : "",
            "__PLAYER_CITY__": String(pStyle.city).toUpperCase(),
            "__PLAYER_NICK__": String(pStyle.nickname).toUpperCase(),
            
            "__PTS__": String(player.pts || "0"),
            "__REB__": String(player.reb || "0"),
            "__OREB__": String(player.oreb || "0"),
            "__DREB__": String(player.dreb || "0"),
            "__AST__": String(player.ast || "0"),

            "__FG2STR__": String(player.fg2Str || "0-0"),
            "__FG3STR__": String(player.fg3Str || "0-0"),
            "__FTSTR__": String(player.ftStr || "0-0"),

            "__MIN__": String(player.min || "0:00"),
            "__TO__": String(player.tov || "0"),
            "__STL__": String(player.stl || "0"),
            "__BLK__": String(player.blk || "0"),
            "__PF__": String(player.pf || "0"),
            "__PM__": (Number(player.plusMinus) > 0 ? "+" : "") + String(player.plusMinus || "0")
        };

        // 置換処理
        const sortedKeys = Object.keys(reps).sort((a, b) => b.length - a.length);
        sortedKeys.forEach(k => {
            html = html.split(k).join(String(reps[k]));
        });

        await page.setContent(html);

        const hasRoundText = roundText.trim().length > 0;
        await page.evaluate(({ show }) => {
            const badge = document.querySelector('.round-badge');
            if (badge && !show) {
                badge.style.display = 'none'; // 文字がない時は枠ごと消す
            }
        }, { show: hasRoundText });
        
        // グラフ用数値計算
        const chartData = {
            scoreHome: gameData.scoreHome,
            scoreAway: gameData.scoreAway,
            fg2Pct: parseFloat(player.fg2Pct || 0),
            fg3Pct: parseFloat(player.fg3Pct || 0),
            ftPct: parseFloat(player.ftPct || 0),
            ptsRatio2P: player.ptsRatio2P || 0,
            ptsRatio3P: player.ptsRatio3P || 0,
            ptsRatioFT: player.ptsRatioFT || 0,
            attRatio2P: player.attRatio2P || 0,
            attRatio3P: player.attRatio3P || 0,
        };

        await page.evaluate((d) => window.drawCharts(d), chartData);
        await page.waitForTimeout(500);

        const safeName = player.name.replace(/\s+/g, '_');
        await page.screenshot({ path: path.join(outputDir, `${pStyle.abbr}_${player.no}_${safeName}.png`) });
    }

    await browser.close();
    console.log(`✅ 生成完了: ${outputDir}`);
}

module.exports = { renderNbaPlayerCards };