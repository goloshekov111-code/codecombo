const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

async function fetchTopRepos(page = 1) {
  const perPage = 100;
  const query = 'stars:>1000';
  const url = `https://api.github.com/search/repositories?q=${query}&sort=stars&order=desc&per_page=${perPage}&page=${page}`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    
    const data = await response.json();
    return data.items || [];
  } catch (error) {
    console.error('Ошибка при запросе к GitHub:', error);
    return [];
  }
}

async function saveRepos(repos) {
  for (const repo of repos) {
    const repoData = {
      github_id: repo.id,
      name: repo.name,
      full_name: repo.full_name,
      description: repo.description,
      language: repo.language,
      stars: repo.stargazers_count,
      forks: repo.forks_count,
      open_issues: repo.open_issues_count,
      license: repo.license?.name || null,
      owner: repo.owner.login,
      owner_type: repo.owner.type,
      created_at: repo.created_at,
      updated_at: repo.updated_at,
      pushed_at: repo.pushed_at,
      has_wiki: repo.has_wiki,
      archived: repo.archived
    };
    
    const { error } = await supabase
      .from('repositories')
      .upsert(repoData, { onConflict: 'github_id' });
    
    if (error) {
      console.error(`Ошибка при сохранении ${repo.full_name}:`, error.message);
    } else {
      console.log(`✅ Сохранён: ${repo.full_name} (⭐ ${repo.stargazers_count})`);
    }
  }
}

async function main() {
  console.log('Начинаем сбор 1000 репозиториев...');
  
  let allRepos = [];
  for (let page = 1; page <= 10; page++) {
    console.log(`Загрузка страницы ${page}...`);
    const repos = await fetchTopRepos(page);
    if (repos.length === 0) {
      console.log('Репозитории закончились, прерываем.');
      break;
    }
    await saveRepos(repos);
    allRepos = allRepos.concat(repos);
    console.log(`Собрано ${allRepos.length} репозиториев`);
    
    // Пауза 2 секунды между страницами
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log(`Сбор завершён! Всего собрано ${allRepos.length} репозиториев.`);
}

main();