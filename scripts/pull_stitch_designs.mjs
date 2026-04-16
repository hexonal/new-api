import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { basename } from 'node:path';

const PROJECT_RESOURCE =
  process.env.STITCH_PROJECT_RESOURCE ?? 'projects/3739945949553521861';
const USER_BILLING_PROJECT =
  process.env.STITCH_USER_PROJECT ?? 'axis-ai-app-481612';
const OUTPUT_DIR = '.stitch';
const DESIGN_DIR = `${OUTPUT_DIR}/designs`;

const slugify = (input) =>
  input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'screen';

const ensureDirs = () => {
  if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });
  if (!existsSync(DESIGN_DIR)) mkdirSync(DESIGN_DIR, { recursive: true });
};

const getToken = () =>
  execSync('gcloud auth application-default print-access-token', {
    encoding: 'utf8',
  }).trim();

const stitchFetch = async (body) => {
  const token = getToken();
  const res = await fetch('https://stitch.googleapis.com/mcp', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Goog-User-Project': USER_BILLING_PROJECT,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Stitch API error ${res.status}: ${text}`);
  }
  const json = await res.json();
  return json.result ?? json;
};

const parseContent = (result) => {
  if (result?.content && Array.isArray(result.content)) {
    for (const item of result.content) {
      if (item.text) {
        try {
          return JSON.parse(item.text);
        } catch (err) {
          throw new Error(`Failed to parse Stitch content: ${err.message}`);
        }
      }
    }
  }
  return result;
};

const callTool = async (name, args = {}) => {
  const raw = await stitchFetch({
    jsonrpc: '2.0',
    method: 'tools/call',
    params: { name, arguments: args },
    id: Date.now(),
  });
  return parseContent(raw);
};

const downloadText = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed ${res.status}`);
  return await res.text();
};

const downloadBinary = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed ${res.status}`);
  const arr = await res.arrayBuffer();
  return Buffer.from(arr);
};

const main = async () => {
  ensureDirs();
  const project = await callTool('get_project', { projectId: PROJECT_RESOURCE });
  const screensResult = await callTool('list_screens', {
    projectId: PROJECT_RESOURCE,
  });
  const screens = screensResult.screens ?? [];

  const metadata = {
    projectId: PROJECT_RESOURCE.split('/').pop(),
    projectResource: PROJECT_RESOURCE,
    projectTitle: project?.project?.title ?? project?.title ?? 'Unnamed Project',
    pulledAt: new Date().toISOString(),
    userProject: USER_BILLING_PROJECT,
    screens: {},
  };

  for (const screen of screens) {
    const name = screen.name;
    const title = screen.title ?? basename(name);
    const slug = (() => {
      const base = slugify(title);
      let candidate = base;
      let i = 2;
      while (
        metadata.screens[candidate] &&
        metadata.screens[candidate].screenName !== name
      ) {
        candidate = `${base}-${i++}`;
      }
      return candidate;
    })();

    const htmlUrl = screen.htmlCode?.downloadUrl;
    const imageUrl = screen.screenshot?.downloadUrl;
    const htmlPath = `${DESIGN_DIR}/${slug}.html`;
    const imagePath = `${DESIGN_DIR}/${slug}.png`;

    if (htmlUrl) {
      const html = await downloadText(htmlUrl);
      writeFileSync(htmlPath, html, 'utf8');
    }

    if (imageUrl) {
      const png = await downloadBinary(imageUrl);
      writeFileSync(imagePath, png);
    }

    metadata.screens[slug] = {
      screenName: name,
      title,
      htmlFileId: screen.htmlCode?.name ?? null,
      imageFileId: screen.screenshot?.name ?? null,
      htmlPath,
      imagePath,
      width: Number(screen.width ?? 0),
      height: Number(screen.height ?? 0),
      deviceType: screen.deviceType ?? 'UNKNOWN',
    };
  }

  writeFileSync(`${OUTPUT_DIR}/metadata.json`, JSON.stringify(metadata, null, 2));
  console.log(`Pulled ${Object.keys(metadata.screens).length} screens into ${DESIGN_DIR}`);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
