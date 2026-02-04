/* scripts/fetch_B_report.cjs */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

// JSON読み込みのパスも確実にルート基準にする
function loadJsonData(filename) {
    const p = path.join(process.cwd(), "data", filename);
    return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : null;
}
const arenaDict = loadJsonData("arena.json") || {};

async function fetchBReportData(gameId) {
    // 保存先をプロジェクトルート直下の data/reports に設定
    const outDir = path.join(process.cwd(), "data", "reports");
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    });
    const page = await context.newPage();

    try {
        console.log(`[B-REPORT:${gameId}] データを合算モードで取得中...`);
        
        await page.goto(`https://www.bleague.jp/game_detail/?ScheduleKey=${gameId}&tab=1`, { waitUntil: "networkidle" });
        const baseInfo = await page.evaluate(() => {
            const breadcrumb = document.querySelector(".breadcrumb")?.innerText || "";
            const dtMatch = breadcrumb.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
            return {
                attendance: document.querySelector(".attendance")?.innerText.match(/[\d,]+/)?.[0].replace(/,/g, "") || "0",
                date: dtMatch ? `${dtMatch[1]}.${dtMatch[2].padStart(2,'0')}.${dtMatch[3].padStart(2,'0')}` : "",
                venueRaw: document.querySelector(".stadium-name")?.innerText.trim() || "",
                leagueType: breadcrumb.match(/B[1-3]/)?.[0] || "",
                round: document.querySelector(".game-top .time-wrap p.part")?.innerText.match(/\d+/)?.[0] ? `ROUND${document.querySelector(".game-top .time-wrap p.part").innerText.match(/\d+/)[0]}` : "ROUND1"
            };
        });

        await page.goto(`https://www.bleague.jp/game_detail/?ScheduleKey=${gameId}&tab=4`, { waitUntil: "networkidle" });
        const stats = await page.evaluate(() => {
            const parseRow = (row) => {
                if (!row) return null;
                const c = Array.from(row.querySelectorAll("td, th")).map(td => td.innerText.trim());
                if (c.length < 30) return null;
                const oreb = parseInt(c[20]) || 0;
                const dreb = parseInt(c[21]) || 0;
                let reb = parseInt(c[22]) || 0;
                if (reb === 0 && (oreb > 0 || dreb > 0)) reb = oreb + dreb;
                return {
                    no: c[0], nameJp: c[2], min: c[4],
                    pts: parseInt(c[5]) || 0, f2m: parseInt(c[9]) || 0, f2a: parseInt(c[10]) || 0,
                    f3m: parseInt(c[12]) || 0, f3a: parseInt(c[13]) || 0, ftm: parseInt(c[15]) || 0, fta: parseInt(c[16]) || 0,
                    oreb, dreb, reb, ast: parseInt(c[23]) || 0, tov: parseInt(c[25]) || 0,
                    stl: parseInt(c[26]) || 0, blk: parseInt(c[27]) || 0, pf: parseInt(c[29]) || 0,
                    isStarter: row.innerText.includes("〇"), detailUrl: row.querySelector("a")?.href
                };
            };
            const tables = Array.from(document.querySelectorAll("table")).filter(t => t.innerText.includes("MIN")).slice(0, 2);
            const getSideData = (table) => {
                const rows = Array.from(table.querySelectorAll("tbody tr")).map(r => parseRow(r)).filter(p => p);
                const total = rows.reduce((acc, curr) => {
                    acc.pts += curr.pts; acc.f2m += curr.f2m; acc.f2a += curr.f2a;
                    acc.f3m += curr.f3m; acc.f3a += curr.f3a; acc.ftm += curr.ftm; acc.fta += curr.fta;
                    acc.oreb += curr.oreb; acc.dreb += curr.dreb; acc.reb += curr.reb;
                    acc.ast += curr.ast; acc.tov += curr.tov; acc.stl += curr.stl;
                    acc.blk += curr.blk; acc.pf += curr.pf;
                    return acc;
                }, { pts:0, f2m:0, f2a:0, f3m:0, f3a:0, ftm:0, fta:0, oreb:0, dreb:0, reb:0, ast:0, tov:0, stl:0, blk:0, pf:0 });

                const teamRow = Array.from(table.querySelectorAll("tr")).find(r => r.innerText.includes("TEAM / COACHES"));
                
                if (teamRow) {
                    const c = Array.from(teamRow.querySelectorAll("td, th")).map(td => td.innerText.trim());
                    if (c.length >= 30) {
                        const teamOreb = parseInt(c[18]) || 0;
                        const teamDreb = parseInt(c[19]) || 0;
                        const teamTov  = parseInt(c[23]) || 0;
                        const teamPf   = parseInt(c[27]) || 0;

                        total.oreb += teamOreb;
                        total.dreb += teamDreb;
                        total.reb  = total.oreb + total.dreb;
                        total.tov  += teamTov;
                        total.pf   += teamPf;
                    }
                }

                return { total, players: rows.filter(p => !p.nameJp.includes("TEAM")) };
            };
            return {
                hName: document.querySelectorAll('.team-name')[0]?.innerText.trim() || "",
                aName: document.querySelectorAll('.team-name')[1]?.innerText.trim() || "",
                home: getSideData(tables[0]), away: getSideData(tables[1])
            };
        });

        const getStartersWithTitleName = async (sidePlayers) => {
            const starters = [];
            for (let p of sidePlayers) {
                if (p.isStarter) {
                    if (p.detailUrl) {
                        const pPage = await context.newPage();
                        try {
                            await pPage.goto(p.detailUrl, { waitUntil: "domcontentloaded", timeout: 8000 });
                            let rawName = await pPage.evaluate(() => {
                                const m = document.body.innerText.match(/#\d+\s+([A-Z][a-zA-Z\s\.\-\n]+?)(?:\s+[ぁ-んァ-ヶー一-龠]|$)/);
                                if (!m) return null;
                                return m[1].split(/\s(?:PPG|APG|RPG|BPG|SPG)/)[0].replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
                            });

                            if (rawName) {
                                p.name = rawName.toLowerCase().split(' ').map(word => {
                                    return word.charAt(0).toUpperCase() + word.slice(1);
                                }).join(' ');
                                p.name = p.name.replace(/([A-Z]\.)([a-z])/g, (match, p1, p2) => p1 + p2.toUpperCase());
                            } else {
                                p.name = p.nameJp;
                            }
                        } catch (e) { p.name = p.nameJp; }
                        await pPage.close();
                    } else { p.name = p.nameJp; }
                    starters.push(p);
                }
            }
            return starters;
        };

        const rawV = baseInfo.venueRaw;
        const cleanRaw = rawV.replace(/Venue:/i, "").replace(/会場[:：]/, "").replace(/\s+/g, ' ').trim();
        const normalizedRaw = cleanRaw.replace(/\s+/g, '').toLowerCase();
        
        let venueEn = "";
        const sortedKeys = Object.keys(arenaDict).sort((a, b) => b.length - a.length);
        
        const foundKey = sortedKeys.find(key => {
            const cleanKey = key.replace(/\s+/g, '').toLowerCase();
            const cleanValue = arenaDict[key].replace(/\s+/g, '').toLowerCase();
            return normalizedRaw === cleanKey || normalizedRaw === cleanValue;
        });

        if (foundKey) {
            venueEn = arenaDict[foundKey];
        } else {
            const fallbackKey = sortedKeys.find(key => {
                const cleanKey = key.replace(/\s+/g, '').toLowerCase();
                if (cleanKey.length < 4 && normalizedRaw !== cleanKey) return false;
                return normalizedRaw.includes(cleanKey) || cleanKey.includes(normalizedRaw);
            });
            venueEn = fallbackKey ? arenaDict[fallbackKey] : cleanRaw;
        }

        const result = {
            ...baseInfo,
            venue: venueEn,
            homeName: stats.hName, awayName: stats.aName,
            home: { total: stats.home.total, starters: await getStartersWithTitleName(stats.home.players) },
            away: { total: stats.away.total, starters: await getStartersWithTitleName(stats.away.players) }
        };

        fs.writeFileSync(path.join(outDir, `report_${gameId}.json`), JSON.stringify(result, null, 2));
        console.log(`✅ 保存成功: ${result.homeName} (${result.home.total.pts}) vs ${result.awayName} (${result.away.total.pts})`);

    } catch (e) { console.error("❌ エラー:", e.message); } finally { await browser.close(); }
}

module.exports = { fetchBReportData };