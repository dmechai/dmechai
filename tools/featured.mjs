const escape = value => value.replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[ch]);

export function featured(readme, owner, repos) {
  const selected = repos.filter(repo => repo.owner?.login?.toLowerCase() === owner.toLowerCase()
    && repo.private === false && repo.fork === false)
    .sort((a, b) => b.stargazers_count - a.stargazers_count || b.forks_count - a.forks_count || a.name.localeCompare(b.name, 'en'))
    .slice(0, 6);
  const cards = selected.map(repo => {
    const isProfile = repo.name.toLowerCase() === owner.toLowerCase();
    const description = (typeof repo.description === 'string' ? repo.description.replace(/\s+/gu, ' ').trim() : '')
      || (isProfile ? 'My GitHub profile, with automatically refreshed project highlights and activity charts.' : '');
    const url = `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo.name)}`;
    const license = repo.license?.spdx_id;
    const badges = [['Stars', repo.stargazers_count], ['Forks', repo.forks_count], ['Language', repo.language], ['License', license === 'NOASSERTION' ? null : license]]
      .filter(([, value]) => value != null && value !== '')
      .map(([label, value]) => {
        const text = encodeURIComponent(String(value).replaceAll('-', '--').replaceAll('_', '__'));
        return `<img alt="${label}: ${escape(String(value))}" src="https://img.shields.io/badge/${label}-${text}-444444?style=flat-square">`;
      });
    const highlights = isProfile ? [
      'Automatically ranks public projects by stars and forks.',
      'Summarizes commit activity and repository languages.',
      'Animates the last 53 weeks of commit activity in light and dark themes.',
    ] : [];
    return [
      '<table><tr><td align="left">',
      `<p><strong><a href="${url}">${escape(repo.name)}</a></strong>${description ? `<br><sub>${escape(description)}</sub>` : ''}${badges.length ? `<br>${badges.join(' ')}` : ''}</p>`,
      ...(highlights.length ? [
        '<strong><sub>Features</sub></strong>',
        `<ul>${highlights.map(text => `<li><sub>${escape(text)}</sub></li>`).join('')}</ul>`,
        `<p><sub><a href="https://github.com/${encodeURIComponent(owner)}">View profile</a></sub></p>`,
      ] : []),
      '</td></tr></table>',
    ].join('\n');
  });
  const content = cards.length ? `\n### <ins><sup>FEATURED PROJECTS</sup></ins>\n\n<div align="left">\n${cards.join('\n')}\n</div>\n` : '';
  const start = '<!-- featured-projects:start -->';
  const end = '<!-- featured-projects:end -->';
  const from = readme.indexOf(start);
  const to = readme.indexOf(end);
  if (from < 0 || to < from || readme.lastIndexOf(start) !== from || readme.lastIndexOf(end) !== to) throw new Error('Expected one featured block');
  return readme.slice(0, from + start.length) + (content ? `\n${content}\n` : '\n') + readme.slice(to);
}
