/* scripts/fetch_bleague_boxscore.cjs */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

function loadJsonData(filename) {
    const p = path.join(__dirname, "..", "data", filename);
    return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : null;
}
const arenaDict = loadJsonData("arena.json") || {};

function extractJsonArray(htmlText, key) {
    const marker = `"${key}":`;
    const markerIndex = htmlText.indexOf(marker);

    if (markerIndex === -1) {
        throw new Error(
            `${key} が公式ページ内に見つかりません`
        );
    }

    const arrayStart = htmlText.indexOf(
        "[",
        markerIndex + marker.length
    );

    if (arrayStart === -1) {
        throw new Error(
            `${key} の配列開始位置が見つかりません`
        );
    }

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (
        let index = arrayStart;
        index < htmlText.length;
        index += 1
    ) {
        const character = htmlText[index];

        if (inString) {
            if (escaped) {
                escaped = false;
            } else if (character === "\\") {
                escaped = true;
            } else if (character === '"') {
                inString = false;
            }

            continue;
        }

        if (character === '"') {
            inString = true;
            continue;
        }

        if (character === "[") {
            depth += 1;
        } else if (character === "]") {
            depth -= 1;

            if (depth === 0) {
                return JSON.parse(
                    htmlText.slice(
                        arrayStart,
                        index + 1
                    )
                );
            }
        }
    }

    throw new Error(
        `${key} の配列終了位置が見つかりません`
    );
}

function normalizeEnglishName(value) {
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/'/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .toUpperCase();
}

