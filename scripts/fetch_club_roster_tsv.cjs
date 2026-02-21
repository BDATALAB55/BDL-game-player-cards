/* scripts/fetch_club_roster_tsv.cjs
 * B.LEAGUE club_detail (tab=2) から選手リンクを拾い、選手詳細(roster_detail)から
 * 背番号 / 日本語名 / 英語名 / 身長(cm) を抽出してTSV出力する
 *
 * 出力:
 *  - output/rosters/<TeamID>_<teamname>.tsv  （列: 背番号, 日本語名, English name, 身長）
 *  - output/rosters/all_teams.tsv            （列: TeamID, Team名, 背番号, 日本語名, English name, 身長, PlayerID, URL）
 */

const fs = require("node:fs/promises");
const path = require("node:path");
const cheerio = require("cheerio");

const DEFAULT_TEAM_URLS = [
  "https://www.bleague.jp/club_detail/?TeamID=702&tab=2",
  "https://www.bleague.jp/club_detail/?TeamID=692&tab=2",
  "https://www.bleague.jp/club_detail/?TeamID=693&tab=2",
  "https://www.bleague.jp/club_detail/?TeamID=712&tab=2",
  "https://www.bleague.jp/club_detail/?TeamID=703&tab=2",
  "https://www.bleague.jp/club_detail/?TeamID=713&tab=2",
  "https://www.bleague.jp/club_detail/?TeamID=745&tab=2",
  "https://www.bleague.jp/club_detail/?TeamID=2486&tab=2",
  "https://www.bleague.jp/club_detail/?TeamID=704&tab=2",
  "https://www.bleague.jp/club_detail/?TeamID=706&tab=2",
  "https://www.bleague.jp/club_detail/?TeamID=726&tab=2",
  "https://www.bleague.jp/club_detail/?TeamID=727&tab=2",
  "https://www.bleague.jp/club_detail/?TeamID=694&tab=2",
  "https://www.bleague.jp/club_detail/?TeamID=696&tab=2",
  "https://www.bleague.jp/club_detail/?TeamID=697&tab=2",
  "https://www.bleague.jp/club_detail/?TeamID=728&tab=2",
  "https://www.bleague.jp/club_detail/?TeamID=717&tab=2",
  "https://www.bleague.jp/club_detail/?TeamID=729&tab=2",
  "https://www.bleague.jp/club_detail/?TeamID=698&tab=2",
  "https://www.bleague.jp/club_detail/?TeamID=699&tab=2",
  "https://www.bleague.jp/club_detail/?TeamID=700&tab=2",
  "https://www.bleague.jp/club_detail/?TeamID=720&tab=2",
  "https://www.bleague.jp/club_detail/?TeamID=721&tab=2",
  "https://www.bleague.jp/club_detail/?TeamID=1638&tab=2",
  "https://www.bleague.jp/club_detail/?TeamID=2488&tab=2",
  "https://www.bleague.jp/club_detail/?TeamID=701&tab=2",

  "https://www.bleague.jp/club_detail/?TeamID=708&tab=2",
  "https://www.bleague.jp/club_detail/?TeamID=709&tab=2",
  "https://www.bleague.jp/club_detail/?TeamID=710&tab=2",
  "https://www.bleague.jp/club_detail/?TeamID=711&tab=2",
  "https://www.bleague.jp/club_detail/?TeamID=714&tab=2",
  "https://www.bleague.jp/club_detail/?TeamID=2891&tab=2",
  "https://www.bleague.jp/club_detail/?TeamID=716&tab=2",
  "https://www.bleague.jp/club_detail/?TeamID=1637&tab=2",
  "https://www.bleague.jp/club_detail/?TeamID=718&tab=2",
  "https://www.bleague.jp/club_detail/?TeamID=719&tab=2",
  "https://www.bleague.jp/club_detail/?TeamID=723&tab=2",
  "https://www.bleague.jp/club_detail/?TeamID=753&tab=2",
  "https://www.bleague.jp/club_detail/?TeamID=724&tab=2",
  "https://www.bleague.jp/club_detail/?TeamID=725&tab=2",
];

const OUT_DIR = path.join(process.cwd(), "output", "rosters");

// ---- utility
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function safeFilename(s) {
  return String(s)
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
}

function absUrl(href) {
  if (!href) return null;
  if (href.startsWith("http")) return href;
  return new URL(href, "https://www.bleague.jp").toString();
}

/**
 * 英語名を "BrandonAshley" -> "Brandon Ashley" に整形
 * - すでにスペースが入っている場合はそのまま
 * - "DJNewbill" のような頭文字+姓も "DJ Newbill" に
 */
