/* scripts/fetch_B_team_stats.cjs */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

async function fetchBTeamStats() {
    const outDir = path.join(process.cwd(), "data", "stats");
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    // 一時的に動作を見るために headless: false に設定するのも手です
    const browser = await chromium.launch({ headless: true }); 
    const context = await browser.newContext({
        viewport: { width: 1280, height: 1600 },
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    });
    const page = await context.newPage();

    try {
        // --- 1. 順位表 ---
        console.log("[FETCH] 順位表を取得中...");
        await page.goto("https://www.bleague.jp/standings/?tab=1", { waitUntil: "networkidle", timeout: 60000 });
        await page.waitForTimeout(2000); // 描画安定待ち

        const standings = await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll("tr")).filter(r => r.innerText.includes("勝"));
            // チーム名が含まれる行を特定して抽出
            return rows.map(row => {
                const cols = row.querySelectorAll("td");
                if (cols.length < 5) return null;
                return {
                    teamName: cols[1]?.innerText.trim(),
                    win: cols[2]?.innerText.trim(),
                    loss: cols[3]?.innerText.trim(),
                    rank: cols[0]?.innerText.trim(),
                    winRate: cols[4]?.innerText.trim()
                };
            }).filter(s => s && s.teamName);
        });

        // --- 2. 基本スタッツ (Total) ---
        console.log("[FETCH] 基本スタッツを取得中...");
        const statsUrl = "https://www.bleague.jp/stats/?year=2025&tab=1&target=club-b1&value=TotalPoints&o=desc&e=2&dt=tot";
        await page.goto(statsUrl, { waitUntil: "load", timeout: 80000 });
        
        // 強制スクロール（遅延読み込み対策）
        await page.evaluate(() => window.scrollTo(0, 800));
        await page.waitForTimeout(3000);

        // セレクタを緩めて待機
        await page.waitForFunction(() => document.querySelectorAll("table tr").length > 10, { timeout: 60000 });

        const basicStats = await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll("table tbody tr"));
            return rows.map(row => {
                const c = Array.from(row.querySelectorAll("td")).map(td => td.innerText.trim());
                if (c.length < 20) return null;
                return {
                    teamName: c[1],
                    pts: parseFloat(c[4]),
                    fg2m: parseFloat(c[7]), fg2a: parseFloat(c[8]), fg2p: parseFloat(c[9]),
                    fg3m: parseFloat(c[10]), fg3a: parseFloat(c[11]), fg3p: parseFloat(c[12]),
                    ftm: parseFloat(c[13]), fta: parseFloat(c[14]), ftp: parseFloat(c[15]),
                    oreb: parseFloat(c[17]), dreb: parseFloat(c[18]), reb: parseFloat(c[19]),
                    ast: parseFloat(c[20]), tov: parseFloat(c[22]), stl: parseFloat(c[23]),
                    blk: parseFloat(c[24]), pf: parseFloat(c[26]), fd: parseFloat(c[27])
                };
            }).filter(b => b && b.teamName);
        });

        // --- 3. 詳細スタッツ ---
        console.log("[FETCH] 詳細スタッツを取得中...");
        const detailUrl = "https://www.bleague.jp/stats/?year=2025&tab=1&target=club-b1&value=sSecondChancePointsMade&o=desc&e=2&dt=dtl";
        await page.goto(detailUrl, { waitUntil: "load", timeout: 80000 });
        await page.evaluate(() => window.scrollTo(0, 800));
        await page.waitForTimeout(3000);
        await page.waitForFunction(() => document.querySelectorAll("table tr").length > 10, { timeout: 60000 });

        const detailStats = await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll("table tbody tr"));
            return rows.map(row => {
                const c = Array.from(row.querySelectorAll("td")).map(td => td.innerText.trim());
                if (c.length < 7) return null;
                return {
                    teamName: c[1],
                    ptsOffTov: parseFloat(c[4]),
                    secondChancePts: parseFloat(c[5]),
                    fastBreakPts: parseFloat(c[6]),
                    paintPts: parseFloat(c[7])
                };
            }).filter(d => d && d.teamName);
        });

        // データ結合
        const teams = basicStats.map(team => {
            const standing = standings.find(s => s.teamName === team.teamName) || {};
            const detail = detailStats.find(d => d.teamName === team.teamName) || {};
            return { ...team, ...standing, ...detail };
        });

        const finalData = { updatedAt: new Date().toISOString(), teams };
        fs.writeFileSync(path.join(outDir, "b1_team_stats.json"), JSON.stringify(finalData, null, 2));
        console.log(`✅ ${teams.length} チームのデータを取得しました。`);

    } catch (e) {
        console.error("❌ エラー:", e.message);
        await page.screenshot({ path: "error_debug.png" });
    } finally {
        await browser.close();
    }
}

module.exports = { fetchBTeamStats };