async function fetchGameBoxscore(gameId) {
    const outDir = "/Volumes/HD-CD-1/Masaki/B/BDATALAB APP/data/reports"; 
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
            page.waitForFunction(() => {
                const el = document.querySelector(".attendance");
                const scope = el?.parentElement;
                return scope && /Attendance:[^\d]*[\d,]+/i.test(scope.innerText);
            }, { timeout: 20000 }).catch(() => console.log("⚠️ Attendance text not found")),
            page.waitForFunction(() => {
                const el = document.querySelector(".stadium-name");
                return el && el.innerText.trim().length > 0;
            }, { timeout: 20000 }).catch(() => console.log("⚠️ Venue text not found")),
            page.waitForFunction(() => {
                const el = document.querySelector(".breadcrumb");
                return el && /\d{1,4}\/\d{1,2}\/\d{1,2}/.test(el.innerText);
            }, { timeout: 20000 }).catch(() => console.log("⚠️ Date text not found")),
            page.waitForFunction(() => {
                const el = document.querySelector(".game-top .time-wrap p.part");
                return el && /\d+/.test(el.innerText);
            }, { timeout: 20000 }).catch(() => console.log("⚠️ Round text not found"))
        ]);

        await page.waitForTimeout(3000);
        
        const baseInfo = await page.evaluate(() => {
            const breadcrumbEl = document.querySelector(".breadcrumb-list") || document.querySelector(".breadcrumb");
            const breadcrumbText = breadcrumbEl ? breadcrumbEl.innerText : "";
            const stadiumNode = document.querySelector(".stadium-name");
            const attEl = document.querySelector(".attendance");
            const attHtml = attEl?.outerHTML || "";
            const sourceMatch = attHtml.match(/人数[：:]\s*([\d,]+)人/);

            const attScope = attEl?.parentElement;
            const attText = attScope ? attScope.innerText : "";
            const displayMatch = attText.match(/Attendance:[^\d]*([\d,]+)/i);

            const attendance = sourceMatch
                ? sourceMatch[1].replace(/,/g, "")
                : displayMatch
                    ? displayMatch[1].replace(/,/g, "")
                    : "";
            const venueRaw = stadiumNode ? stadiumNode.innerText.trim() : "VENUE_MISSING";
            const dtMatch = breadcrumbText.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
            const dateVal = dtMatch 
                ? `${dtMatch[1]}.${dtMatch[2].padStart(2,'0')}.${dtMatch[3].padStart(2,'0')}` 
                : "DATE_MISSING";
            let leagueType = "LEAGUE_MISSING";
            const normalizedLeagueText = breadcrumbText.toUpperCase();

            if (/B\.LEAGUE\s+PREMIER/.test(normalizedLeagueText)) {
                leagueType = "B.PREMIER";
            } else if (/B\.LEAGUE\s+ONE/.test(normalizedLeagueText)) {
                leagueType = "B.ONE";
            } else if (/B\.LEAGUE\s+NEXT/.test(normalizedLeagueText)) {
                leagueType = "B.NEXT";
            } else {
                const leagueMatch = breadcrumbText.match(/\bB[1-3]\b/);
                if (leagueMatch) leagueType = leagueMatch[0];
            }
            let roundStr = "ROUND_MISSING";
            const roundTarget = document.querySelector(".game-top .time-wrap p.part");
            if (roundTarget && roundTarget.innerText.trim() !== "") {
                const sm = roundTarget.innerText.match(/\d+/);
                if (sm) roundStr = `ROUND${sm[0]}`;
            } else {
                const smBackup = breadcrumbText.match(/第\s*(\d+)\s*節/);
                if (smBackup) roundStr = `ROUND${smBackup[1]}`;
            }
            return { attendance, date: dateVal, round: roundStr, venueRaw, leagueType };
        });

        await page.waitForTimeout(2000);
        await page.goto(`https://www.bleague.jp/game_detail/?ScheduleKey=${gameId}&tab=4`, { 
            waitUntil: "networkidle", 
            timeout: 60000 
        });

        const boxscoreHtml = await page.content();

        const officialBoxscores = [
            ...extractJsonArray(
                boxscoreHtml,
                "HomeBoxscores"
            ),
            ...extractJsonArray(
                boxscoreHtml,
                "AwayBoxscores"
            )
        ];

        const englishNameByPlayer = new Map(
            officialBoxscores.map(row => [
                [
                    String(
                        row.TeamNameJ || ""
                    ).trim(),
                    String(
                        row.PlayerNo || ""
                    ).trim(),
                    String(
                        row.PlayerNameJ || ""
                    ).trim()
                ].join("|"),
                normalizeEnglishName(
                    row.PlayerNameE
                )
            ])
        );

        // BOX SCOREの選手行よりtfoot TOTALの描画が遅れるため、
        // フルゲーム先頭2テーブルのTOTAL行が揃ってから取得する。
        try {
            await page.waitForFunction(() => {
                const tables = Array.from(document.querySelectorAll("table"))
                    .filter(t => t.innerText.includes("MIN"))
                    .slice(0, 2);

                if (tables.length < 2) return false;

                return tables.every(table =>
                    Array.from(table.querySelectorAll("tfoot tr")).some(row => {
                        const firstCell = row.querySelector("td, th");
                        return ["total", "合計"].includes(
                            (firstCell?.innerText || "").trim().toLowerCase()
                        );
                    })
                );
            }, { timeout: 10000 });
        } catch {
            console.warn(`[ID:${gameId}] ⚠️ 公式TOTAL行の描画待機がタイムアウトしました`);
        }


        let statsData = await page.evaluate(() => {
            const teams = document.querySelectorAll('.team-name');
            const hName = teams[0]?.innerText.trim() || "";
            const aName = teams[1]?.innerText.trim() || "";
            const tables = Array.from(document.querySelectorAll("table")).filter(t => t.innerText.includes("MIN")).slice(0, 2);
            const players = [];
            let scoreHome = 0, scoreAway = 0;
            let homeTotal = null, awayTotal = null;

            tables.forEach((table, idx) => {
                const isHome = (idx === 0);

                // GAME REPORTのTEAM STATSは、個人値の合算ではなく
                // 公式BOX SCOREの試合TOTALを正として使用する。
                const totalRow = Array.from(table.querySelectorAll("tfoot tr"))
                    .find(row => {
                        const firstCell = row.querySelector("td, th");
                        return ["total", "合計"].includes(
                            (firstCell?.innerText || "").trim().toLowerCase()
                        );
                    });

                if (totalRow) {
                    const tc = Array.from(totalRow.querySelectorAll("td, th"))
                        .map(td => td.innerText.trim());

                    const readInt = index => {
                        const raw = tc[index];
                        if (raw == null || raw === "") return null;
                        const value = Number.parseInt(raw, 10);
                        return Number.isFinite(value) ? value : null;
                    };

                    const officialTotal = {
                        pts:  readInt(3),
                        f2m:  readInt(7),
                        f2a:  readInt(8),
                        f3m:  readInt(10),
                        f3a:  readInt(11),
                        ftm:  readInt(13),
                        fta:  readInt(14),
                        oreb: readInt(18),
                        dreb: readInt(19),
                        reb:  readInt(20),
                        ast:  readInt(21),
                        tov:  readInt(23),
                        stl:  readInt(24),
                        blk:  readInt(25),
                        pf:   readInt(27)
                    };

                    if (Object.values(officialTotal).every(Number.isFinite)) {
                        if (isHome) homeTotal = officialTotal;
                        else awayTotal = officialTotal;
                    }
                }

                table.querySelectorAll("tbody tr").forEach(row => {
                    const c = Array.from(row.querySelectorAll("td, th")).map(td => td.innerText.trim());
                    if (c.length > 15 && /^\d+$/.test(c[0])) {
                        const pts = parseInt(c[5]) || 0;
                        if (isHome) scoreHome += pts; else scoreAway += pts;
                        if (c[4] !== "00:00" && !c[4].includes("DNP")) {
                            const f2m = parseInt(c[9]) || 0;
                            const f2a = parseInt(c[10]) || 0;
                            const f3m = parseInt(c[12]) || 0;
                            const f3a = parseInt(c[13]) || 0;
                            const ftm = parseInt(c[15]) || 0;
                            const fta = parseInt(c[16]) || 0;
                            const totalPts = (f2m * 2) + (f3m * 3) + ftm;
                            const totalAtt = f2a + f3a;

                            players.push({
                                teamNameRaw: isHome ? hName : aName,
                                no: c[0], isStarter: row.innerText.includes("〇"), nameJp: c[2],
                                detailUrl: row.querySelector("a")?.href, min: c[4], pts: pts.toString(),
                                fg2Str: `${f2m}/${f2a}`, fg2Pct: (c[11]||"0").replace('%',''),
                                fg3Str: `${f3m}/${f3a}`, fg3Pct: (c[14]||"0").replace('%',''),
                                ftStr: `${ftm}/${fta}`, ftPct: (c[17]||"0").replace('%',''),
                                ptsRatio2P: totalPts > 0 ? Math.round(((f2m * 2) / totalPts) * 100).toString() : "0",
                                ptsRatio3P: totalPts > 0 ? Math.round(((f3m * 3) / totalPts) * 100).toString() : "0",
                                ptsRatioFT: totalPts > 0 ? Math.round((ftm / totalPts) * 100).toString() : "0",
                                attRatio2P: totalAtt > 0 ? Math.round((f2a / totalAtt) * 100).toString() : "0",
                                attRatio3P: totalAtt > 0 ? Math.round((f3a / totalAtt) * 100).toString() : "0",
                                reb: c[22], oreb: c[20]||"0", dreb: c[21]||"0", ast: c[23], stl: c[26], blk: c[27], to: c[25], pf: c[29], plusMinus: c[32]
                            });
                        }
                    }
                });
            });
            return {
                homeName: hName,
                awayName: aName,
                scoreHome,
                scoreAway,
                players,
                homeTotal,
                awayTotal
            };
        });


        const missingEnglishNames = [];

        for (const player of statsData.players) {
            const playerKey = [
                String(
                    player.teamNameRaw || ""
                ).trim(),
                String(
                    player.no || ""
                ).trim(),
                String(
                    player.nameJp || ""
                ).trim()
            ].join("|");

            const englishName =
                englishNameByPlayer.get(playerKey);

            if (!englishName) {
                missingEnglishNames.push(
                    [
                        player.teamNameRaw,
                        `#${player.no}`,
                        player.nameJp
                    ].join(" ")
                );

                continue;
            }

            player.name = englishName;
        }

        if (missingEnglishNames.length > 0) {
            throw new Error(
                "英語名を取得できない選手があります: " +
                missingEnglishNames.join(", ")
            );
        }

        // --- 集計処理 ---
        const calcTeamData = (pList, teamName) => {
            const tPlayers = pList.filter(p => p.teamNameRaw === teamName);
            const total = { pts:0, f2m:0, f2a:0, f3m:0, f3a:0, ftm:0, fta:0, reb:0, oreb:0, dreb:0, ast:0, tov:0, stl:0, blk:0, pf:0 };
            tPlayers.forEach(p => {
                total.pts += parseInt(p.pts || 0);
                const f2 = (p.fg2Str||"0/0").split("/"); total.f2m += parseInt(f2[0]); total.f2a += parseInt(f2[1]);
                const f3 = (p.fg3Str||"0/0").split("/"); total.f3m += parseInt(f3[0]); total.f3a += parseInt(f3[1]);
                const ft = (p.ftStr||"0/0").split("/"); total.ftm += parseInt(ft[0]); total.fta += parseInt(ft[1]);
                total.reb += parseInt(p.reb || 0); total.oreb += parseInt(p.oreb || 0); total.dreb += parseInt(p.dreb || 0);
                total.ast += parseInt(p.ast || 0); total.tov += parseInt(p.to || 0); total.stl += parseInt(p.stl || 0);
                total.blk += parseInt(p.blk || 0); total.pf += parseInt(p.pf || 0);
            });
            return { total, starters: tPlayers.filter(p => p.isStarter) };
        };

        const homeCalculated = calcTeamData(statsData.players, statsData.homeName);
        const awayCalculated = calcTeamData(statsData.players, statsData.awayName);

        const homeData = {
            ...homeCalculated,
            total: statsData.homeTotal || homeCalculated.total
        };
        const awayData = {
            ...awayCalculated,
            total: statsData.awayTotal || awayCalculated.total
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
            if (fallbackKey) {
                venueEn = arenaDict[fallbackKey];
            } else {
                const containsJapanese =
                    /[\u3040-\u30FF\u3400-\u9FFF]/.test(
                        cleanRaw
                    );

                const containsEnglish =
                    /[A-Za-z]/.test(cleanRaw);

                venueEn =
                    !containsJapanese && containsEnglish
                        ? cleanRaw
                        : "";
            }
        }

        const result = { 
            homeName: statsData.homeName, awayName: statsData.awayName,
            scoreHome: statsData.scoreHome.toString(), scoreAway: statsData.scoreAway.toString(),
            date: baseInfo.date, venue: venueEn, venueRaw: rawV,
            attendance: baseInfo.attendance, leagueType: baseInfo.leagueType,
            round: baseInfo.round,
            home: homeData,
            away: awayData,
            players: statsData.players
        };

        const fileName = `report_${gameId}.json`;
        fs.writeFileSync(`${outDir}/${fileName}`, JSON.stringify(result, null, 2));
        console.log(`-----------------------------------------`);
        console.log(`✅ 取得成功: ${result.homeName} vs ${result.awayName}`);
        console.log(`-----------------------------------------`);

    } catch (e) {
        console.error(
            `❌ GameID ${gameId} 取得エラー:`,
            e.message
        );
        throw e;
    } finally {
        await browser.close();
    }
}

module.exports = { fetchGameBoxscore };
if (require.main === module) { fetchGameBoxscore(process.argv[2]); }