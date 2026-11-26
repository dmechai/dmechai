const escape = value => value.replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[ch]);

export function featured(readme, owner, repos) {
  const selected = repos.filter(repo => repo.owner?.login?.toLowerCase() === owner.toLowerCase()
    && repo.private === false && repo.fork === false)
    .sort((a, b) => b.stargazers_count - a.stargazers_count || b.forks_count - a.forks_count || a.name.localeCompare(b.name, 'en'))
    .slice(0, 6);
  const cards = selected.map(repo => {
    const isProfile = repo.name.toLowerCase() === owner.toLowerCase();
    const description = (typeof repo.description === 'string' ? repo.description.replace(/\s+/gu, ' ').trim() : '')
      || (isProfile ? 'The source for this GitHub profile README.' : '');
    const url = `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo.name)}`;
    const license = repo.license?.spdx_id;
    const metadata = [repo.language, license === 'NOASSERTION' ? null : license,
      repo.stargazers_count > 0 ? `${repo.stargazers_count} ${repo.stargazers_count === 1 ? 'star' : 'stars'}` : null,
      repo.forks_count > 0 ? `${repo.forks_count} ${repo.forks_count === 1 ? 'fork' : 'forks'}` : null,
    ].filter(Boolean).map(escape).join(' &middot; ');
    return [
      '<table align="center"><tr><td align="left">',
      `<strong><a href="${url}">${escape(repo.name)}</a></strong>`,
      ...(description ? [`<br><sub>${escape(description)}</sub>`] : []),
      ...(isProfile ? ['<ul><li><sub>Public projects ranked by stars and forks.</sub></li><li><sub>Commit and language charts, plus a light and dark contribution snake.</sub></li></ul>'] : []),
      ...(metadata ? [`${isProfile ? '' : '<br>'}<sub>${metadata}</sub>`] : []),
      '</td></tr></table>',
    ].join('\n');
  });
  const content = cards.length ? `\n### <ins><sup>FEATURED PROJECTS</sup></ins>\n\n${cards.join('\n\n')}\n` : '';
  const start = '<!-- featured-projects:start -->';
  const end = '<!-- featured-projects:end -->';
  const from = readme.indexOf(start);
  const to = readme.indexOf(end);
  if (from < 0 || to < from || readme.lastIndexOf(start) !== from || readme.lastIndexOf(end) !== to) throw new Error('Expected one featured block');
  return readme.slice(0, from + start.length) + (content ? `\n${content}\n` : '\n') + readme.slice(to);
}
