const fs = require('fs');
const path = require('path');

function mergeStats() {
    const dataDir = path.join(process.cwd(), 'data', 'stats');
    const teamData = {};

    // 補助関数：徹底的に名前をクリーンにする（改行や引用符を削除）
    const cleanStr = (str) => {
        if (!str) return '';
        // 引用符、改行コード、スペース、バックスラッシュnをすべて消す
        return str.replace(/["\n\r\t\\]/g, '').replace(/\\n/g, '').trim();
    };

    // 補助関数：カンマを除去して数値化
    const parseNum = (val) => {
        if (!val) return 0;
        return parseFloat(val.replace(/,/g, '')) || 0;
    };

    // 1. DATA-合計.csv (PTS: 80.1 を 29列目から取得)
    if (fs.existsSync(path.join(dataDir, 'DATA-合計.csv'))) {
        const lines = fs.readFileSync(path.join(dataDir, 'DATA-合計.csv'), 'utf8').split(/\r?\n/);
        lines.slice(2).forEach(line => {
            const c = line.split(',');
            if (c.length < 50) return;
            const name = cleanStr(c[1]);
            if (!name) return;

            teamData[name] = {
                teamName: name,
                pts: parseNum(c[29]), // 平均PTS (仙台: 80.1)
                fgp: parseNum(c[33]), // 平均FG%
                reb: parseNum(c[45]), // 平均TR
                ast: parseNum(c[46]), // 平均AS
                stl: parseNum(c[48]), // 平均ST
                blk: parseNum(c[49]), // 平均BS
                rank_total: parseInt(c[0]) || 0 // リーグ全体順位
            };
        });
    }

    // 2. DATA-詳細.csv (ORTG: 111.8 を 17列目から取得)
    if (fs.existsSync(path.join(dataDir, 'DATA-詳細.csv'))) {
        const lines = fs.readFileSync(path.join(dataDir, 'DATA-詳細.csv'), 'utf8').split(/\r?\n/);
        lines.slice(2).forEach(line => {
            const c = line.split(',');
            if (c.length < 20) return;
            const name = cleanStr(c[1]); // 2列目に名前
            if (teamData[name]) {
                teamData[name].ortg = parseNum(c[17]); // OFFRTG
                teamData[name].drtg = parseNum(c[18]); // DEFRTG
                teamData[name].pace = parseNum(c[15]); // PACE
            }
        });
    }

    // 3. DATA-E.csv / DATA-W.csv (順位と勝敗)
    ['DATA-E.csv', 'DATA-W.csv'].forEach(file => {
        const filePath = path.join(dataDir, file);
        if (fs.existsSync(filePath)) {
            const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
            lines.slice(1).forEach(line => {
                const c = line.split(',');
                const name = cleanStr(c[1]);
                if (teamData[name]) {
                    teamData[name].area_rank = parseInt(c[0]);
                    teamData[name].win_loss = `${cleanStr(c[2])}勝${cleanStr(c[3])}敗`;
                }
            });
        }
    });

    const teams = Object.values(teamData).filter(t => t.pts > 0);
    fs.writeFileSync(
        path.join(dataDir, 'processed_team_stats.json'), 
        JSON.stringify({ updatedAt: new Date().toLocaleString(), teams }, null, 2)
    );

    console.log(`✅ ${teams.length} チームのデータを統合しました！`);
    
    // 仙台のデータをコンソールに表示して最終確認
    const check = teams.find(t => t.teamName.includes('仙台'));
    if (check) {
        console.log('--- 仙台89ERS 統合データ確認 ---');
        console.log(check);
    }
}

mergeStats();