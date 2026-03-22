/* scripts/render_players.cjs */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

// チームカラーデータの読み込み
function loadColorData() {
    const p = path.join(process.cwd(), "data", "team_colors.json");
    return JSON.parse(fs.readFileSync(p, "utf8"));
}
const colorData = loadColorData();

// アリーナ変換データの読み込み
function loadArenaData() {
    const p = path.join(process.cwd(), "data", "arena.json");
    if (fs.existsSync(p)) {
        try {
            return JSON.parse(fs.readFileSync(p, "utf8"));
        } catch (e) {
            return {};
        }
    }
    return {};
}
const arenaDict = loadArenaData();

// チームごとのスタイル設定を取得
function getTeamStyle(rawName) {
    const name = String(rawName || "").toUpperCase();
    const defaultStyle = {
        color: "#333333", color2: "#000000", text: "#FFFFFF", text2: "#FFFFFF",
        dark: "#1A1A1A", nickname: name, city: name, fullName: name
    };

    const aliasKey = Object.keys(colorData.aliases).find(k => {
        const kUpper = k.toUpperCase();
        return name.includes(kUpper);
    });

    const internalKey = aliasKey ? colorData.aliases[aliasKey] : null;

    if (internalKey && colorData.teams[internalKey]) {
        const teamInfo = colorData.teams[internalKey];
        const cityEn = internalKey.toUpperCase();
        const nickEn = (teamInfo.nickname || "").toUpperCase();

        return {
            ...teamInfo,
            city: cityEn,
            nickname: nickEn,
            fullName: `${cityEn} ${nickEn}`.trim(),
            dark: teamInfo.dark || "#1A1A1A",
            color2: teamInfo.color2 || "#000000",
            text2: teamInfo.text2 || "#FFFFFF"
        };
    }
    return defaultStyle;
}