function formatEnglishName(name) {
  if (!name) return "";
  let s = String(name).trim();

  // すでにスペースが入ってるならそのまま
  if (s.includes(" ")) return s;

  // "DJNewbill" / "AJSlaughter" など「頭文字＋姓」を先に分割
  s = s.replace(/([A-Z]{2,})([A-Z][a-z])/g, "$1 $2");

  // "BrandonAshley" のように lower→Upper の境界にスペース
  s = s.replace(/([a-z])([A-Z])/g, "$1 $2");

  return s.replace(/\s+/g, " ").trim();
}

async function fetchWithRetry(url, { retries = 4, baseDelay = 500 } = {}) {
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0",
          "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
        },
      });

      if (!res.ok) {
        // 429/5xx はリトライ対象
        if ((res.status === 429 || res.status >= 500) && i < retries) {
          const wait = baseDelay * (i + 1);
          console.warn(`HTTP ${res.status} retry in ${wait}ms: ${url}`);
          await sleep(wait);
          continue;
        }
        throw new Error(`HTTP ${res.status} ${url}`);
      }

      return await res.text();
    } catch (e) {
      lastErr = e;
      if (i < retries) {
        const wait = baseDelay * (i + 1);
        console.warn(`Fetch error retry in ${wait}ms: ${url}\n  -> ${e.message}`);
        await sleep(wait);
        continue;
      }
    }
  }
  throw lastErr;
}

function getTeamIdFromUrl(teamUrl) {
  return new URL(teamUrl).searchParams.get("TeamID") || "";
}

function extractTeamNameFromClubHtml(html) {
  const $ = cheerio.load(html);

  // まずはページ内の見出しっぽいところを優先
  const h1 = $("h1").first().text().trim();
  if (h1) return h1;

  const og = $('meta[property="og:title"]').attr("content");
  if (og) return og.split("|")[0].trim();

  const title = $("title").text().trim();
  if (title) return title.split("|")[0].trim();

  return "unknown_team";
}

function extractPlayerUrlsFromClubHtml(html) {
  const $ = cheerio.load(html);
  const urls = new Set();

  // DOM上のリンク
  $('a[href*="roster_detail"]').each((_, a) => {
    const href = $(a).attr("href");
    if (href && href.includes("PlayerID=")) urls.add(absUrl(href));
  });

  // 万一DOMに無くても、HTML内に埋まっていれば拾う（保険）
  const re = /\/roster_detail\/\?PlayerID=\d+/g;
  const matches = html.match(re) || [];
  for (const m of matches) urls.add(absUrl(m));

  return [...urls];
}

function normalizeLines(text) {
  return text
    .split("\n")
    .map((s) => s.replace(/\u00a0/g, " ").trim())
    .filter(Boolean);
}

function parseHeightCmFromPlayerHtml(html) {
  const $ = cheerio.load(html);

  // テーブル構造で拾えそうなら拾う
  let height = null;
  $("th").each((_, th) => {
    const t = $(th).text().replace(/\s+/g, "");
    if (!t) return;
    if (t.includes("身長")) {
      const tdText = $(th).next("td").text().replace(/\s+/g, "");
      const m = tdText.match(/(\d{2,3})cm/);
      if (m) height = Number(m[1]);
    }
  });
  if (height) return height;

  // 文字列パターンで拾う（身長／体重 198cm/??kg みたいなやつ）
  const text = $("body").text().replace(/\s+/g, " ");
  const m1 = text.match(/身長\s*[\/／]\s*体重\s*([0-9]{2,3})cm/i);
  if (m1) return Number(m1[1]);

  const m2 = text.match(/身長\s*([0-9]{2,3})cm/i);
  if (m2) return Number(m2[1]);

  return null;
}

