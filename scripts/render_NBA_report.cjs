const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

// パスをプロジェクトルート（process.cwd）基準に修正
const nbaColorData = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "NBA_team_colors.json"), "utf8"));

async function renderNbaReport(gameId, roundText = "") {
    const dataPath = path.join(process.cwd(), "data", "reports", `report_nba_${gameId}.json`);
    const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
    
    // チームスタイルの取得
    const hStyle = nbaColorData.teams[data.home.id] || { color: "#333", color2: "#555", text: "#fff", text2: "#eee", city: "Home", nickname: "Team", abbr: "HME" };
    const aStyle = nbaColorData.teams[data.away.id] || { color: "#444", color2: "#666", text: "#fff", text2: "#eee", city: "Away", nickname: "Team", abbr: "AWY" };

    let html = fs.readFileSync(path.join(process.cwd(), "template", "NBA_report.html"), "utf8");

    const pct = (m, a) => (a > 0 ? ((m / a) * 100).toFixed(1) : "0.0");
    const ratio = (val, total) => {
        const res = (total > 0 ? Math.round((val / total) * 100) : 0);
        return isNaN(res) ? 0 : res;
    };
    
    const h = data.home.total;
    const a = data.away.total;

    const reps = {
        "__HOME_BG__": hStyle.color,
        "__AWAY_BG__": aStyle.color,
        "__HOME_DARK__": hStyle.dark, 
        "__AWAY_DARK__": aStyle.dark,
        "__HOME_COLOR2__": hStyle.color2,
        "__AWAY_COLOR2__": aStyle.color2,
        "__HOME_TEXT2__": hStyle.text2 || "#FFFFFF",
        "__AWAY_TEXT2__": aStyle.text2 || "#FFFFFF",
        "__HOME_TEXT__": hStyle.text,
        "__AWAY_TEXT__": aStyle.text,
        "__HOME_CITY__": hStyle.city.toUpperCase(),
        "__HOME_NICK__": hStyle.nickname.toUpperCase(),
        "__AWAY_CITY__": aStyle.city.toUpperCase(),
        "__AWAY_NICK__": aStyle.nickname.toUpperCase(),
        "__HOME_SCORE__": h.pts,
        "__AWAY_SCORE__": a.pts,
        "__DATE__": data.date,
        "__ATTENDANCE__": Number(data.attendance || 0).toLocaleString(),
        "__VENUE__": (data.venue || "UNKNOWN").toUpperCase(),
        "__LEAGUE_TYPE__": "NBA",
        "__ROUND__": roundText.toUpperCase(),
        "__H_FGPCT__": pct(h.fgm, h.fga), 
        "__H_FGSTR__": `${h.fgm} - ${h.fga}`,
        "__H_2FGPCT__": pct(h.f2m, h.f2a), 
        "__H_2FGSTR__": `${h.f2m} - ${h.f2a}`,
        "__H_3FGPCT__": pct(h.f3m, h.f3a), 
        "__H_3FGSTR__": `${h.f3m} - ${h.f3a}`,
        "__H_FTPCT__": pct(h.ftm, h.fta), 
        "__H_FTSTR__": `${h.ftm} - ${h.fta}`,
        "__H_REB__": (Number(h.oreb || 0) + Number(h.dreb || 0)),
        "__H_OREB__": h.oreb, 
        "__H_DREB__": h.dreb,
        "__H_AST__": h.ast, 
        "__H_TOV__": h.tov, 
        "__H_STL__": h.stl, 
        "__H_BLK__": h.blk, 
        "__H_PF__": h.pf,
        "__H_ATT_2P__": ratio(h.f2a, h.fga)+ "%",
        "__H_ATT_3P__": ratio(h.f3a, h.fga)+ "%",
        "__A_FGPCT__": pct(a.fgm, a.fga), 
        "__A_FGSTR__": `${a.fgm} - ${a.fga}`,
        "__A_2FGPCT__": pct(a.f2m, a.f2a), 
        "__A_2FGSTR__": `${a.f2m} - ${a.f2a}`,
        "__A_3FGPCT__": pct(a.f3m, a.f3a), 
        "__A_3FGSTR__": `${a.f3m} - ${a.f3a}`,
        "__A_FTPCT__": pct(a.ftm, a.fta), 
        "__A_FTSTR__": `${a.ftm} - ${a.fta}`,
        "__A_REB__": (Number(a.oreb || 0) + Number(a.dreb || 0)),
        "__A_OREB__": a.oreb, 
        "__A_DREB__": a.dreb,
        "__A_AST__": a.ast, 
        "__A_TOV__": a.tov, 
        "__A_STL__": a.stl, 
        "__A_BLK__": a.blk, 
        "__A_PF__": a.pf,
        "__A_ATT_2P__": ratio(a.f2a, a.fga)+ "%",
        "__A_ATT_3P__": ratio(a.f3a, a.fga)+ "%",
    };

    const starterRows = (players) => (players || []).map(p => `
        <div class="player-row">
            <div class="p-num">${p.no}</div>
            <div class="p-name">${p.name}</div>
            <div class="p-stats">
                <span class="p-min">${p.min.includes(':') ? p.min : '0:00'}</span>
                <span class="p-val">${p.pts}</span>
                <span class="p-val">${p.reb}</span>
                <span class="p-val">${p.ast}</span>
            </div>
        </div>`).join("");

    reps["__HOME_STARTERS_HTML__"] = starterRows(data.home.starters);
    reps["__AWAY_STARTERS_HTML__"] = starterRows(data.away.starters);

    const sortedKeys = Object.keys(reps).sort((a, b) => b.length - a.length);
    sortedKeys.forEach(k => {
        html = html.split(k).join(String(reps[k]));
    });

    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1200, height: 1653 });
    await page.setContent(html);

    const hasRoundText = roundText.trim().length > 0;
    await page.evaluate(({ show }) => {
        const badge = document.querySelector('.round-badge');
        if (badge && !show) {
            badge.style.display = 'none';
        }
    }, { show: hasRoundText });

    const chartData = {
        h: { r2: (h.f2m||0)*2, r3: (h.f3m||0)*3, rf: h.ftm, p3: parseFloat(reps.__H_3FGPCT__) },
        a: { r2: (a.f2m||0)*2, r3: (a.f3m||0)*3, rf: a.ftm, p3: parseFloat(reps.__A_3FGPCT__) }
    };
    
    await page.evaluate((d) => window.drawReportCharts(d), chartData);
    await page.waitForTimeout(1000);
    await page.evaluate(() => {
        if (typeof adjustTextElements === 'function') adjustTextElements();
    });

    const fileName = `NBA_${data.date.replace(/\./g,'')}_${gameId}_${hStyle.abbr}_${aStyle.abbr}.png`;
    const outPath = path.join(process.cwd(), "output", "reports");
    if (!fs.existsSync(outPath)) fs.mkdirSync(outPath, { recursive: true });
    
    await page.screenshot({ path: path.join(outPath, fileName) });
    await browser.close();
    console.log(`✅ 生成完了: ${fileName}`);
}

module.exports = { renderNbaReport };