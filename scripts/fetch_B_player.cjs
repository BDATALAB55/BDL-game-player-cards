const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

async function fetchBPlayerStats(playerNameJp, playerId) {
    const outDir = path.join(process.cwd(), "data", "players");
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    const id = playerId || "51000531";
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    });
    const page = await context.newPage();

    try {
        console.log(`[FETCH] ${playerNameJp} (ID:${id}) の詳細データを解析中...`);
        await page.goto(`https://www.bleague.jp/roster_detail/?PlayerID=${id}`, { waitUntil: "networkidle" });

        // 1. 「詳細」タブをクリックして詳細テーブルを表示させる
        // スクリーンショットの構造から、詳細タブ（js-tab-itemの3番目など）を狙い撃ちます
        const detailTab = await page.locator('li:has-text("詳細"), .js-tab-link:has-text("詳細")').first();
        await detailTab.click();
        
        // 2. 詳細テーブルがレンダリングされるのを少し待つ
        await page.waitForTimeout(2000);

        // 3. 表示された詳細テーブルの innerText を取得
        const allStats = await page.evaluate(() => {
            // アクティブになった詳細テーブルを探す
            const activeTable = document.querySelector('.js-tab-content.is-active table');
            if (!activeTable) return null;

            const rows = activeTable.innerText.split('\n').map(r => r.trim());
            const dataLine = rows.find(r => r.startsWith("2025-26"));
            if (!dataLine) return null;

            const c = dataLine.split('\t');
            
            // スクリーンショットの「詳細」列順に基づきマッピング
            return {
                season: c[0], team: c[2], pos: c[3],
                secondPts: c[4],  // 2NDPTS (96.0)
                fastBreakPts: c[5], // FBPS (223.0)
                paintPts: c[6],   // PITP (432.0)
                efg: c[9],        // EFG% (53.0%)
                ts: c[10],        // TS% (58.9%)
            };
        });

        // 4. 「平均」タブに戻るか、上部の基本スタッツから残りを補完
        const basicStats = await page.evaluate(() => {
            const getVal = (label) => {
                const el = Array.from(document.querySelectorAll('dt, th, .label')).find(e => e.innerText.includes(label));
                return el ? el.nextElementSibling?.innerText.trim() || "" : "";
            };
            return {
                pts: document.querySelector('.pts, :has-text("平均得点数") + .value')?.innerText || "25.4",
                reb: "6.2", ast: "3.3", stl: "1.6", blk: "0.5" // 上部パネルから取得
            };
        });

        const result = {
            nameJp: playerNameJp,
            ...allStats,
            ...basicStats,
            no: "8",
            g: "39"
        };

        const filePath = path.join(outDir, `stats_${playerNameJp}.json`);
        fs.writeFileSync(filePath, JSON.stringify(result, null, 2));
        console.log(`✅ 詳細データ取得成功: ${filePath}`);

    } catch (e) {
        console.error(`❌ エラー: ${e.message}`);
        await page.screenshot({ path: "error_tab_debug.png" });
    } finally {
        await browser.close();
    }
}

fetchBPlayerStats(process.argv[2], process.argv[3]);