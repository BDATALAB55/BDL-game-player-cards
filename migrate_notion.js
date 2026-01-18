const https = require('https');

const TOKEN = "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";
const DATABASE_ID = "2e6a9060e8b28004a34edc365bb82870";

const options = (path, method = 'POST') => ({
    hostname: 'api.notion.com',
    path: `/v1${path}`,
    method: method,
    headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
    }
});

const request = (path, method, data) => {
    return new Promise((resolve, reject) => {
        const req = https.request(options(path, method), (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => resolve(JSON.parse(body)));
        });
        req.on('error', reject);
        if (data) req.write(JSON.stringify(data));
        req.end();
    });
};

async function migrate() {
    console.log("🚀 再々テスト開始（Notion専用ルール適用）...");
    try {
        const data = await request(`/databases/${DATABASE_ID}/query`, 'POST', { page_size: 10 });
        for (const page of data.results) {
            const blocks = await request(`/blocks/${page.id}/children`, 'GET');
            const imageBlock = blocks.results?.find(b => b.type === 'image');

            if (imageBlock) {
                const isInternal = !!imageBlock.image.file;
                const imageUrl = isInternal ? imageBlock.image.file.url : imageBlock.image.external.url;

                // Notion内部ファイル用の特別な形式に修正
                const fileObject = isInternal 
                    ? { name: "PlayerCard.png", type: "file", file: { url: imageUrl } }
                    : { name: "PlayerCard.png", type: "external", external: { url: imageUrl } };

                const updateData = {
                    properties: {
                        "カード": {
                            files: [fileObject]
                        }
                    }
                };

                const res = await request(`/pages/${page.id}`, 'PATCH', updateData);
                if (res.object === 'error') {
                    console.log(`❌ 失敗: ${page.id} - ${res.message}`);
                } else {
                    console.log(`✅ 成功: ${page.id}`);
                }
            } else {
                console.log(`ℹ️ 画像なし: ${page.id}`);
            }
        }
        console.log("🎉 終了しました！Notionを確認してください。");
    } catch (error) {
        console.error("❌ エラー:", error.message);
    }
}

migrate();