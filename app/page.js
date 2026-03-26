'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import { track } from '@vercel/analytics';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const LIBRARIES_IO_KEY = process.env.NEXT_PUBLIC_LIBRARIES_IO_KEY;

export default function Home() {
  const [query, setQuery] = useState('');
  const [similar, setSimilar] = useState([]);
  const [complementary, setComplementary] = useState([]);
  const [dependencies, setDependencies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showDeps, setShowDeps] = useState(false);
  const [error, setError] = useState('');
  const [lang, setLang] = useState('en');
  const [history, setHistory] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const inputRef = useRef(null);
  const suggestionsRef = useRef(null);

  // Загрузка истории
  useEffect(() => {
    const saved = localStorage.getItem('codecombo_history');
    if (saved) setHistory(JSON.parse(saved));
  }, []);

  // Загрузка состояния тумблера
  useEffect(() => {
    const saved = localStorage.getItem('codecombo_showDeps');
    if (saved) setShowDeps(JSON.parse(saved));
  }, []);

  // Авто-поиск из параметра q
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get('q');
    if (q) {
      setQuery(q);
      search(q);
    }
  }, []);

  // АВТОМАТИЧЕСКИЙ ПОИСК ПРИ ПЕРЕКЛЮЧЕНИИ ТУМБЛЕРА
  useEffect(() => {
    if (query) {
      search(query);
    }
  }, [showDeps]);

  // Сохранение состояния тумблера
  useEffect(() => {
    localStorage.setItem('codecombo_showDeps', JSON.stringify(showDeps));
  }, [showDeps]);

  // Закрытие подсказок при клике вне
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target) && inputRef.current !== e.target) {
        setSuggestions([]);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const saveToHistory = (q) => {
    const newHistory = [q, ...history.filter(h => h !== q)].slice(0, 5);
    setHistory(newHistory);
    localStorage.setItem('codecombo_history', JSON.stringify(newHistory));
  };

  const fetchSuggestions = async (value) => {
    if (value.length < 2) {
      setSuggestions([]);
      return;
    }
    const { data } = await supabase
      .from('repositories')
      .select('name')
      .ilike('name', `${value}%`)
      .limit(5);
    setSuggestions(data?.map(r => r.name) || []);
  };

  const search = async (searchQuery = query) => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    setError('');
    setSimilar([]);
    setComplementary([]);
    setDependencies([]);
    saveToHistory(searchQuery);
    setSuggestions([]);

    try {
      // 1. Похожие библиотеки (Libraries.io API)
      if (LIBRARIES_IO_KEY) {
        try {
          const response = await axios.get('https://libraries.io/api/search', {
            params: {
              q: searchQuery,
              api_key: LIBRARIES_IO_KEY,
              per_page: 5
            }
          });
          const formatted = response.data.map(item => ({
            name: item.name,
            description: item.description || 'No description'
          }));
          setSimilar(formatted);
        } catch (e) {
          console.error('Libraries.io error:', e);
        }
      }

      // 2. Комплементарные (co_occurrence)
      const { data: compData, error: compErr } = await supabase
        .from('co_occurrence')
        .select('package_a, package_b, count')
        .or(`package_a.eq.${searchQuery.toLowerCase()},package_b.eq.${searchQuery.toLowerCase()}`)
        .order('count', { ascending: false })
        .limit(10);
      if (compErr) throw compErr;

      const formattedComp = (compData || []).map(item => ({
        name: item.package_a === searchQuery.toLowerCase() ? item.package_b : item.package_a,
        count: item.count
      }));
      setComplementary(formattedComp);

      // 3. Зависимости (если включен тумблер)
      if (showDeps) {
        const { data: depsData, error: depsErr } = await supabase
          .from('dependencies')
          .select('package_name, ecosystem, is_dev_dep')
          .eq('package_name', searchQuery.toLowerCase())
          .limit(10);
        if (depsErr) throw depsErr;
        setDependencies(depsData || []);
      }

      track('search', {
        query: searchQuery,
        results: formattedComp.length,
        similar: similar.length
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const copyInstallCommand = () => {
    if (complementary.length === 0) return;
    const packages = complementary.map(p => p.name).join(' ');
    navigator.clipboard.writeText(`npm install ${packages}`);
    alert(lang === 'en' ? 'Copied!' : 'Скопировано!');
    track('copy_command', { query, packages });
  };

  const shareLink = () => {
    const url = `${window.location.origin}?q=${encodeURIComponent(query)}`;
    navigator.clipboard.writeText(url);
    alert(lang === 'en' ? 'Link copied!' : 'Ссылка скопирована!');
    track('share', { query });
  };

  const t = {
    en: {
      title: 'CodeCombo',
      subtitle: 'Find complementary libraries and dependencies',
      description: 'Enter a library name and discover what other developers often use together with it. Based on real GitHub projects.',
      placeholder: 'Enter library name, e.g.: passport',
      search: 'Search',
      showDeps: 'Show dependencies',
      similar: 'Similar libraries (alternatives)',
      complementary: 'Complementary (often used together)',
      dependencies: 'Dependencies (required)',
      notFound: 'Nothing found. Try another name.',
      error: 'Error',
      copy: 'Copy install command',
      share: 'Share',
      recent: 'Recent searches',
      sources: 'Data from GitHub repositories and Libraries.io'
    },
    ru: {
      title: 'CodeCombo',
      subtitle: 'Поиск комплементарных библиотек и зависимостей',
      description: 'Введите название библиотеки и узнайте, какие библиотеки чаще всего используют вместе с ней. На основе реальных проектов GitHub.',
      placeholder: 'Введите название библиотеки, например: passport',
      search: 'Найти',
      showDeps: 'Показывать зависимости',
      similar: 'Похожие библиотеки (альтернативы)',
      complementary: 'Комплементарные (часто используют вместе)',
      dependencies: 'Зависимости (обязательные)',
      notFound: 'Ничего не найдено. Попробуйте другое название.',
      error: 'Ошибка',
      copy: 'Скопировать команду установки',
      share: 'Поделиться',
      recent: 'Недавние запросы',
      sources: 'Данные из репозиториев GitHub и Libraries.io'
    }
  };

  const text = t[lang];

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-center gap-3 mb-2">
          <h1 className="text-5xl font-bold tracking-wide bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            {text.title}
          </h1>
          <span className="text-4xl">🧩</span>
        </div>
        <p className="text-center text-gray-600 mb-2">{text.subtitle}</p>
        <p className="text-center text-sm text-gray-500 mb-6">{text.description}</p>

        <div className="flex justify-end gap-2 mb-4">
          <button onClick={() => setLang('en')} className={`px-2 py-1 text-sm rounded ${lang === 'en' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>EN</button>
          <button onClick={() => setLang('ru')} className={`px-2 py-1 text-sm rounded ${lang === 'ru' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>RU</button>
        </div>

        {history.length > 0 && (
          <div className="mb-4 text-sm">
            <span className="text-gray-500">{text.recent}:</span>
            {history.map((h, i) => (
              <button
                key={i}
                onClick={() => {
                  setQuery(h);
                  search(h);
                }}
                className="ml-2 text-blue-600 hover:underline"
              >
                {h}
              </button>
            ))}
          </div>
        )}

        <div className="relative mb-4" ref={suggestionsRef}>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              fetchSuggestions(e.target.value);
            }}
            onBlur={() => setTimeout(() => setSuggestions([]), 200)}
            placeholder={text.placeholder}
            className="w-full p-3 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            onKeyDown={(e) => e.key === 'Enter' && search()}
          />
          {suggestions.length > 0 && (
            <ul className="absolute z-10 w-full bg-white border rounded-lg shadow mt-1">
              {suggestions.map((s, i) => (
                <li
                  key={i}
                  className="p-2 hover:bg-gray-100 cursor-pointer"
                  onClick={() => {
                    setQuery(s);
                    setSuggestions([]);
                    search(s);
                  }}
                >
                  {s}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex gap-2 mb-4">
          <button onClick={() => search()} disabled={loading} className="flex-1 bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 disabled:bg-blue-300">
            {loading ? (lang === 'en' ? 'Searching...' : 'Поиск...') : text.search}
          </button>
          <button onClick={shareLink} className="bg-gray-200 p-3 rounded-lg hover:bg-gray-300" title={text.share}>🔗</button>
        </div>

        <div className="flex items-center justify-end gap-3 mb-6">
          <span className="text-sm text-gray-600">{text.showDeps}</span>
          <button onClick={() => setShowDeps(!showDeps)} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${showDeps ? 'bg-blue-600' : 'bg-gray-300'}`}>
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${showDeps ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>

        {error && <div className="bg-red-100 text-red-700 p-4 rounded-lg mb-4">{text.error}: {error}</div>}

        {/* Похожие библиотеки */}
        {similar.length > 0 && (
          <div className="bg-white p-6 rounded-lg shadow mb-6">
            <h2 className="text-xl font-semibold mb-2">{text.similar}</h2>
            <ul className="space-y-2">
              {similar.map((item, idx) => (
                <li key={idx} className="border-b pb-2">
                  <a href={`/package/${item.name}`} className="font-mono text-blue-600 hover:underline">
                    {item.name}
                  </a>
                  <p className="text-sm text-gray-500">{item.description?.substring(0, 100)}</p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Комплементарные */}
        {complementary.length > 0 && (
          <div className="bg-white p-6 rounded-lg shadow mb-6">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-xl font-semibold">{text.complementary}</h2>
              <button onClick={copyInstallCommand} className="text-sm bg-gray-100 px-3 py-1 rounded hover:bg-gray-200">{text.copy}</button>
            </div>
            <ul className="space-y-2">
              {complementary.map((item, idx) => (
                <li key={idx} className="border-b pb-2 flex justify-between">
                  <a href={`/package/${item.name}`} className="font-mono text-green-600 hover:underline">
                    {item.name}
                  </a>
                  <span className="text-sm text-gray-500">in {item.count} projects</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Зависимости */}
        {showDeps && dependencies.length > 0 && (
          <div className="bg-white p-6 rounded-lg shadow mb-6">
            <h2 className="text-xl font-semibold mb-2">{text.dependencies}</h2>
            <ul className="space-y-2">
              {dependencies.map((dep, idx) => (
                <li key={idx} className="border-b pb-2">
                  <span className="font-mono text-purple-600">{dep.package_name}</span>
                  <span className="text-sm text-gray-500 ml-2">({dep.ecosystem}) {dep.is_dev_dep ? 'dev' : 'prod'}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {!loading && !error && complementary.length === 0 && similar.length === 0 && query && (
          <div className="text-center text-gray-500 mt-8">{text.notFound}</div>
        )}

        <footer className="text-center text-sm text-gray-400 mt-12 pt-6 border-t">
          <p>© 2026 CodeCombo · <a href="https://github.com/goloshekov111-code/codecombo" className="underline" target="_blank">GitHub</a> · {text.sources}</p>
        </footer>
      </div>
    </main>
  );
}