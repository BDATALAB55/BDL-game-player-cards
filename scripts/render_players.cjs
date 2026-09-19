/* scripts/render_players.cjs */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

// チームカラーデータの読み込み
function loadColorData() {
    const p = path.join(__dirname, "..", "data", "team_colors.json");
    return JSON.parse(fs.readFileSync(p, "utf8"));
}
const colorData = loadColorData();

// アリーナ変換データの読み込み
function loadArenaData() {
    const p = path.join(__dirname, "..", "data", "arena.json");
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
        color: "#333333",
        color2: "#000000",
        text: "#FFFFFF",
        text2: "#FFFFFF",
        dark: "#1A1A1A",
        nickname: name,
        city: name,
        fullName: name
    };

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

        const season =
            process.env.B_PLAYER_SEASON ||
            process.env.B_REPORT_SEASON ||
            "";

        const seasonStartYear = Number(
            season.match(/^(\d{4})/)?.[1] || 9999
        );

        const isOldSendai =
            internalKey === "Sendai"
            && seasonStartYear <= 2024;

        const isNewShinshu =
            internalKey === "Shinshu"
            && seasonStartYear >= 2026;

        const isNewTokyoSR =
            internalKey === "Shibuya"
            && seasonStartYear >= 2026;

        const cityEn = internalKey.toUpperCase();
        const nickEn =
            (teamInfo.nickname || "").toUpperCase();

        if (isOldSendai) {
            return {
                ...teamInfo,
                city: "SENDAI",
                nickname: "89ERS",
                fullName: "SENDAI 89ERS",
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
                fullName: "SHINSHU BRAVE WARRIORS",
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
                fullName: "TOKYO SUNROCKERS",
                color: "#392171",
                dark: "rgba(18, 11, 37, 0.3)",
                color2: "#FED100",
                text: "#FFFFFF",
                text2: "#000000"
            };
        }

        return {
            ...teamInfo,
            city: cityEn,
            nickname: nickEn,
            fullName: `${cityEn} ${nickEn}`.trim(),
            color: teamInfo.color || "#333333",
            dark:
                teamInfo.dark ||
                teamInfo.color ||
                "#333333",
            color2: teamInfo.color2 || "#000000",
            text: teamInfo.text || "#FFFFFF",
            text2: teamInfo.text2 || "#FFFFFF"
        };
    }

    return defaultStyle;
}

