'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useParams } from 'next/navigation';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function PackagePage() {
  const params = useParams();
  const [name, setName] = useState('');
  const [metadata, setMetadata] = useState(null);
  const [complementary, setComplementary] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const resolveParams = async () => {
      const resolved = await params;
      setName(decodeURIComponent(resolved.name));
    };
    resolveParams();
  }, [params]);

  useEffect(() => {
    if (!name) return;

    const fetchData = async () => {
      setLoading(true);
      
      // 1. Метаданные из package_metadata
      const { data: metaData, error: metaError } = await supabase
        .from('package_metadata')
        .select('*')
        .eq('name', name)
        .maybeSingle();
      
      if (metaError) {
        console.error('Ошибка загрузки метаданных:', metaError);
      }
      setMetadata(metaData);
      
      // 2. Комплементарные связи (co_occurrence)
      const { data: compData, error: compErr } = await supabase
        .from('co_occurrence')
        .select('package_a, package_b, count')
        .or(`package_a.eq.${name},package_b.eq.${name}`)
        .order('count', { ascending: false })
        .limit(20);
      
      if (compErr) {
        console.error(compErr);
      } else {
        const formatted = (compData || []).map(item => ({
          name: item.package_a === name ? item.package_b : item.package_a,
          count: item.count
        }));
        setComplementary(formatted);
      }
      
      setLoading(false);
    };

    fetchData();
  }, [name]);

  if (loading) return <div className="p-8 text-center">Loading...</div>;

  // Форматирование чисел
  const formatNumber = (num) => {
    if (!num) return '—';
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(0)}k`;
    return num.toString();
  };

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-3xl mx-auto">
        <a href={`/?q=${encodeURIComponent(name)}`} className="text-blue-600 hover:underline mb-4 inline-block">
          ← Back to search
        </a>
        
        {/* Заголовок и описание */}
        <h1 className="text-3xl font-bold mb-2">{name}</h1>
        {metadata?.description && (
          <p className="text-gray-600 mb-4">{metadata.description}</p>
        )}
        
        {/* Статистика */}
        <div className="flex flex-wrap gap-4 mb-6 text-sm text-gray-500">
          {metadata?.stars > 0 && (
            <span>⭐ {formatNumber(metadata.stars)} stars</span>
          )}
          {metadata?.downloads > 0 && (
            <span>📦 {formatNumber(metadata.downloads)} downloads/month</span>
          )}
          {metadata?.license && (
            <span>📄 {metadata.license}</span>
          )}
        </div>
        
        {/* Ссылки */}
        {(metadata?.github_url || metadata?.npm_url) && (
          <div className="flex gap-4 mb-8">
            {metadata?.github_url && (
              <a href={metadata.github_url} target="_blank" rel="noopener noreferrer" 
                 className="text-blue-600 hover:underline">
                🔗 GitHub
              </a>
            )}
            {metadata?.npm_url && (
              <a href={metadata.npm_url} target="_blank" rel="noopener noreferrer" 
                 className="text-blue-600 hover:underline">
                📦 npm
              </a>
            )}
          </div>
        )}

        {/* Комплементарные */}
        <h2 className="text-xl font-semibold mb-4">🧩 Complementary (often used together)</h2>
        {complementary.length > 0 ? (
          <ul className="space-y-2 mb-8">
            {complementary.map((item, idx) => (
              <li key={idx} className="border-b pb-2 flex justify-between">
                <a href={`/package/${encodeURIComponent(item.name)}`} className="font-mono text-green-600 hover:underline">
                  {item.name}
                </a>
                <span className="text-sm text-gray-500">in {item.count} projects</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500 mb-8">No complementary libraries found yet.</p>
        )}
      </div>
    </main>
  );
}