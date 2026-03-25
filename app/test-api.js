require('dotenv').config();

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

async function test() {
  const url = 'https://api.github.com/search/repositories?q=stars:>1000&sort=stars&order=desc&per_page=1&page=1';
  const response = await fetch(url, {
    headers: {
      'Authorization': `token ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json'
    }
  });
  const data = await response.json();
  console.log('Статус:', response.status);
  console.log('Ответ:', data);
}

test();