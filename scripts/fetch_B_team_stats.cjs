const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

async function fetchBTeamStats() {
    const outDir = path.join(process.cwd(), "data", "stats");
    const outFile = path.join(outDir, "processed_team_stats.json");
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    console.log("🚀 スタッツ取得を開始します...");
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    const scrapeData = async (url) => {
        await page.goto(url, { waitUntil: "networkidle" });
        await page.waitForSelector("table tbody tr");
        return await page.evaluate(() => {
            return Array.from(document.querySelectorAll("table tbody tr")).map(row => {
                const cells = Array.from(row.querySelectorAll("td")).map(td => td.innerText.trim());
                const name = cells[1] ? cells[1].replace(/\s+/g, "") : null;
                return { name, cells };
            }).filter(r => r.name);
        });
    };

    try {
        console.log("[1/2] 基本スタッツ(AVG)取得中...");
        const rawBasic = await scrapeData("https://www.bleague.jp/stats/?year=2025&tab=1&target=club-b1&value=TotalPoints&o=desc&e=2&dt=avg");
        
        console.log("[2/2] アドバンスド(ADV)取得中...");
        const rawAdv = await scrapeData("https://www.bleague.jp/stats/?year=2025&tab=1&target=club-b1&value=sOffensiveRating&o=desc&e=2&dt=adv");

        const teams = rawBasic.map(b => {
            const a = rawAdv.find(x => x.name === b.name);
            const cells = b.cells; // 基本スタッツの配列
            const advCells = a ? a.cells : []; // アドバンスドの配列

            return {
                teamName: b.name,
                // cells[5] = PTS (80.1), cells[8] = 2FG M, etc.
                pts: parseFloat(cells[5]),
                fg2m: parseFloat(cells[8]),
                fg2a: parseFloat(cells[9]),
                fg2p: parseFloat(cells[10]),
                fg3m: parseFloat(cells[11]),
                fg3a: parseFloat(cells[12]), // ここを修正しました
                fg3p: parseFloat(cells[13]),
                ftm: parseFloat(cells[14]),
                fta: parseFloat(cells[15]),
                ftp: parseFloat(cells[16]),
                reb: parseFloat(cells[20]),
                ast: parseFloat(cells[21]),
                tov: parseFloat(cells[23]),
                stl: parseFloat(cells[24]),
                blk: parseFloat(cells[25]),
                // アドバンスド系
                ortg: advCells[5] ? parseFloat(advCells[5]) : null, // 111.8
                drtg: advCells[6] ? parseFloat(advCells[6]) : null, // 109.8
                pace: advCells[10] ? parseFloat(advCells[10]) : null // 71.7
            };
        });

        // 簡易ランキング
        const sorted = [...teams].sort((a, b) => (b.pts || 0) - (a.pts || 0));
        const finalTeams = teams.map(t => ({
            ...t,
            rank_pts: sorted.findIndex(s => s.teamName === t.teamName) + 1
        }));

        fs.writeFileSync(outFile, JSON.stringify({ updatedAt: new Date().toLocaleString(), teams: finalTeams }, null, 2));
        console.log("✅ 全工程完了！");

    } catch (e) {
        console.error("❌ エラー発生:", e.message);
    } finally {
        await browser.close();
    }
}

fetchBTeamStats();