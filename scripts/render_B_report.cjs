/* scripts/render_B_report.cjs */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

// チームカラーデータの読み込み
const colorData = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "team_colors.json"), "utf8"));
const arenaDict = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "arena.json"), "utf8")) || {};

function getTeamStyle(rawName) {
    const name = String(rawName || "").toUpperCase();

    const aliasKeys = Object.keys(colorData.aliases);

    const exactAliasKey = aliasKeys.find(
        k => name === k.toUpperCase()
    );

    const partialAliasKey = aliasKeys
        .slice()
        .sort((a, b) => b.length - a.length)
        .find(
            k => name.includes(k.toUpperCase())
        );

    const aliasKey =
        exactAliasKey || partialAliasKey;

    const internalKey =
        aliasKey ? colorData.aliases[aliasKey] : null;

    if (internalKey && colorData.teams[internalKey]) {
        const teamInfo = colorData.teams[internalKey];

        const season = process.env.B_REPORT_SEASON || "";
        const seasonMatch = season.match(/^(\d{4})/);
        const seasonStartYear = seasonMatch
            ? Number(seasonMatch[1])
            : null;

        // 仙台89ERS：2024-25以前は旧イエロー
        const isOldSendai =
            internalKey === "Sendai"
            && seasonStartYear !== null
            && seasonStartYear <= 2024;

        // 信州：2026-27から新カラー
        const isNewShinshu =
            internalKey === "Shinshu"
            && seasonStartYear !== null
            && seasonStartYear >= 2026;

        // サンロッカーズ：2026-27からTOKYO SRカラー
        const isNewTokyoSR =
            internalKey === "Shibuya"
            && seasonStartYear !== null
            && seasonStartYear >= 2026;

        // 金沢：2026-27から第2カラーを紫へ変更
        const isNewKanazawa =
            internalKey === "Kanazawa"
            && seasonStartYear !== null
            && seasonStartYear >= 2026;

        if (isOldSendai) {
            return {
                ...teamInfo,
                city: "SENDAI",
                nickname: "89ERS",
                color: "#EFAB00",
                dark: "#D69900",
                color2: "#000000",
                text: "#000000",
                text2: "#FFFFFF"
            };
        }

        if (isNewShinshu) {
            return {
                ...teamInfo,
                city: "SHINSHU",
                nickname: "BRAVE WARRIORS",
                color: "#C5A231",
                dark: "rgba(95, 78, 24, 0.3)",
                color2: "#0F0F13",
                text: "#000000",
                text2: "#FFFFFF"
            };
        }

        if (isNewTokyoSR) {
            return {
                ...teamInfo,
                city: "TOKYO",
                nickname: "SUNROCKERS",
                color: "#392171",
                dark: "rgba(18, 11, 37, 0.3)",
                color2: "#FED100",
                text: "#FFFFFF",
                text2: "#000000"
            };
        }

        if (isNewKanazawa) {
            return {
                ...teamInfo,
                city: (teamInfo.city || "KANAZAWA").toUpperCase(),
                nickname: (teamInfo.nickname || "SAMURAIZ").toUpperCase(),
                color: teamInfo.color || "#C09933",
                dark: teamInfo.dark || "#745C1F",
                color2: "#3C2A77",
                text: teamInfo.text || "#FFFFFF",
                text2: "#FFFFFF"
            };
        }

        return {
            ...teamInfo,
            city: (teamInfo.city || internalKey).toUpperCase(),
            nickname: (teamInfo.nickname || "").toUpperCase(),
            color: teamInfo.color || "#333333",
            dark: teamInfo.dark || teamInfo.color || "#333333",
            color2: teamInfo.color2 || "#000000",
            text: teamInfo.text || "#FFFFFF",
            text2: teamInfo.text2 || "#FFFFFF"
        };
    }

    return {
        color: "#333333",
        dark: "#333333",
        color2: "#000000",
        text: "#FFFFFF",
        text2: "#FFFFFF",
        city: "TEAM",
        nickname: name
    };
}

