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
            .replace(/__ORTG__/g, (team.ortg || 0).toFixed(1))
            .replace(/__ORTG_RANK__/g, team.rank_ortg || "-")
            .replace(/__DRTG__/g, (team.drtg || 0).toFixed(1))
            .replace(/__DRTG_RANK__/g, team.rank_drtg || "-")
            .replace(/__PTS__/g, team.displayPts ? team.displayPts.toFixed(1) : avg(team.pts))
            .replace(/__PTS_RANK__/g, team.rank_pts || "-")
            .replace(/__PTS_AVG__/g, b1Avg.displayPts || "80.5")
            .replace(/__FG2_PCT__/g, (team.fg2p || 0).toFixed(1))
            .replace(/__FG2_M__/g, avg(team.fg2m))
            .replace(/__FG2_A__/g, avg(team.fg2a))
            .replace(/__FG2_RANK__/g, team.rank_fg2p || "-")
            .replace(/__REB__/g, avg(team.reb))
            .replace(/__REB_RANK__/g, team.rank_reb || "-")
            .replace(/__AST__/g, avg(team.ast))
            .replace(/__AST_RANK__/g, team.rank_ast || "-")
            .replace(/__STL__/g, avg(team.stl))
            .replace(/__STL_RANK__/g, team.rank_stl || "-")
            .replace(/__BLK__/g, avg(team.blk))
            .replace(/__BLK_RANK__/g, team.rank_blk || "-")
            .replace(/__PTS_TOV__/g, avg(team.ptsOffTov))
            .replace(/__PTS_TOV_RANK__/g, team.rank_ptsOffTov || "-")
            .replace(/__PTS_2ND__/g, avg(team.pts2ndChance))
            .replace(/__PTS_2ND_RANK__/g, team.rank_pts2ndChance || "-")
            .replace(/__PTS_FB__/g, avg(team.ptsFastBreak))
            .replace(/__PTS_FB_RANK__/g, team.rank_ptsFastBreak || "-")
            .replace(/__PTS_PAINT__/g, avg(team.ptsInPaint))
            .replace(/__PTS_PAINT_RANK__/g, team.rank_ptsInPaint || "-")
            .replace(/__F__/g, avg(team.f))
            .replace(/__FD__/g, avg(team.fd))
            .replace(/__EFF__/g, (team.eff || 0).toFixed(1))
            .replace(/__EFG__/g, (team.efgp || 0).toFixed(1))
            .replace(/__TS__/g, (team.tsp || 0).toFixed(1))
            .replace(/__PACE__/g, (team.pace || 0).toFixed(1))
            .replace(/__UPDATE_TIME__/g, new Date().toLocaleString());

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