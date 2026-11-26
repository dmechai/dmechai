const escape = value => value.replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[ch]);

const MAX_PROJECTS = 6;
const COLUMNS = 2;
const languageIcons = {
  javascript: 'javascript', typescript: 'typescript', python: 'python',
  go: 'go', rust: 'rust', ruby: 'ruby', shell: 'gnubash', html: 'html5', css: 'css',
};

function badge(text, color, logo) {
  const label = encodeURIComponent(text.replaceAll('-', '--').replaceAll('_', '__'));
  const icon = logo ? `&amp;logo=${logo}&amp;logoColor=white` : '';
  return `<img alt="${escape(text)}" src="https://img.shields.io/badge/${label}-${color}?style=flat-square${icon}">`;
}

export function featured(readme, owner, repos) {
  const selected = repos.filter(repo => repo.owner?.login?.toLowerCase() === owner.toLowerCase()
    && repo.private === false && repo.fork === false)
    .sort((a, b) => b.stargazers_count - a.stargazers_count || b.forks_count - a.forks_count || a.name.localeCompare(b.name, 'en'))
    .slice(0, MAX_PROJECTS);
  const cards = selected.map(repo => {
    const isProfile = repo.name.toLowerCase() === owner.toLowerCase();
    const description = (typeof repo.description === 'string' ? repo.description.replace(/\s+/gu, ' ').trim() : '')
      || (isProfile ? 'The source for this GitHub profile README.' : '');
    const url = `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo.name)}`;
    const license = repo.license?.spdx_id;
    const badges = [badge(`\u2605 ${repo.stargazers_count} Stars`, '444444'),
      repo.language ? badge(repo.language, '4b5563', Object.hasOwn(languageIcons, repo.language.toLowerCase()) ? languageIcons[repo.language.toLowerCase()] : undefined) : '',
      license && license !== 'NOASSERTION' ? badge(`\u2696 ${license}`, '444444') : '',
      repo.forks_count > 0 ? badge(`${repo.forks_count} Forks`, '444444', 'github') : '',
    ].filter(Boolean).join(' ');
    return [
      `<td width="${selected.length === 1 ? '400' : '50%'}" align="left" valign="top">`,
      `<strong><a href="${url}">${escape(repo.name)}</a></strong>`,
      ...(description ? [`<br><sub>${escape(description)}</sub>`] : []),
      ...(isProfile ? ['<ul><li><sub>Public projects ranked by stars and forks.</sub></li><li><sub>Commit and language charts, plus a light and dark contribution snake.</sub></li></ul>'] : []),
      `${isProfile ? '' : '<br>'}${badges}`,
      '</td>',
    ].join('\n');
  });
  const rows = [];
  for (let i = 0; i < cards.length; i += COLUMNS) {
    rows.push(`<tr>\n${cards.slice(i, i + COLUMNS).join('\n')}\n</tr>`);
  }
  const content = rows.length ? `\n### <ins><sup>FEATURED PROJECTS</sup></ins>\n\n<div align="left">\n<table>\n${rows.join('\n')}\n</table>\n</div>\n` : '';
  const start = '<!-- featured-projects:start -->';
  const end = '<!-- featured-projects:end -->';
  const from = readme.indexOf(start);
  const to = readme.indexOf(end);
  if (from < 0 || to < from || readme.lastIndexOf(start) !== from || readme.lastIndexOf(end) !== to) throw new Error('Expected one featured block');
  return readme.slice(0, from + start.length) + (content ? `\n${content}\n` : '\n') + readme.slice(to);
}