// メイン関数：選手カードの生成
async function renderPlayers(gameId, options = {}) {
    // 修正：スクレイピング側（fetchGameBoxscore）の出力名に合わせて report_${gameId}.json を読み込む
    const dataPath = options.dataPath || `/Volumes/HD-CD-1/Masaki/B/BDATALAB APP/data/reports/report_${gameId}.json`;
    const templatePath = path.join(__dirname, "..", "template", "player.html");

    // 1. JSONデータの存在チェックと読み込み
    if (!fs.existsSync(dataPath)) {
        throw new Error(
            `データファイルが見つかりません: ${dataPath}`
        );
    }
    const gameData = JSON.parse(fs.readFileSync(dataPath, "utf8"));

    // 2. 出力ディレクトリの設定
    const homeInitial = getTeamStyle(gameData.homeName).city.replace(/\s+/g, "_");
    const awayInitial = getTeamStyle(gameData.awayName).city.replace(/\s+/g, "_");
    const safeDate = (gameData.date || "").replace(/\./g, "");
    const dateFolder = safeDate.slice(2);
    const folderName = `game_${gameId}_${homeInitial}_${awayInitial}_${safeDate}`;
    const playerLeague =
        process.env.B_PLAYER_LEAGUE || "B2";
    const playerSeason =
        process.env.B_PLAYER_SEASON || "2025-26";

    const defaultOutputDir = path.join(
        "/Volumes/HD-CD-1/Masaki/B/BDATALAB APP/output/Game Players",
        playerLeague,
        playerSeason,
        dateFolder,
        folderName
    );
    const outputDir = options.outputDir || defaultOutputDir;

    // 3. ディレクトリの初期化
    if (options.cleanOutput !== false && fs.existsSync(outputDir)) {
        fs.rmSync(outputDir, { recursive: true, force: true });
    }
    fs.mkdirSync(outputDir, { recursive: true });

    const homeStyle = getTeamStyle(gameData.homeName);
    const awayStyle = getTeamStyle(gameData.awayName);

    // GAME REPORTと同じ勝利スコア色
    const getScoreColor = (
        teamStyle,
        currentScore,
        opponentScore
    ) => {
        const scoreA = Number(currentScore);
        const scoreB = Number(opponentScore);

        if (scoreA <= scoreB) {
            return teamStyle.text || "#FFFFFF";
        }

        const name = (
            teamStyle.fullName ||
            teamStyle.nickname ||
            ""
        ).toUpperCase();

        const city = (
            teamStyle.city || ""
        ).toUpperCase();

        if (
            city.includes("KAWASAKI") ||
            name.includes("LAKES") ||
            city.includes("SHIGA")
        ) {
            return "#FFD932";
        }

        if (
            name.includes("RYUKYU") ||
            name.includes("琉球") ||
            name.includes("GOLDEN")
        ) {
            return "#F27200";
        }

        const season =
            process.env.B_PLAYER_SEASON ||
            process.env.B_REPORT_SEASON ||
            "";

        const seasonStartYear = Number(
            season.match(/^(\d{4})/)?.[1] || 9999
        );

        const isSendai =
            city.includes("SENDAI") ||
            name.includes("SENDAI") ||
            name.includes("仙台") ||
            name.includes("89ERS");

        if (isSendai) {
            return "#F27200";
        }

        const isShinshu =
            city.includes("SHINSHU") ||
            name.includes("SHINSHU") ||
            name.includes("信州");

        if (isShinshu) {
            return "#F27200";
        }

        if (
            name.includes("GUNMA") ||
            name.includes("群馬") ||
            name.includes("THUNDERS")
        ) {
            return "#FEAE00";
        }

        return "#FFD932";
    };

    const homeScoreColor = getScoreColor(
        homeStyle,
        gameData.scoreHome,
        gameData.scoreAway
    );

    const awayScoreColor = getScoreColor(
        awayStyle,
        gameData.scoreAway,
        gameData.scoreHome
    );

    const originalHtml = fs.readFileSync(templatePath, "utf8");
    const venueEn = String(
        gameData.venue || ""
    ).trim();

    const venueContainsJapanese =
        /[\u3040-\u30FF\u3400-\u9FFF\u3005-\u3007]/.test(
            venueEn
        );

    if (!venueEn || venueContainsJapanese) {
        throw new Error(
            `英語会場名が不正です: ${venueEn || "会場不明"}`
        );
    }

    // ブラウザの起動
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1200, height: 1653 });

    // 各選手のカード生成ループ
    const targetNames = new Set(
        (options.targetNames || [])
            .map(name => String(name || "").trim())
            .filter(Boolean)
    );

    for (const player of gameData.players) {
        const playerNames = [
            String(player.name || "").trim(),
            String(player.nameJp || "").trim(),
        ];

        if (
            targetNames.size > 0 &&
            !playerNames.some(name => targetNames.has(name))
        ) {
            continue;
        }

        const tp = getTeamStyle(player.teamNameRaw);

        // --- 選手名変換マップ（保持） ---
        const playerNameMap = {
            "飯尾 文哉": "FUMIYA IIO",
            "飯尾文哉": "FUMIYA IIO",
            "平 寿哉": "TOSHIYA TAIRA",
            "ショーン・オマラ": "SEAN O'MARA",
            "SEAN OMARA": "SEAN O'MARA",
            "ドゥシャン・リスティッチ": "DUSAN RISTIC",
            "ダリアス・デイズ": "DARIUS DAYS",
            "スティーブ・ザック": "STEVE ZACK",
            "ジョーダン・ダラス": "JORDAN DALLAS",
            "小寺 ハミルトンゲイリー": "HAMILTONGARY KOTERA",
            "フランク・カミンスキー": "FRANK KAMINSKY",
            "ケーレブ・ターズースキー": "KALEB TARCZEWSKI",
            "ジェフリー・パーマー": "JEFFREY PARMER",
            "ジャスティン・ハーパー": "JUSTIN HARPER",
            "オルフェミ・オルジョビ": "OLUFEMI OLUJOBI",
            "ジェイミー・マロンゾ": "JAMIE MALONZO",
            "チェハーレス・タプスコット": "CHEHALES TAPSCOTT",
            "ジョシュア・スミス": "JOSHUA SMITH",
            "ケヴェ・アルマ": "KEVE ALUMA",

        };

        let displayPlayerName =
            playerNameMap[player.name] || player.name || "";

        const playerNameContainsJapanese =
            /[\u3040-\u30FF\u3400-\u9FFF\u3005-\u3007]/.test(
                displayPlayerName
            );

        if (!displayPlayerName || playerNameContainsJapanese) {
            throw new Error(
                `英語選手名が不正です: #${player.no} ` +
                `${player.name || player.nameJp || "名前不明"}`
            );
        }

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
            .replace(/__DATE__/g, String(gameData.date || "DATE_MISSING").replace(/-/g, "."))
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

        await page.waitForFunction(
            () =>
                typeof window.Chart !== "undefined" &&
                typeof window.ChartDataLabels !== "undefined" &&
                typeof window.drawCharts === "function",
            { timeout: 15000 }
        );

        await page.evaluate((data) => {
            window.drawCharts(data);
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
