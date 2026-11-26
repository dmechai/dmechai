const escape = value => value.replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[ch]);

export function featured(readme, owner, repos) {
  const selected = repos.filter(repo => repo.owner?.login?.toLowerCase() === owner.toLowerCase()
    && repo.private === false && repo.fork === false && repo.name?.toLowerCase() !== owner.toLowerCase())
    .sort((a, b) => b.stargazers_count - a.stargazers_count || b.forks_count - a.forks_count || a.name.localeCompare(b.name, 'en'))
    .slice(0, 6);
  const cards = selected.map(repo => {
    const description = typeof repo.description === 'string' ? repo.description.replace(/\s+/gu, ' ').trim() : '';
    return `<a href="https://github.com/${owner}/${repo.name}"><strong>${escape(repo.name)}</strong></a><br>${description ? escape(description) : 'No description'}<br><sub>${repo.stargazers_count} stars · ${repo.forks_count} forks</sub>`;
  });
  const content = cards.length ? `### <ins><sup>FEATURED PROJECTS</sup></ins>\n\n${cards.join('\n\n')}` : '';
  const start = '<!-- featured-projects:start -->';
  const end = '<!-- featured-projects:end -->';
  const from = readme.indexOf(start);
  const to = readme.indexOf(end);
  if (from < 0 || to < from || readme.lastIndexOf(start) !== from || readme.lastIndexOf(end) !== to) throw new Error('Expected one featured block');
  return readme.slice(0, from + start.length) + (content ? `\n${content}\n` : '\n') + readme.slice(to);
}
