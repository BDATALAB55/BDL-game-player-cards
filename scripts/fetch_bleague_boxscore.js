const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

function loadJsonData(filename) {
    const p = path.join(process.cwd(), "data", filename);
    return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : null;
}
const arenaDict = loadJsonData("arena.json") || {};

async function fetchGameBoxscore(gameId) {
    const outDir = path.join(process.cwd(), "data", "raw");
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        viewport: { width: 1280, height: 800 }
    });
    const page = await context.newPage();

    try {
        console.log(`[ID:${gameId}] データを取得中...`);
        
        await page.goto(`https://www.bleague.jp/game_detail/?ScheduleKey=${gameId}&tab=1`, { 
            waitUntil: "networkidle", 
            timeout: 60000 
        });

        await Promise.all([
            // 観客数に「人」という文字が含まれるまで待つ
            page.waitForFunction(() => {
                const el = document.querySelector(".attendance");
                return el && el.innerText.includes("人");
            }, { timeout: 20000 }).catch(() => console.log("⚠️ Attendance text not found")),

            // 会場名が空でなくなるまで待つ
            page.waitForFunction(() => {
                const el = document.querySelector(".stadium-name");
                return el && el.innerText.trim().length > 0;
            }, { timeout: 20000 }).catch(() => console.log("⚠️ Venue text not found")),

            // パンくずリストに日付（数字/数字/数字）が現れるまで待つ
            page.waitForFunction(() => {
                const el = document.querySelector(".breadcrumb");
                return el && /\d{1,4}\/\d{1,2}\/\d{1,2}/.test(el.innerText);
            }, { timeout: 20000 }).catch(() => console.log("⚠️ Date text not found")),

            // 節（ROUND）の数字が現れるまで待つ
            page.waitForFunction(() => {
                const el = document.querySelector(".game-top .time-wrap p.part");
                return el && /\d+/.test(el.innerText);
            }, { timeout: 20000 }).catch(() => console.log("⚠️ Round text not found"))
        ]);

        // 最後に、JavaScriptの反映を待つための安定時間を3秒確保
        await page.waitForTimeout(3000);
        
        const baseInfo = await page.evaluate(() => {

          // --- 補助関数：要素が現れるまで待つ ---
            const delay = ms => new Promise(res => setTimeout(res, ms));

            // --- 1. 共通で使用する要素の定義 ---
            const breadcrumbEl = document.querySelector(".breadcrumb-list") || document.querySelector(".breadcrumb");
            const breadcrumbText = breadcrumbEl ? breadcrumbEl.innerText : "";
            const partEl = document.querySelector(".game-top .time-wrap p.part");
            const scheduleInfo = partEl ? partEl.innerText : "";
            const stadiumNode = document.querySelector(".stadium-name");

            // --- 2. 観客数の取得 ---
            const attEl = document.querySelector(".attendance");
            const attText = attEl ? attEl.innerText : "";
            const attMatch = attText.match(/([\d,]+)/);
            const attendance = attMatch ? attMatch[1].replace(/,/g, "") : "0";
            
            // --- 3. 会場名の取得 ---
            const venueRaw = stadiumNode ? stadiumNode.innerText.trim() : "VENUE_MISSING";

            // --- 4. DATEの取得（失敗時はMISSING） ---
            const dtMatch = breadcrumbText.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
            const dateVal = dtMatch 
                ? `${dtMatch[1]}.${dtMatch[2].padStart(2,'0')}.${dtMatch[3].padStart(2,'0')}` 
                : "DATE_MISSING";

            // --- 5. LEAGUE_TYPEの取得 ---
            let leagueType = "LEAGUE_MISSING";
            const leagueMatch = breadcrumbText.match(/B[1-3]/);
            if (leagueMatch) leagueType = leagueMatch[0];

            // --- 6. ROUNDの取得（シンプル版：その場で再取得） ---
            let roundStr = "ROUND_MISSING";
            
            // 変数に頼らず、document.querySelector をここで直接実行する
            const roundTarget = document.querySelector(".game-top .time-wrap p.part");
            
            if (roundTarget && roundTarget.innerText.trim() !== "") {
                const sm = roundTarget.innerText.match(/\d+/);
                if (sm) {
                    roundStr = `ROUND${sm[0]}`;
                }
            } else {
                // 保険：パンくずリスト（breadcrumbText）からも数字を探す
                const smBackup = breadcrumbText.match(/第\s*(\d+)\s*節/);
                if (smBackup) {
                    roundStr = `ROUND${smBackup[1]}`;
                }
            }

            // --- 7. 【重要】すべての計算が終わってから最後に return する ---
            return { attendance, date: dateVal, round: roundStr, venueRaw, leagueType };
            });

        // --- tab=4 (スタッツ) 以降のロジックは一切変更なし ---
        await page.waitForTimeout(2000);
        await page.goto(`https://www.bleague.jp/game_detail/?ScheduleKey=${gameId}&tab=4`, { 
            waitUntil: "networkidle", 
            timeout: 60000 
        });

        const statsData = await page.evaluate(() => {
            const teams = document.querySelectorAll('.team-name');
            const hName = teams[0]?.innerText.trim() || "";
            const aName = teams[1]?.innerText.trim() || "";
            const tables = Array.from(document.querySelectorAll("table")).filter(t => t.innerText.includes("MIN")).slice(0, 2);
            const players = [];
            let scoreHome = 0, scoreAway = 0;

            tables.forEach((table, idx) => {
                const isHome = (idx === 0);
                table.querySelectorAll("tbody tr").forEach(row => {
                    const c = Array.from(row.querySelectorAll("td, th")).map(td => td.innerText.trim());
                    if (c.length > 15 && /^\d+$/.test(c[0])) {
                        const pts = parseInt(c[5]) || 0;
                        if (isHome) scoreHome += pts; else scoreAway += pts;
                        if (c[4] !== "00:00" && !c[4].includes("DNP")) {

                          const f2m = parseInt(c[9]) || 0;  // 2FG成功
                            const f2a = parseInt(c[10]) || 0; // 2FG試投
                            const f3m = parseInt(c[12]) || 0; // 3FG成功
                            const f3a = parseInt(c[13]) || 0; // 3FG試投
                            const ftm = parseInt(c[15]) || 0; // FT成功
                            const fta = parseInt(c[16]) || 0; // FT試投

                            const totalPts = (f2m * 2) + (f3m * 3) + ftm;
                            const totalAtt = f2a + f3a;

                            players.push({
                                teamNameRaw: isHome ? hName : aName,
                                no: c[0], 
                                isStarter: row.innerText.includes("〇"), 
                                nameJp: c[2],
                                detailUrl: row.querySelector("a")?.href, 
                                min: c[4], 
                                pts: pts.toString(),
                                fg2Str: `${f2m}/${f2a}`,
                                fg2Pct: (c[11]||"0").replace('%',''),
                                fg3Str: `${f3m}/${f3a}`,
                                fg3Pct: (c[14]||"0").replace('%',''),
                                ftStr: `${ftm}/${fta}`,
                                ftPct: (c[17]||"0").replace('%',''),
                                // 得点内訳 (PTS RATIO)
                                ptsRatio2P: totalPts > 0 ? Math.round(((f2m * 2) / totalPts) * 100).toString() : "0",
                                ptsRatio3P: totalPts > 0 ? Math.round(((f3m * 3) / totalPts) * 100).toString() : "0",
                                ptsRatioFT: totalPts > 0 ? Math.round((ftm / totalPts) * 100).toString() : "0",

                                // 試投割合 (Attempt RATIO)
                                attRatio2P: totalAtt > 0 ? Math.round((f2a / totalAtt) * 100).toString() : "0",
                                attRatio3P: totalAtt > 0 ? Math.round((f3a / totalAtt) * 100).toString() : "0",

                                reb: c[22], 
                                oreb: c[20]||"0", 
                                dreb: c[21]||"0",
                                ast: c[23], 
                                stl: c[26], 
                                blk: c[27], 
                                to: c[25], 
                                pf: c[29], 
                                plusMinus: c[32]
                            });
                        }
                    }
                });
            });
            return { homeName: hName, awayName: aName, scoreHome, scoreAway, players };
        });

        for (let p of statsData.players) {
            if (p.detailUrl) {
                const pPage = await context.newPage();
                try {
                    await pPage.goto(p.detailUrl.replace("/en/", "/"), { waitUntil: "domcontentloaded", timeout: 15000 });
                    const nameEn = await pPage.evaluate(() => {
                        const bodyText = document.body.innerText;
                        const regex = /#\d+\s+([A-Z][a-zA-Z\s\.\-\n]+?)(?:\s+[ぁ-んァ-ヶー一-龠]|$)/;
                        const m = bodyText.match(regex);
                        if (m && m[1]) {
                            let name = m[1].replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
                            return name.split(/\s(?:PPG|APG|RPG|BPG|SPG)/)[0].toUpperCase();
                        }
                        return null;
                    });
                    p.name = nameEn || p.nameJp.toUpperCase();
                } catch (e) { p.name = p.nameJp.toUpperCase(); }
                await pPage.close();
            } else { p.name = p.nameJp.toUpperCase(); }
        }

        const rawV = baseInfo.venueRaw;
        // 1. 生データから不要なラベルを消して綺麗にする
        // 「Venue:」や「会場：」、スペースをすべて消します
        const cleanRaw = rawV.replace(/Venue:/i, "").replace(/会場[:：]/, "").replace(/\s+/g, ' ').trim();
        const normalizedRaw = cleanRaw.replace(/\s+/g, '').toLowerCase();
        
        let venueEn = "";

        const sortedKeys = Object.keys(arenaDict).sort((a, b) => b.length - a.length);
        
        const foundKey = sortedKeys.find(key => {
            const cleanKey = key.replace(/\s+/g, '').toLowerCase();
            const cleanValue = arenaDict[key].replace(/\s+/g, '').toLowerCase();
            // 名前がぴったり一致、または辞書の英語名とぴったり一致する場合
            return normalizedRaw === cleanKey || normalizedRaw === cleanValue;
        });

        if (foundKey) {
            venueEn = arenaDict[foundKey];
        } else {
            // 2. 部分一致を試みる（名前が長い順にチェックするので誤爆が減る）
            const fallbackKey = sortedKeys.find(key => {
                const cleanKey = key.replace(/\s+/g, '').toLowerCase();
                const cleanValue = arenaDict[key].replace(/\s+/g, '').toLowerCase();
                
                // Arena などの一般的な単語だけで反応しないよう、4文字以上の場合のみ部分一致を許容
                if (cleanKey.length < 4 && normalizedRaw !== cleanKey) return false;
                
                return normalizedRaw.includes(cleanKey) || cleanKey.includes(normalizedRaw);
            });
            venueEn = fallbackKey ? arenaDict[fallbackKey] : "";
        }

        const result = { 
            homeName: statsData.homeName, awayName: statsData.awayName,
            scoreHome: statsData.scoreHome.toString(), scoreAway: statsData.scoreAway.toString(),
            date: baseInfo.date, venue: venueEn, venueRaw: rawV,
            attendance: baseInfo.attendance, leagueType: baseInfo.leagueType,
            round: baseInfo.round, players: statsData.players
        };

        fs.writeFileSync(path.join(outDir, `game_${gameId}.json`), JSON.stringify(result, null, 2));

        console.log(`-----------------------------------------`);
        console.log(`✅ 取得成功: ${result.homeName} vs ${result.awayName}`);
        console.log(`📊 Score:      ${result.scoreHome} - ${result.scoreAway}`);
        console.log(`📅 Date:       ${result.date} / ${result.round}`);
        console.log(`🏟️ Location:   ${result.venue} (Raw: ${result.venueRaw})`);
        console.log(`👥 Attendance: ${Number(result.attendance).toLocaleString()}人`);
        console.log(`-----------------------------------------`);

    } catch (e) { console.error(`❌ エラー:`, e.message); } finally { await browser.close(); }
}

module.exports = { fetchGameBoxscore };
if (require.main === module) { fetchGameBoxscore(process.argv[2]); }