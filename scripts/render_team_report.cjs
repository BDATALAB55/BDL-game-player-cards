const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

async function renderTeamReport() {
    const templatePath = path.join(process.cwd(), "template", "B_team.html"); 
    const statsPath = path.join(process.cwd(), "data", "stats", "processed_team_stats.json");
    const colorsPath = path.join(process.cwd(), "data", "team_colors.json");
    const outputDir = path.join(process.cwd(), "output", "cards");
    
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    if (!fs.existsSync(templatePath)) {
        console.error(`❌ エラー: テンプレートファイルが見つかりません: ${templatePath}`);
        return;
    }

    const templateHtml = fs.readFileSync(templatePath, "utf8");
    const statsData = JSON.parse(fs.readFileSync(statsPath, "utf8"));
    const colorMaster = JSON.parse(fs.readFileSync(colorsPath, "utf8"));
    const b1Avg = statsData.b1Avg || {};

    const browser = await chromium.launch();
    const page = await browser.newPage();
    
    // 他のレポートと共通の A4 サイズ設定
    await page.setViewportSize({ width: 1200, height: 1653 });

    // ループ開始
    for (const team of statsData.teams) {
        // --- チームカラー・名称の特定 ---
        const teamKey = colorMaster.aliases[team.teamName] || team.teamName;
        const config = colorMaster.teams[teamKey] || { 
            color: "#333333", 
            text: "#FFFFFF", 
            nickname: team.teamName 
        };

        if (!colorMaster.teams[teamKey]) {
            console.warn(`⚠️ チームカラー未設定: ${team.teamName}`);
        }

        console.log(`[RENDER] デザインを同期中: ${team.teamName}`);
        
        // --- 試合数の算出 (W + L) ---
        const wins = Number(team.wins || 0);
        const losses = Number(team.losses || 0);
        const games = wins + losses || 1; 

        // 平均値計算用
        const avg = (val) => val ? (val / games).toFixed(1) : "0.0";

        // --- HTML置換処理 ---
        let html = templateHtml
            .replace(/__TEAM_BG__/g, config.color)
            .replace(/__TEAM_TEXT__/g, config.text || "#000000")
            .replace(/__CITY__/g, teamKey.toUpperCase())
            .replace(/__TEAM_NAME__/g, config.nickname)
            .replace(/__WINS__/g, wins)
            .replace(/__LOSSES__/g, losses)
            .replace(/__DIV__/g, team.division || "E")
            .replace(/__RANK__/g, team.rank || "-")
            // ヘッダーRTG
            .replace(/__ortg__/gi, (team.ortg || 0).toFixed(1))
            .replace(/__ORTG_RANK__/gi, team.rank_ortg || "-")
            .replace(/__drtg__/gi, (team.drtg || 0).toFixed(1))
            .replace(/__DRTG_RANK__/gi, team.rank_drtg || "-")
            // PTSセクション
            .replace(/__displayPts__/g, team.displayPts ? team.displayPts.toFixed(1) : avg(team.pts))
            .replace(/__rank_displayPts__/g, team.rank_pts || "-")
            .replace(/__oppPts__/g, (team.oppPts || 0).toFixed(1))
            .replace(/__rank_oppPts__/g, team.rank_oppPts || "-")
            // 2FGセクション
            .replace(/__fg2p__/g, (team.fg2p || 0).toFixed(1))
            .replace(/__rank_fg2p__/g, team.rank_fg2p || "-")
            .replace(/__fg2m__/g, avg(team.fg2m))
            .replace(/__fg2a__/g, avg(team.fg2a))
            .replace(/__rank_fg2m__/g, team.rank_fg2m || "-")
            .replace(/__rank_fg2a__/g, team.rank_fg2a || "-")
            // 3FGセクション
            .replace(/__fg3p__/g, (team.fg3p || 0).toFixed(1))
            .replace(/__rank_fg3p__/g, team.rank_fg3p || "-")
            .replace(/__fg3m__/g, avg(team.fg3m))
            .replace(/__fg3a__/g, avg(team.fg3a))
            .replace(/__rank_fg3m__/g, team.rank_fg3m || "-")
            .replace(/__rank_fg3a__/g, team.rank_fg3a || "-")
            // リーグ平均
            .replace(/__b1Avg_displayPts__/g, b1Avg.displayPts || "80.5")
            .replace(/__b1Avg_fg2p__/g, (b1Avg.fg2p || 0).toFixed(1))
            .replace(/__b1Avg_fg2m__/g, b1Avg.fg2m_avg || "0.0")
            .replace(/__b1Avg_fg2a__/g, b1Avg.fg2a_avg || "0.0")
            .replace(/__b1Avg_fg3p__/g, (b1Avg.fg3p || 0).toFixed(1))
            .replace(/__b1Avg_fg3m__/g, b1Avg.fg3m_avg || "0.0")
            .replace(/__b1Avg_fg3a__/g, b1Avg.fg3a_avg || "0.0");

        await page.setContent(html);

        await page.evaluate((args) => {
    if (typeof window.drawTeamCharts === 'function') {
        window.drawTeamCharts(args.val, args.color);
    }
}, { val: team.fg2p || 0, color: config.color });

        await page.waitForTimeout(400);
        
        const fileName = `${team.teamName}_card.png`;
        await page.screenshot({ path: path.join(outputDir, fileName), fullPage: true });
    }

    await browser.close();
    console.log("✅ 全チームのレンダリングが完了しました。");
}

renderTeamReport().catch(err => console.error("❌ エラー発生:", err));