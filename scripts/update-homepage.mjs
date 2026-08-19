// Pulls the latest commit from each tracked project repo and writes it into
// index.html between the LATEST-ACTIVITY markers.
import { readFile, writeFile } from "node:fs/promises";

const OWNER = "Tristan-hsu";
const REPOS = [
  "model_thinking",
  "learning_library",
  "natal_mcp",
  "mcp_obsidian_control_agent",
  "RAG-LLM",
  "astro_ai",
  "personal_pages",
];
const MAX_ITEMS = 6;
const START_MARKER = "<!-- LATEST-ACTIVITY:START -->";
const END_MARKER = "<!-- LATEST-ACTIVITY:END -->";
const INDEX_PATH = new URL("../index.html", import.meta.url);

const token = process.env.GITHUB_TOKEN;
const headers = {
  Accept: "application/vnd.github+json",
  "User-Agent": "homepage-updater",
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
};

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function latestCommit(repo) {
  const res = await fetch(
    `https://api.github.com/repos/${OWNER}/${repo}/commits?per_page=1`,
    { headers }
  );
  if (!res.ok) {
    console.warn(`skip ${repo}: ${res.status} ${res.statusText}`);
    return null;
  }
  const [commit] = await res.json();
  if (!commit) return null;
  const message = commit.commit.message.split("\n")[0];
  return {
    repo,
    message,
    date: commit.commit.author.date,
    url: commit.html_url,
  };
}

function formatDate(iso) {
  return iso.slice(0, 10);
}

function renderItem({ repo, message, date, url }) {
  return `      <li class="activity-item">
        <span class="activity-repo">${escapeHtml(repo)}</span>
        <a href="${url}" target="_blank" rel="noopener">${escapeHtml(message)}</a>
        <span class="activity-date">${formatDate(date)}</span>
      </li>`;
}

async function main() {
  const results = (await Promise.all(REPOS.map(latestCommit))).filter(Boolean);
  results.sort((a, b) => new Date(b.date) - new Date(a.date));
  const top = results.slice(0, MAX_ITEMS);

  if (top.length === 0) {
    throw new Error("No commits fetched from any tracked repo; aborting update.");
  }

  const fragment = top.map(renderItem).join("\n");
  const block = `${START_MARKER}\n${fragment}\n      ${END_MARKER}`;

  const html = await readFile(INDEX_PATH, "utf8");
  const startIdx = html.indexOf(START_MARKER);
  const endIdx = html.indexOf(END_MARKER);
  if (startIdx === -1 || endIdx === -1) {
    throw new Error("LATEST-ACTIVITY markers not found in index.html");
  }

  const updated =
    html.slice(0, startIdx) + block + html.slice(endIdx + END_MARKER.length);

  await writeFile(INDEX_PATH, updated, "utf8");
  console.log(`Updated ${top.length} activity items.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
