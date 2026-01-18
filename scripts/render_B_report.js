const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

// チームカラーデータの読み込み
const colorData = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "team_colors.json"), "utf8"));
const arenaDict = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "arena.json"), "utf8")) || {};

function getTeamStyle(rawName) {
    const name = String(rawName || "").toUpperCase();
    const aliasKey = Object.keys(colorData.aliases).find(k => name.includes(k.toUpperCase()));
    const internalKey = aliasKey ? colorData.aliases[aliasKey] : null;

    if (internalKey && colorData.teams[internalKey]) {
        const teamInfo = colorData.teams[internalKey];
        return {
            ...teamInfo,
            city: internalKey.toUpperCase(),
                nickname: (teamInfo.nickname || "").toUpperCase(),
                color: teamInfo.color || "#333333",
                color2: teamInfo.color2 || "#000000",
                text: teamInfo.text || "#FFFFFF", // ここを textColor ではなく text に修正
                text2: teamInfo.text2 || "#FFFFFF"
        };
    }
    return { color: "#333333", text: "#FFFFFF", city: "TEAM", nickname: name };
}

async function renderBReport(gameId) {
    const dataPath = path.join(process.cwd(), "data", "reports", `report_${gameId}.json`);
    if (!fs.existsSync(dataPath)) {
        console.error(`❌ データファイルが見つかりません: ${dataPath}`);
        return;
    }
    const reportData = JSON.parse(fs.readFileSync(dataPath, "utf8"));

    const homeStyle = getTeamStyle(reportData.homeName);
    const awayStyle = getTeamStyle(reportData.awayName);

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

    // 選手が所属するチームのフルネーム表示用（特殊マップ優先）
    const getDisplayTeamName = (rawName, style) => {
        return (specialTeams[rawName] || style.fullName || "").toUpperCase();
    };

    let html = fs.readFileSync(path.join(process.cwd(), "template", "B_report.html"), "utf8");

    // 計算補助関数
    const calcPct = (m, a) => (a > 0 ? ((m / a) * 100).toFixed(1) : "0.0");
    const calcRatio = (val, total) => (total > 0 ? Math.round((val / total) * 100) : 0);

    const h = reportData.home.total;
    const a = reportData.away.total;

    // FG (Total) の計算
    const hFgm = (h.f2m || 0) + (h.f3m || 0);
    const hFga = (h.f2a || 0) + (h.f3a || 0);
    const aFgm = (a.f2m || 0) + (a.f3m || 0);
    const aFga = (a.f2a || 0) + (a.f3a || 0);

    // --- スコアの色判定ロジック（勝敗判定を追加） ---
    const getScoreColor = (teamStyle, currentScore, opponentScore) => {
        const scoreA = Number(currentScore);
        const scoreB = Number(opponentScore);

    // 1. 負けている、または同点の場合はチーム設定の text カラーをそのまま返す
    if (scoreA <= scoreB) {
        return teamStyle.text || "#FFFFFF";
    }

        // 2. 勝っている場合のみ、チームごとの勝利色を判定
        const name = (teamStyle.fullName || teamStyle.nickname || "").toUpperCase();
        const city = (teamStyle.city || "").toUpperCase();
        if (city.includes("KAWASAKI") || name.includes("LAKES") || city.includes("SHIGA")) {
            return "#FFD932"; // デフォルトの勝利色（通常の黄色）を返す
        }
        
        // 琉球（ゴールド・オレンジ系）
        if (name.includes("RYUKYU") || name.includes("琉球") || name.includes("GOLDEN"))
            return "#F27200";
            
        // 仙台・群馬・信州・渋谷（イエロー系）
        if (name.includes("SENDAI") || name.includes("仙台") || name.includes("89ERS") ||
            name.includes("GUNMA") || name.includes("群馬") || name.includes("THUNDERS") ||
            name.includes("SHINSHU") || name.includes("信州") || name.includes("BRAVE") ||
            name.includes("SHIBUYA") || name.includes("渋谷") || name.includes("SUNROCKERS"))
            return "#FEAE00";
            
        // その他デフォルトの勝利色（通常の黄色）
        return "#FFD932";
    };

    // スコア(h.pts, a.pts)を引数に渡して実行
    const homeScoreColor = getScoreColor(homeStyle, h.pts, a.pts);
    const awayScoreColor = getScoreColor(awayStyle, a.pts, h.pts);

    const rawVenue = (reportData.venueRaw || "").trim();
    const foundKey = Object.keys(arenaDict).find(key => rawVenue.includes(key));
    const venueEn = foundKey ? arenaDict[foundKey] : rawVenue.replace("Venue: ", "");

    const replacements = {
        // --- 基本情報 ---
        "__HOME_BG__": homeStyle.color,
        "__AWAY_BG__": awayStyle.color,
        "__HOME_COLOR__": homeStyle.color,      // グラフのメイン用
        "__HOME_COLOR2__": homeStyle.color2,    // グラフのサブ(3P)用
        "__AWAY_COLOR__": awayStyle.color,      // グラフのメイン用
        "__AWAY_COLOR2__": awayStyle.color2,    // グラフのサブ(3P)用
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
        "__DATE__": reportData.date || "",
        "__ATTENDANCE__": Number(reportData.attendance || 0).toLocaleString(),
        "__VENUE__": reportData.venue || reportData.venueRaw || "",
        "__LEAGUE_TYPE__": reportData.leagueType || "",
        "__ROUND__": reportData.round || "",

        // --- Home Stats ---
        "__H_FGPCT__": calcPct(hFgm, hFga), "__H_FGSTR__": `${hFgm} - ${hFga}`,
        "__H_2FGPCT__": calcPct(h.f2m, h.f2a), "__H_2FGSTR__": `${h.f2m} - ${h.f2a}`,
        "__H_3FGPCT__": calcPct(h.f3m, h.f3a), "__H_3FGSTR__": `${h.f3m} - ${h.f3a}`,
        "__H_FTPCT__": calcPct(h.ftm, h.fta), "__H_FTSTR__": `${h.ftm} - ${h.fta}`,
        "__H_REB__": h.reb || 0, "__H_OREB__": h.oreb || 0, "__H_DREB__": h.dreb || 0,
        "__H_AST__": h.ast || 0, "__H_TOV__": h.tov || 0, "__H_STL__": h.stl || 0, "__H_BLK__": h.blk || 0, "__H_PF__": h.pf || 0,
        "__H_ATT_2P__": calcRatio(h.f2a, hFga), "__H_ATT_3P__": calcRatio(h.f3a, hFga),

        // --- Away Stats ---
        "__A_FGPCT__": calcPct(aFgm, aFga), "__A_FGSTR__": `${aFgm} - ${aFga}`,
        "__A_2FGPCT__": calcPct(a.f2m, a.f2a), "__A_2FGSTR__": `${a.f2m} - ${a.f2a}`,
        "__A_3FGPCT__": calcPct(a.f3m, a.f3a), "__A_3FGSTR__": `${a.f3m} - ${a.f3a}`,
        "__A_FTPCT__": calcPct(a.ftm, a.fta), "__A_FTSTR__": `${a.ftm} - ${a.fta}`,
        "__A_REB__": a.reb || 0, "__A_OREB__": a.oreb || 0, "__A_DREB__": a.dreb || 0,
        "__A_AST__": a.ast || 0, "__A_TOV__": a.tov || 0, "__A_STL__": a.stl || 0, "__A_BLK__": a.blk || 0, "__A_PF__": a.pf || 0,
        "__A_ATT_2P__": calcRatio(a.f2a, aFga), "__A_ATT_3P__": calcRatio(a.f3a, aFga),
    };

    // スターターHTML生成 (s.name || s.nameJp で英語名を優先表示)
    const makeStarters = (list, isAway = false) => {
        const style = isAway ? awayStyle : homeStyle;
        const numBg = style.color; 
        const numText = style.textColor;

        const playerNameMap = {
            "飯尾 文哉": "Fumiya Iio",
            "飯尾文哉": "Fumiya Iio",
            "平 寿哉": "Toshiya Taira",
            "ショーン・オマラ": "Shawn O'mara",
            "ドゥシャン・リスティッチ": "Dusan Ristic"
        };
        
        const toTitleCase = (str) => {
            if (!str) return "";
            return str.toLowerCase().split(' ').map(word => 
                word.charAt(0).toUpperCase() + word.slice(1)
            ).join(' ');
        };

        return (list || []).map(s => {
            // --- ★修正：まず変換マップを確認し、なければ従来のロジック ---
            let displayName = playerNameMap[s.name] || playerNameMap[s.nameJp];
            
            if (!displayName) {
                displayName = s.name ? s.name : toTitleCase(s.nameJp);
            }

            return `
            <div class="player-row" style="color: ${isAway ? '#FFFFFF' : homeStyle.textColor}">
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

    await page.addStyleTag({
    content: `
        /* 会場名（.info-value）の挙動を固定 */
        .info-value {
            display: inline-block !important; /* width指定をせず中身の幅を測れるようにする */
            width: auto !important; 
            max-width: 520px !important;
            overflow: visible !important;
        }

        /* 1. ヘッダー・スタッツ行：text を使用するように修正 */
        .home, .home-row { 
            background-color: ${homeStyle.color} !important; 
            color: ${homeStyle.text} !important; 
        }
        .away, .away-row { 
            background-color: ${awayStyle.color} !important; 
            color: ${awayStyle.text} !important; 
        }

        /* スタッツのサブ文字（内訳）のグレーっぽさを消して100%の色にする */
        .val-sub { 
            opacity: 1.0 !important; 
            color: inherit !important;
            margin-top: 14px !important;
        }

        /* 2. ヘッダー：【大文字ルール】と【重なり順】の固定 */
        .city-part, .nick-part { 
            text-transform: uppercase !important; 
            color: inherit !important; 
            position: relative;
            z-index: 5;
        }

        /* 3. スタッツバー：内部の数値も親の色を継承 */
        .home-row *, .away-row * { 
            color: inherit !important; 
        }

        /* 4. スコア：勝利チームカラーを最優先 */
        .home .score-val { color: ${homeScoreColor} !important; }
        .away .score-val { color: ${awayScoreColor} !important; }

        /* 5. スターターエリア：名前は【大文字にしない】・【白を維持】 */
        .p-name { 
            text-transform: none !important; 
            color: #FFFFFF !important; 
        }

        /* 6. スターターエリア：数値やヘッダーも白を維持 */
        .p-stats, .p-stats *, .p-min, .p-val, .stat-header { 
            color: #FFFFFF !important; 
        }

        /* 7. スターター背番号の箱：textColor ではなく text に修正 */
        #home-starters .p-num { 
            background: ${homeStyle.color} !important; 
            color: ${homeStyle.text} !important; 
        }
        #away-starters .p-num { 
            background: ${awayStyle.color} !important; 
            color: ${awayStyle.text} !important; 
        }

        /* 8. 棒グラフ内の数字の色をチーム設定に合わせて個別指定 */
        .h-2p-val { color: ${homeStyle.text} !important; }
        .h-3p-val { color: ${homeStyle.text2} !important; }
        .a-2p-val { color: ${awayStyle.text} !important; }
        .a-3p-val { color: ${awayStyle.text2} !important; }

        /* 9. その他：グラフ凡例などの白指定 */
        .legend-item, .pie-legend { color: #FFFFFF !important; }
    `
});

    // グラフ描画用データ
    const chartData = {
        h: { 
            r2: (h.f2m||0)*2, r3: (h.f3m||0)*3, rf: (h.ftm||0), 
            p3: parseFloat(calcPct(h.f3m, h.f3a)),
            text2: homeStyle.text2 // 追加：ホームチームの3P用文字色
        },
        a: { 
            r2: (a.f2m||0)*2, r3: (a.f3m||0)*3, rf: (a.ftm||0), 
            p3: parseFloat(calcPct(a.f3m, a.f3a)),
            text2: awayStyle.text2 // 追加：アウェイチームの3P用文字色
        }
    };

    await page.evaluate((d) => {
        if (window.drawReportCharts) {
            window.drawReportCharts(d);
        }
    }, chartData);

    await page.waitForTimeout(1000);

    // --- ファイル名の作成ロジック ---
    // 1. 日付を8桁 (YYYYMMDD) に変換
    const dateObj = new Date(reportData.date);
    const yyyy = dateObj.getFullYear();
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const dd = String(dateObj.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}${mm}${dd}`;

    // 2. チーム名（nickname）を取得してスペースを削除
    const homeName = (homeStyle.nickname || "HOME").replace(/\s+/g, '');
    const awayName = (awayStyle.nickname || "AWAY").replace(/\s+/g, '');

    // 3. ファイル名の組み立て: 日付(8桁) + 試合ID + HOME + AWAY
    // gameId は関数の引数からそのまま使用します
    const fileName = `${dateStr}_${gameId}_${homeName}_${awayName}.png`;

    // --- 保存処理 ---
    const outPath = path.join(process.cwd(), "output", "reports");
    if (!fs.existsSync(outPath)) fs.mkdirSync(outPath, { recursive: true });

    await page.screenshot({ path: path.join(outPath, fileName) });
    await browser.close();
    console.log(`✅ レポート生成完了: ${fileName}`);
}

module.exports = { renderBReport };