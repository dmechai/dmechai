const escape = value => value.replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[ch]);

export function featured(readme, owner, repos) {
  const selected = repos.filter(repo => repo.owner?.login?.toLowerCase() === owner.toLowerCase()
    && repo.private === false && repo.fork === false)
    .sort((a, b) => b.stargazers_count - a.stargazers_count || b.forks_count - a.forks_count || a.name.localeCompare(b.name, 'en'))
    .slice(0, 6);
  const cards = selected.map(repo => {
    const description = (typeof repo.description === 'string' ? repo.description.replace(/\s+/gu, ' ').trim() : '')
      || (repo.name.toLowerCase() === owner.toLowerCase() ? 'My GitHub profile, with project highlights and a contribution calendar.' : '');
    const url = `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo.name)}`;
    const badges = [['Stars', repo.stargazers_count], ['Forks', repo.forks_count], ['Language', repo.language]]
      .filter(([, value]) => value != null && value !== '')
      .map(([label, value]) => {
        const text = encodeURIComponent(String(value).replaceAll('-', '--').replaceAll('_', '__'));
        return `<img alt="${label}: ${escape(String(value))}" src="https://img.shields.io/badge/${label}-${text}-444444?style=flat-square">`;
      });
    return `<td${selected.length === 1 ? '' : ' width="50%"'} align="left" valign="top">\n<h3><a href="${url}">${escape(repo.name)}</a></h3>\n${description ? `<p>${escape(description)}</p>\n` : ''}<p>${badges.join(' ')}</p>\n</td>`;
  });
  const rows = [];
  for (let i = 0; i < cards.length; i += 2) {
    const row = cards.slice(i, i + 2);
    rows.push(`<tr>\n${row.join('\n')}${row.length === 1 && cards.length > 1 ? '\n<td width="50%"></td>' : ''}\n</tr>`);
  }
  const content = rows.length ? `\n<br>\n\n---\n\n<br>\n\n## 🚀 Featured Projects\n\n<table>\n${rows.join('\n')}\n</table>\n\n<br>\n\n---\n\n<br>\n` : '';
  const start = '<!-- featured-projects:start -->';
  const end = '<!-- featured-projects:end -->';
  const from = readme.indexOf(start);
  const to = readme.indexOf(end);
  if (from < 0 || to < from || readme.lastIndexOf(start) !== from || readme.lastIndexOf(end) !== to) throw new Error('Expected one featured block');
  return readme.slice(0, from + start.length) + (content ? `\n${content}\n` : '\n') + readme.slice(to);
}
