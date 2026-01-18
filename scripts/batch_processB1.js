const { chromium } = require("playwright");
// ★ここが重要：Masakiさんの持っている render_players.js と fetch を呼び出す
const { renderPlayers } = require("./render_players.js");
const { fetchGameBoxscore } = require("./fetch_bleague_boxscore.js");

async function getB1Ids(dateStr) {
    const [year, mon, day] = dateStr.split("/");
    const url = `https://www.bleague.jp/schedule/?year=${year}&mon=${parseInt(mon)}&day=${parseInt(day)}&tab=1`;
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    try {
        await page.goto(url, { waitUntil: "networkidle" });
        await page.waitForTimeout(5000); 
        const ids = await page.evaluate(() => {
            const b1Section = document.querySelector('.schedule_group_1') || document;
            return Array.from(b1Section.querySelectorAll('a[href*="game_id="]'))
                .map(a => a.href.match(/game_id=(\d+)/)?.[1]).filter(Boolean);
        });
        return [...new Set(ids)];
    } finally {
        await browser.close();
    }
}

async function run() {
    const args = process.argv.slice(2);
    const date = args[0];

    if (!date) {
        console.log("⚠️ 日付を指定してください (例: node scripts/batch_processB1.js 2025/12/27)");
        return;
    }

    console.log(`🚀 B1一括処理開始: ${date}`);
    const ids = await getB1Ids(date);
    console.log(`✅ B1: ${ids.length} 試合発見`);
    
    for (const id of ids) {
        console.log(`\n--- [処理中] GameID: ${id} ---`);
        try {
            // ★ここが「カード生成」の実行スイッチです
            // 1. まずデータを取得
            await fetchGameBoxscore(id); 
            // 2. 次にカードを画像として生成
            await renderPlayers(id); 
            
            console.log(`✅ GameID: ${id} の画像生成が完了しました`);
        } catch (e) {
            console.error(`❌ GameID: ${id} でエラー発生:`, e.message);
        }
    }
    console.log("\n✨ すべての処理が完了しました！ outputフォルダを確認してください。");
}

run();