async function renderBReport(gameId) {
    const dataPath = `/Volumes/HD-CD-1/Masaki/B/BDATALAB APP/data/reports/report_${gameId}.json`;
    if (!fs.existsSync(dataPath)) {
        console.error(`❌ データファイルが見つかりません: ${dataPath}`);
        return;
    }
    const reportData = JSON.parse(fs.readFileSync(dataPath, "utf8"));

    const homeStyle = getTeamStyle(reportData.homeName);
    const awayStyle = getTeamStyle(reportData.awayName);

    // --- マップデータもすべて保持 ---
    const cityNameMap = {
        "SANEN": "SAN-EN",
        "YOKOHAMABC": "YOKOHAMA",
        "CHIBAJ": "CHIBA",
        "ACHIBA": "CHIBA",
        "NAGOYAD": "NAGOYA",
        "FENAGOYA": "NAGOYA",
        "ATOKYO": "TOKYO",
        "YOKOHAMAEX": "YOKOHAMA",
    };

    const specialTeams = {
        "レバンガ北海道": "LEVANGA HOKKAIDO",
        "横浜B・コルセアーズ": "YOKOHAMA B-CORSAIRS",
        "横浜ビー・コルセアーズ": "YOKOHAMA B-CORSAIRS",
        "横浜エクセレンス": "YOKOHAMA EXCELLENCE",
        "三遠ネオフェニックス": "SAN-EN NEOPHOENIX",
        "千葉ジェッツ": "CHIBA JETS",
        "アルティーリ千葉": "ALTIRI CHIBA",
        "名古屋ダイヤモンドドルフィンズ": "NAGOYA DIAMOND DOLPHINS",
        "アルバルク東京": "ALVARK TOKYO",
        "サンロッカーズ渋谷": "SUNROCKERS SHIBUYA",
        "シーホース三河": "SEAHORSES MIKAWA",
        "ファイティングイーグルス名古屋": "FIGHTING EAGLES NAGOYA",
        "ベルテックス静岡": "VELTEX SHIZUOKA",
        "バンビシャス奈良": "BAMBITIOUS NARA",
        "ライジングゼファーフクオカ": "RIZING ZEPHYR FUKUOKA"
    };

    const homeCity = (cityNameMap[homeStyle.city] || homeStyle.city).toUpperCase();
    const awayCity = (cityNameMap[awayStyle.city] || awayStyle.city).toUpperCase();
    const homeNick = homeStyle.nickname.toUpperCase();
    const awayNick = awayStyle.nickname.toUpperCase();

    const getDisplayTeamName = (rawName, style) => {
        return (specialTeams[rawName] || style.fullName || "").toUpperCase();
    };

    let html = fs.readFileSync(path.join(process.cwd(), "template", "B_report.html"), "utf8");

    const calcPct = (m, a) => (a > 0 ? ((m / a) * 100).toFixed(1) : "0.0");
    const calcRatio = (val, total) => (total > 0 ? Math.round((val / total) * 100) : 0);

    const h = reportData.home.total;
    const a = reportData.away.total;

    const hFgm = (h.f2m || 0) + (h.f3m || 0);
    const hFga = (h.f2a || 0) + (h.f3a || 0);
    const aFgm = (a.f2m || 0) + (a.f3m || 0);
    const aFga = (a.f2a || 0) + (a.f3a || 0);

    // --- 勝利時カラーロジックもすべて保持 ---
    const getScoreColor = (teamStyle, currentScore, opponentScore) => {
        const scoreA = Number(currentScore);
        const scoreB = Number(opponentScore);

        if (scoreA <= scoreB) {
            return teamStyle.text || "#FFFFFF";
        }

        const name = (teamStyle.fullName || teamStyle.nickname || "").toUpperCase();
        const city = (teamStyle.city || "").toUpperCase();
        if (city.includes("KAWASAKI") || name.includes("LAKES") || city.includes("SHIGA")) {
            return "#FFD932";
        }
        
        if (name.includes("RYUKYU") || name.includes("琉球") || name.includes("GOLDEN"))
            return "#F27200";
            
        const season = process.env.B_REPORT_SEASON || "";
        const seasonStartYear = Number(
            season.match(/^(\d{4})/)?.[1] || 9999
        );

        const isSendai =
            city.includes("SENDAI")
            || name.includes("SENDAI")
            || name.includes("仙台")
            || name.includes("89ERS");

        if (isSendai)
            return "#F27200";

        const isShinshu =
            city.includes("SHINSHU")
            || name.includes("SHINSHU")
            || name.includes("信州");

        if (isShinshu)
            return "#F27200";

        if (name.includes("GUNMA") || name.includes("群馬") || name.includes("THUNDERS"))
            return "#FEAE00";
            
        return "#FFD932";
    };

    const homeScoreColor = getScoreColor(homeStyle, h.pts, a.pts);
    const awayScoreColor = getScoreColor(awayStyle, a.pts, h.pts);

    const rawVenue = (reportData.venueRaw || "").trim();
    const foundKey = Object.keys(arenaDict).find(key => rawVenue.includes(key));
    const venueEn = foundKey ? arenaDict[foundKey] : rawVenue.replace("Venue: ", "");

    const replacements = {
        "__HOME_BG__": homeStyle.color,
        "__AWAY_BG__": awayStyle.color,
        "__HOME_COLOR__": homeStyle.color,
        "__HOME_COLOR2__": homeStyle.color2,
        "__AWAY_COLOR__": awayStyle.color,
        "__AWAY_COLOR2__": awayStyle.color2,
        "__HOME_TEXT__": homeStyle.text,
        "__AWAY_TEXT__": awayStyle.text,
        "__HOME_TEXT2__": homeStyle.text2,
        "__AWAY_TEXT2__": awayStyle.text2,
        "__HOME_DARK__": homeStyle.dark,
        "__AWAY_DARK__": awayStyle.dark,
        "__HOME_CITY__": homeCity,
        "__HOME_NICK__": homeNick,
        "__AWAY_CITY__": awayCity,
        "__AWAY_NICK__": awayNick,
        "__HOME_SCORE__": h.pts || 0,
        "__AWAY_SCORE__": a.pts || 0,
        "__HOME_SCORE_COLOR__": homeScoreColor,
        "__AWAY_SCORE_COLOR__": awayScoreColor,
        "__DATE__": String(reportData.date || "").replace(/-/g, "."),
        "__ATTENDANCE__": Number(reportData.attendance || 0).toLocaleString(),
        "__VENUE__": reportData.venue || reportData.venueRaw || "",
        "__LEAGUE_TYPE__": reportData.leagueType || "",
        "__ROUND__": reportData.round || "",

        "__H_FGPCT__": calcPct(hFgm, hFga), "__H_FGSTR__": `${hFgm} - ${hFga}`,
        "__H_2FGPCT__": calcPct(h.f2m, h.f2a), "__H_2FGSTR__": `${h.f2m} - ${h.f2a}`,
        "__H_3FGPCT__": calcPct(h.f3m, h.f3a), "__H_3FGSTR__": `${h.f3m} - ${h.f3a}`,
        "__H_FTPCT__": calcPct(h.ftm, h.fta), "__H_FTSTR__": `${h.ftm} - ${h.fta}`,
        "__H_REB__": h.reb || 0, "__H_OREB__": h.oreb || 0, "__H_DREB__": h.dreb || 0,
        "__H_AST__": h.ast || 0, "__H_TOV__": h.tov || 0, "__H_STL__": h.stl || 0, "__H_BLK__": h.blk || 0, "__H_PF__": h.pf || 0,
        "__H_ATT_2P__": calcRatio(h.f2a, hFga), "__H_ATT_3P__": calcRatio(h.f3a, hFga),

        "__A_FGPCT__": calcPct(aFgm, aFga), "__A_FGSTR__": `${aFgm} - ${aFga}`,
        "__A_2FGPCT__": calcPct(a.f2m, a.f2a), "__A_2FGSTR__": `${a.f2m} - ${a.f2a}`,
        "__A_3FGPCT__": calcPct(a.f3m, a.f3a), "__A_3FGSTR__": `${a.f3m} - ${a.f3a}`,
        "__A_FTPCT__": calcPct(a.ftm, a.fta), "__A_FTSTR__": `${a.ftm} - ${a.fta}`,
        "__A_REB__": a.reb || 0, "__A_OREB__": a.oreb || 0, "__A_DREB__": a.dreb || 0,
        "__A_AST__": a.ast || 0, "__A_TOV__": a.tov || 0, "__A_STL__": a.stl || 0, "__A_BLK__": a.blk || 0, "__A_PF__": a.pf || 0,
        "__A_ATT_2P__": calcRatio(a.f2a, aFga), "__A_ATT_3P__": calcRatio(a.f3a, aFga),
    };

    const makeStarters = (list, isAway = false) => {
        const style = isAway ? awayStyle : homeStyle;
        const numBg = style.color; 
        const numText = style.text; // ここを text に統一済み

        const playerNameMap = {
            "飯尾 文哉": "Fumiya Iio",
            "飯尾文哉": "Fumiya Iio",
            "ダリアス・デイズ": "Darius Days",
            "スティーブ・ザック": "Steve Zack",
            "ジョーダン・ダラス": "Jordan Dallas",
            "小寺 ハミルトンゲイリー": "Hamiltongary Kotera",
            "フランク・カミンスキー": "Frank Kaminsky",
            "ケーレブ・ターズースキー": "Kaleb Tarczewski",
            "平 寿哉": "Toshiya Taira",
            "ショーン・オマラ": "Sean O'mara",
            "ドゥシャン・リスティッチ": "Dusan Ristic",
            "ドウェイン・エバンス": "Dwayne Evans II",
            "Dwayne Evans Ii": "Dwayne Evans II"
        };
        
        const toTitleCase = (str) => {
            if (!str) return "";
            return str.toLowerCase().split(' ').map(word => 
                word.charAt(0).toUpperCase() + word.slice(1)
            ).join(' ');
        };

        const japanesePattern =
            /[\u3040-\u30FF\u3400-\u9FFF\u3005-\u3007]/;

        return (list || []).map(s => {
            let displayName =
                playerNameMap[s.name]
                || playerNameMap[s.nameJp]
                || s.name
                || "";

            displayName = displayName.trim();

            if (!displayName || japanesePattern.test(displayName)) {
                throw new Error(
                    `スタメン名を英字へ変換できません: ${s.nameJp || s.name || "UNKNOWN"}`
                );
            }

            displayName = toTitleCase(displayName);

            return `
            <div class="player-row" style="color: ${isAway ? '#FFFFFF' : homeStyle.text}">
                <div class="p-num" style="background:${numBg}; color:${numText}">${s.no || ""}</div>
                <div class="p-name">${displayName}</div>
                <div class="p-stats">
                    <span class="p-min">${s.min || ""}</span>
                    <span class="p-val">${s.pts || 0}</span>
                    <span class="p-val">${s.reb || 0}</span>
                    <span class="p-val">${s.ast || 0}</span>
                </div>
            </div>`;
        }).join("");
    };

    replacements["__HOME_STARTERS_HTML__"] = makeStarters(reportData.home.starters, false);
    replacements["__AWAY_STARTERS_HTML__"] = makeStarters(reportData.away.starters, true);

    Object.keys(replacements).forEach(key => {
        html = html.split(key).join(String(replacements[key] ?? ""));
    });

    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1200, height: 1653 });
    await page.setContent(html);

    // --- CSS設定もすべて保持 ---
    await page.addStyleTag({
    content: `
        .info-value { display: inline-block !important; width: auto !important; max-width: 520px !important; overflow: visible !important; }
        .home, .home-row { background-color: ${homeStyle.color} !important; color: ${homeStyle.text} !important; }
        .away, .away-row { background-color: ${awayStyle.color} !important; color: ${awayStyle.text} !important; }
        .val-sub { opacity: 1.0 !important; color: inherit !important; margin-top: 14px !important; }
        .city-part, .nick-part { text-transform: uppercase !important; color: inherit !important; position: relative; z-index: 5; }
        .home-row *, .away-row * { color: inherit !important; }
        .home .score-val { color: ${homeScoreColor} !important; }
        .away .score-val { color: ${awayScoreColor} !important; }
        .p-name { text-transform: none !important; color: #FFFFFF !important; }
        .p-stats, .p-stats *, .p-min, .p-val, .stat-header { color: #FFFFFF !important; }
        #home-starters .p-num { background: ${homeStyle.color} !important; color: ${homeStyle.text} !important; }
        #away-starters .p-num { background: ${awayStyle.color} !important; color: ${awayStyle.text} !important; }
        .h-2p-val { color: ${homeStyle.text} !important; }
        .h-3p-val { color: ${homeStyle.text2} !important; }
        .a-2p-val { color: ${awayStyle.text} !important; }
        .a-3p-val { color: ${awayStyle.text2} !important; }
        .legend-item, .pie-legend { color: #FFFFFF !important; }
    `
    });

    // STARTING 5: Canvasで実際の文字幅を測り、長い名前だけ確実に収める
    await page.evaluate(() => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const maxWidth = 260;

        document.querySelectorAll(".p-name").forEach(el => {
            const style = getComputedStyle(el);
            const family = style.fontFamily;
            const weight = style.fontWeight;
            const text = el.textContent || "";

            let size = 24;
            let spacing = 2.4;

            const measure = () => {
                ctx.font = `${weight} ${size}px ${family}`;
                const base = ctx.measureText(text).width;
                return base + Math.max(0, text.length - 1) * spacing;
            };

            while (measure() > maxWidth && spacing > -1.5) {
                spacing -= 0.1;
            }

            while (measure() > maxWidth && size > 17) {
                size -= 0.5;
            }

            el.style.fontSize = `${size}px`;
            el.style.letterSpacing = `${spacing}px`;
        });
    });

    // B.PREMIERは2026-27以降「節」の概念がないためROUND BOXを非表示
    const roundSeason = process.env.B_REPORT_SEASON || "";
    const roundSeasonStartYear = Number(
        roundSeason.match(/^(\d{4})/)?.[1] || 0
    );
    if (
        reportData.leagueType === "B.PREMIER" &&
        roundSeasonStartYear >= 2026
    ) {
        await page.addStyleTag({
            content: ".round-badge { display: none !important; }"
        });
    }

    const chartData = {
        h: { r2: (h.f2m||0)*2, r3: (h.f3m||0)*3, rf: (h.ftm||0), p3: parseFloat(calcPct(h.f3m, h.f3a)), text2: homeStyle.text2 },
        a: { r2: (a.f2m||0)*2, r3: (a.f3m||0)*3, rf: (a.ftm||0), p3: parseFloat(calcPct(a.f3m, a.f3a)), text2: awayStyle.text2 }
    };

    await page.waitForFunction(
        () =>
            typeof window.Chart !== "undefined" &&
            typeof window.ChartDataLabels !== "undefined" &&
            typeof window.drawReportCharts === "function",
        { timeout: 15000 }
    );

    await page.evaluate((d) => {
        window.drawReportCharts(d);
    }, chartData);

    await page.waitForTimeout(500);

    const dateObj = new Date(reportData.date);
    const dateStr = `${dateObj.getFullYear()}${String(dateObj.getMonth() + 1).padStart(2, '0')}${String(dateObj.getDate()).padStart(2, '0')}`;
    const fileName = `${dateStr}_${gameId}_${(homeStyle.nickname || "HOME").replace(/\s+/g, '')}_${(awayStyle.nickname || "AWAY").replace(/\s+/g, '')}.png`;

    const season = process.env.B_REPORT_SEASON || "";
    const stage = process.env.B_REPORT_STAGE || "";

    let outPath;

    if (season && stage) {
        const rawLeague = reportData.leagueType || "B";

        const league =

            stage === "Championship" && rawLeague === "B"

                ? "B1"

                : rawLeague;
        const dateFolder = dateStr.slice(2);

        outPath = path.join(
            "/Volumes/HD-CD-1/Masaki/B/BDATALAB APP/output/Game Reports",
            league,
            season,
            stage,
            dateFolder
        );
    } else {
        outPath =
            "/Volumes/HD-CD-1/Masaki/B/BDATALAB APP/output/reports";
    }

    if (!fs.existsSync(outPath)) {
        fs.mkdirSync(outPath, { recursive: true });
    }

    await page.screenshot({
        path: path.join(outPath, fileName)
    });
    await browser.close();
    console.log(`✅ レポート生成完了: ${fileName}`);
}

module.exports = { renderBReport };