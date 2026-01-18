const https = require('https');

// 2025年10月22日 開幕
let currentDate = new Date('2025-10-22');
const endDate = new Date(); 

async function fetchGameIds() {
    console.log("--- 取得開始 (NBA APIに接続中...) ---");

    while (currentDate <= endDate) {
        const mm = String(currentDate.getMonth() + 1).padStart(2, '0');
        const dd = String(currentDate.getDate()).padStart(2, '0');
        const yyyy = currentDate.getFullYear();
        const yy = String(yyyy).slice(-2);

        const apiDate = `${mm}/${dd}/${yyyy}`;
        const dirDate = `${yy}${mm}${dd}`;

        process.stdout.write(`\r検索中: ${yyyy}-${mm}-${dd} ... `);

        // ScoreboardV2 エンドポイント
        const url = `https://stats.nba.com/stats/scoreboardv2?DayOffset=0&LeagueID=00&gameDate=${apiDate}`;

        await new Promise((resolve) => {
            const options = {
                headers: {
                    'Host': 'stats.nba.com',
                    'Connection': 'keep-alive',
                    'Accept': 'application/json, text/plain, */*',
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'x-nba-stats-origin': 'stats',
                    'x-nba-stats-token': 'true',
                    'Referer': 'https://www.nba.com/',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
                },
                timeout: 8000 // 反応が遅いことがあるので少し長めに設定
            };

            const req = https.get(url, options, (res) => {
                let data = '';
                
                // データの受信
                res.on('data', (chunk) => { data += chunk; });
                
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        const games = json.resultSets[0].rowSet;
                        if (games && games.length > 0) {
                            const ids = games.map(g => g[2]).join(' ');
                            console.log(`\n${dirDate} ${ids}`);
                        }
                    } catch (e) {
                        // 試合がない日やJSONエラー
                    }
                    resolve();
                });
            });

            req.on('error', (e) => {
                console.log(`\nエラー: ${e.message}`);
                resolve();
            });

            req.on('timeout', () => {
                req.destroy();
                resolve();
            });
        });

        currentDate.setDate(currentDate.getDate() + 1);
        // API制限を避けるため、待機時間を1秒（1000ms）に延ばすのが安全です
        await new Promise(r => setTimeout(r, 1000));
    }
    console.log("\n--- 全ての取得が完了しました ---");
}

fetchGameIds();