// Cria o repositório, comita tudo na main como Lebot007 e ativa o GitHub Pages.
// Uso: GITHUB_TOKEN=ghp_xxx node deploy.mjs   (Node 18+)
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const TOKEN = process.env.GITHUB_TOKEN || process.argv[2] || '';
const REPO = process.env.REPO_NAME || 'nevoa-chat';
const AUTHOR = { name: 'Lebot007', email: '135986213+Lebot007@users.noreply.github.com' };
const FILES = ['index.html', 'styles.css', 'app.js', 'LICENSE', 'README.md', '.nojekyll', 'deploy.mjs'];

if (!TOKEN) {
  console.error('Defina GITHUB_TOKEN (classic, escopo "repo"). Ex.: GITHUB_TOKEN=ghp_xxx node deploy.mjs');
  process.exit(1);
}

async function api(method, p, body, allow = []) {
  const r = await fetch('https://api.github.com' + p, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'nevoa-deploy',
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await r.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  if (!r.ok && !allow.includes(r.status))
    throw new Error(`${method} ${p} -> ${r.status}: ${String(text).slice(0, 300)}`);
  return { status: r.status, data };
}

const main = async () => {
  const me = await api('GET', '/user');
  const login = me.data.login;
  console.log(`Autenticado como ${login}`);

  const ex = await api('GET', `/repos/${login}/${REPO}`, null, [404]);
  if (ex.status === 404) {
    await api('POST', '/user/repos', {
      name: REPO,
      description: 'Névoa — chat anônimo P2P efêmero, sem banco de dados, com criptografia ponta a ponta.',
      private: false, auto_init: false
    });
    console.log(`Repositório criado: ${login}/${REPO}`);
  } else console.log(`Repositório existente: ${login}/${REPO} (atualizando)`);

  // repo recém-criado fica vazio e a Git Data API exige um commit inicial
  const ref0 = await api('GET', `/repos/${login}/${REPO}/git/ref/heads/main`, null, [404]);
  if (ref0.status === 404) {
    await api('PUT', `/repos/${login}/${REPO}/contents/.nojekyll`,
      { message: 'chore: init', content: '', author: AUTHOR, committer: AUTHOR });
  }

  const tree = [];
  for (const f of FILES) {
    let content;
    try { content = await readFile(path.join(DIR, f)); }
    catch (e) { if (f === '.nojekyll') content = Buffer.from(''); else throw e; }
    const blob = await api('POST', `/repos/${login}/${REPO}/git/blobs`,
      { content: content.toString('base64'), encoding: 'base64' });
    tree.push({ path: f, mode: '100644', type: 'blob', sha: blob.data.sha });
  }

  const tr = await api('POST', `/repos/${login}/${REPO}/git/trees`, { tree });
  const head = await api('GET', `/repos/${login}/${REPO}/git/ref/heads/main`, null, [404]);
  const commit = await api('POST', `/repos/${login}/${REPO}/git/commits`, {
    message: 'feat: Névoa — chat anônimo P2P efêmero (MIT)',
    tree: tr.data.sha, parents: head.status === 404 ? [] : [head.data.object.sha], author: AUTHOR, committer: AUTHOR
  });
  await api('PATCH', `/repos/${login}/${REPO}/git/refs/heads/main`, { sha: commit.data.sha, force: false });
  console.log(`Commit ${commit.data.sha.slice(0, 7)} na main como ${AUTHOR.name}`);

  let pages = await api('POST', `/repos/${login}/${REPO}/pages`,
    { source: { branch: 'main', path: '/' } }, [409, 422]);
  if (pages.status >= 400)
    pages = await api('GET', `/repos/${login}/${REPO}/pages`, null, [404]);
  const url = (pages.data && pages.data.html_url) || `https://${login}.github.io/${REPO}/`;

  console.log('\nPronto!');
  console.log(`Repositório: https://github.com/${login}/${REPO}`);
  console.log(`Site (publica em ~1 min): ${url}`);
  console.log('\nLembrete: revogue o token em https://github.com/settings/tokens');
};

main().catch(e => { console.error('Erro:', e.message); process.exit(1); });