// メイン関数：選手カードの生成
async function renderPlayers(gameId) {
    // 修正：スクレイピング側（fetchGameBoxscore）の出力名に合わせて report_${gameId}.json を読み込む
    const dataPath = `/Volumes/HD-CD-1/Masaki/B/BDATALAB APP/data/reports/report_${gameId}.json`;
    const templatePath = path.join(process.cwd(), "template", "player.html");

    // 1. JSONデータの存在チェックと読み込み
    if (!fs.existsSync(dataPath)) {
        console.error(`❌ データファイルが見つかりません: ${dataPath}`);
        return;
    }
    const gameData = JSON.parse(fs.readFileSync(dataPath, "utf8"));

    // 2. 出力ディレクトリの設定
    const homeInitial = getTeamStyle(gameData.homeName).city.replace(/\s+/g, "_");
    const awayInitial = getTeamStyle(gameData.awayName).city.replace(/\s+/g, "_");
    const safeDate = (gameData.date || "").replace(/\./g, "");
    const folderName = `game_${gameId}_${homeInitial}_${awayInitial}_${safeDate}`;
    const outputDir = `/Volumes/HD-CD-1/Masaki/B/BDATALAB APP/output/Bplayers/${folderName}`;

    // 3. ディレクトリの初期化
    if (fs.existsSync(outputDir)) fs.rmSync(outputDir, { recursive: true, force: true });
    fs.mkdirSync(outputDir, { recursive: true });

    const homeStyle = getTeamStyle(gameData.homeName);
    const awayStyle = getTeamStyle(gameData.awayName);

    // 勝利チームのカラー判定
    const getWinColor = (teamName) => {
        const name = String(teamName).toUpperCase();
        if (name.includes("RYUKYU") || name.includes("琉球")) return "#F27200";
        if (name.includes("SENDAI") || name.includes("仙台") ||
            name.includes("GUNMA") || name.includes("群馬") ||
            name.includes("SHINSHU") || name.includes("信州") ||
            name.includes("SHIBUYA") || name.includes("渋谷")) return "#FEAE00";
        return "#FFD932";
    };

    const hScoreNum = parseInt(gameData.scoreHome || 0);
    const aScoreNum = parseInt(gameData.scoreAway || 0);

    // スコアの表示色決定
    const homeScoreColor = (hScoreNum > aScoreNum) ? getWinColor(gameData.homeName) : homeStyle.text;
    const awayScoreColor = (aScoreNum > hScoreNum) ? getWinColor(gameData.awayName) : awayStyle.text;

    const originalHtml = fs.readFileSync(templatePath, "utf8");
    const rawVenue = (gameData.venue || gameData.venueRaw || "").trim();
    const foundKey = Object.keys(arenaDict).find(key => rawVenue.includes(key));
    const venueEn = foundKey ? arenaDict[foundKey] : rawVenue;

    // ブラウザの起動
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1200, height: 1653 });

    // 各選手のカード生成ループ
    for (const player of gameData.players) {
        const tp = getTeamStyle(player.teamNameRaw);

        // --- 選手名変換マップ（保持） ---
        const playerNameMap = {
            "飯尾 文哉": "FUMIYA IIO",
            "飯尾文哉": "FUMIYA IIO",
            "平 寿哉": "TOSHIYA TAIRA",
            "ショーン・オマラ": "SEAN O'MARA",
            "SEAN OMARA": "SEAN O'MARA",
            "ドゥシャン・リスティッチ": "DUSAN RISTIC"
        };

        let displayPlayerName = playerNameMap[player.name] || player.name || player.nameJp;

        // --- 都市名とフルネームの変換マップ（保持） ---
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

        let homeCity = cityNameMap[homeStyle.city] || homeStyle.city;
        let awayCity = cityNameMap[awayStyle.city] || awayStyle.city;
        let displayTeamFullName = specialTeams[player.teamNameRaw] || tp.fullName;

        const starterMark = player.isStarter ? "S" : "";

        // HTMLテンプレートの置換処理
        let html = originalHtml
            .replace(/__HOME_BG__/g, homeStyle.color)
            .replace(/__HOME_TEXT__/g, homeStyle.text)
            .replace(/__HOME_DARK__/g, homeStyle.dark)
            .replace(/__AWAY_BG__/g, awayStyle.color)
            .replace(/__AWAY_TEXT__/g, awayStyle.text)
            .replace(/__AWAY_DARK__/g, awayStyle.dark)
            .replace(/__HOME_CITY__/g, homeCity)
            .replace(/__HOME_NICK__/g, homeStyle.nickname)
            .replace(/__AWAY_CITY__/g, awayCity)
            .replace(/__AWAY_NICK__/g, awayStyle.nickname)
            .replace(/__HOME_SCORE__/g, gameData.scoreHome)
            .replace(/__AWAY_SCORE__/g, gameData.scoreAway)
            .replace(/__HOME_SCORE_COLOR__/g, homeScoreColor)
            .replace(/__AWAY_SCORE_COLOR__/g, awayScoreColor)
            .replace(/__PLAYER_NAME__/g, (displayPlayerName || "").replace(' ', '  '))
            .replace(/__PLAYER_NO__/g, player.no)
            .replace(/__STARTER__/g, starterMark)
            .replace(/__PLAYER_BG__/g, tp.color)
            .replace(/__PLAYER_DARK__/g, tp.dark)
            .replace(/__PLAYER_TEXT__/g, tp.text)
            .replace(/__PLAYER_TEXT2__/g, tp.text2)
            .replace(/__PLAYER_COLOR__/g, tp.color)
            .replace(/__PLAYER_COLOR2__/g, tp.color2)
            .replace(/__PLAYER_TEAM_RAW__/g, displayTeamFullName)
            .replace(/__PTS__/g, player.pts)
            .replace(/__FG2PCT__/g, player.fg2Pct)
            .replace(/__FG2STR__/g, player.fg2Str)
            .replace(/__FG3PCT__/g, player.fg3Pct)
            .replace(/__FG3STR__/g, player.fg3Str)
            .replace(/__FTPCT__/g, player.ftPct)
            .replace(/__FTSTR__/g, player.ftStr)
            .replace(/__AST__/g, player.ast)
            .replace(/__REB__/g, player.reb)
            .replace(/__OREB__/g, player.oreb || "0")
            .replace(/__DREB__/g, player.dreb || "0")
            .replace(/__STL__/g, player.stl)
            .replace(/__BLK__/g, player.blk)
            .replace(/__TO__/g, player.to)
            .replace(/__PF__/g, player.pf)
            .replace(/__PM__/g, (player.plusMinus >= 0 ? "+" : "") + player.plusMinus)
            .replace(/__MIN__/g, player.min || "00:00")
            .replace(/__ATTENDANCE__/g, String(gameData.attendance || "0").replace(/\B(?=(\d{3})+(?!\d))/g, ","))
            .replace(/__VENUE__/g, venueEn)
            .replace(/__DATE__/g, gameData.date || "DATE_MISSING")
            .replace(/__LEAGUE_TYPE__/g, gameData.leagueType || "")
            .replace(/__ROUND__/g, gameData.round || "");

        await page.setContent(html);

        // フォントサイズ調整などの evaluate ロジック（保持）
        await page.evaluate(() => {
            const nickParts = document.querySelectorAll('.nick-part');
            nickParts.forEach(el => {
                const maxWidth = 520;
                let spacing = 0.13;
                while (el.offsetWidth > maxWidth && spacing > -0.15) {
                    spacing -= 0.01;
                    el.style.letterSpacing = spacing + 'em';
                }
            });
            const labels = Array.from(document.querySelectorAll('.info-label'));
            const locationLabel = labels.find(el => el.textContent === 'Location');
            if (locationLabel) {
                const venueEl = locationLabel.nextElementSibling;
                if (venueEl) {
                    const maxWidth = 550;
                    let fontSize = 32;
                    while (venueEl.offsetWidth > maxWidth && fontSize > 14) {
                        fontSize -= 1;
                        venueEl.style.fontSize = fontSize + 'px';
                    }
                }
            }
        });

        await page.evaluate((data) => {
            if (window.drawCharts) window.drawCharts(data);
        }, { ...player, teamPalette: tp });

        await page.waitForTimeout(500);

        const safeDateStr = (gameData.date || "").replace(/\./g, "");

        // ★ displayPlayerName(記号あり) をベースに、ファイル名用に記号を消す
        const safeName = (displayPlayerName || "player")
            .replace(/'/g, "")           // ★ ここでアポストロフィを削除
            .replace(/\s+/g, "_")        // 空白をアンダースコアに
            .replace(/[^\x00-\x7F]/g, ""); // 英数字以外を排除

        const safeTeam = displayTeamFullName.replace(/\s+/g, "_");

        // ファイル名は記号なし（OMARA）、カード内は記号あり（O'MARA）になります
        const fileName = `${safeTeam}_${player.no}_${safeName}_${safeDateStr}.png`;
        await page.screenshot({ path: `${outputDir}/${fileName}` });
    }

    await browser.close();
    console.log(`\n🎉 選手カードの生成が完了しました！`);
}

module.exports = { renderPlayers };