function parseNumberNameFromPlayerHtml(html) {
  const $ = cheerio.load(html);
  const bodyText = $("body").text();
  const lines = normalizeLines(bodyText);

  // よくある並び: "#8" -> "Jarrett Culver" -> "ジャレット・カルバー"
  const idx = lines.findIndex((s) => /^#\s*\d+/.test(s));
  let number = null;
  let name_en = null;
  let name_ja = null;

  if (idx >= 0) {
    number = Number(lines[idx].replace("#", "").trim());
    name_en = lines[idx + 1] ?? null;
    name_ja = lines[idx + 2] ?? null;
  }

  // 取りこぼし保険（h1など）
  if (!name_ja) {
    const h1 = $("h1").first().text().trim();
    if (h1) name_ja = h1;
  }

  // 英語名が拾えない場合、本文からそれっぽい行を探す（雑に保険）
  if (!name_en) {
    const maybeEn = lines.find((s) => /^[A-Za-z][A-Za-z .'-]{2,}$/.test(s));
    if (maybeEn) name_en = maybeEn;
  }

  return { number, name_ja, name_en };
}

function getPlayerIdFromUrl(playerUrl) {
  try {
    return new URL(playerUrl).searchParams.get("PlayerID") || "";
  } catch {
    return "";
  }
}

function toTSV(headers, rows) {
  const esc = (v) => {
    if (v === null || v === undefined) return "";
    return String(v).replace(/\t/g, " ").replace(/\r?\n/g, " ");
  };
  return [
    headers.join("\t"),
    ...rows.map((r) => headers.map((h) => esc(r[h])).join("\t")),
  ].join("\n");
}

// ---- main
async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });

  // CLIでURL渡せるように（渡されなければデフォルト7チーム）
  const cliUrls = process.argv.slice(2).filter((a) => a.startsWith("http"));
  const teamUrls = cliUrls.length ? cliUrls : DEFAULT_TEAM_URLS;

  const allRows = [];

  for (const teamUrl of teamUrls) {
    const teamId = getTeamIdFromUrl(teamUrl);
    console.log(`\n=== TeamID ${teamId} fetching club page...`);
    const clubHtml = await fetchWithRetry(teamUrl);
    const teamName = extractTeamNameFromClubHtml(clubHtml);
    console.log(`Team: ${teamName}`);

    const playerUrls = extractPlayerUrlsFromClubHtml(clubHtml);
    console.log(`Players found (links): ${playerUrls.length}`);

    const teamRows = [];

    for (let i = 0; i < playerUrls.length; i++) {
      const pUrl = playerUrls[i];
      await sleep(200); // 負荷軽減（増やしたければ 300-500ms）
      const pHtml = await fetchWithRetry(pUrl);

      const { number, name_ja, name_en } = parseNumberNameFromPlayerHtml(pHtml);
      const height_cm = parseHeightCmFromPlayerHtml(pHtml);
      const player_id = getPlayerIdFromUrl(pUrl);

      // ★ここで英語名に半角スペースを入れる
      const fixedEn = formatEnglishName(name_en);

      const row = {
        team_id: teamId,
        team_name: teamName,
        number: number ?? "",
        name_ja: name_ja ?? "",
        name_en: fixedEn ?? "",
        height_cm: height_cm ?? "",
        player_id,
        url: pUrl,
      };

      teamRows.push(row);
      allRows.push(row);

      console.log(
        `  [${i + 1}/${playerUrls.length}] #${row.number} ${row.name_ja} / ${row.name_en} / ${row.height_cm}cm`
      );
    }

    // 背番号で並べる
    teamRows.sort((a, b) => (Number(a.number) || 999) - (Number(b.number) || 999));

    // チーム別TSV：背番号/日本語名/英語名/身長
    const perTeamHeaders = ["number", "name_ja", "name_en", "height_cm"];
    const perTeamTsv = toTSV(perTeamHeaders, teamRows);

    const perTeamFile = path.join(
      OUT_DIR,
      `${teamId}_${safeFilename(teamName)}.tsv`
    );
    await fs.writeFile(perTeamFile, perTeamTsv, "utf8");
    console.log(`✅ wrote: ${path.relative(process.cwd(), perTeamFile)}`);
  }

  // all_teams.tsv（後で結合/検索しやすい）
  allRows.sort((a, b) => {
    const t = String(a.team_id).localeCompare(String(b.team_id));
    if (t !== 0) return t;
    return (Number(a.number) || 999) - (Number(b.number) || 999);
  });

  const allHeaders = [
    "team_id",
    "team_name",
    "number",
    "name_ja",
    "name_en",
    "height_cm",
    "player_id",
    "url",
  ];
  const allTsv = toTSV(allHeaders, allRows);

  const allFile = path.join(OUT_DIR, "all_teams.tsv");
  const allJsonFile = path.join(OUT_DIR, "all_teams.json");

  await fs.writeFile(allFile, allTsv, "utf8");
  await fs.writeFile(allJsonFile, JSON.stringify(allRows, null, 2), "utf8");
  console.log(`\n✅ wrote: ${path.relative(process.cwd(), allFile)}`);
  console.log(`✅ wrote: ${path.relative(process.cwd(), allJsonFile)}`);
}

main().catch((e) => {
  console.error("❌ failed:", e);
  process.exit(1);
});