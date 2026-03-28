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
  const [complementary, setComplementary] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const resolveParams = async () => {
      const resolved = await params;
      // Декодируем имя из URL
      setName(decodeURIComponent(resolved.name));
    };
    resolveParams();
  }, [params]);

  useEffect(() => {
    if (!name) return;

    const fetchData = async () => {
      setLoading(true);
      
      const { data: compData, error } = await supabase
        .from('co_occurrence')
        .select('package_a, package_b, count')
        .or(`package_a.eq.${name},package_b.eq.${name}`)
        .order('count', { ascending: false })
        .limit(20);

      if (error) {
        console.error(error);
        setComplementary([]);
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

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-3xl mx-auto">
        <a href={`/?q=${encodeURIComponent(name)}`} className="text-blue-600 hover:underline mb-4 inline-block">
          ← Back to search
        </a>
        
        <h1 className="text-3xl font-bold mb-2">{name}</h1>
        <p className="text-gray-600 mb-6">Complementary libraries for {name}</p>

        <h2 className="text-xl font-semibold mb-4">Complementary (often used together)</h2>
        {complementary.length > 0 ? (
          <ul className="space-y-2">
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
          <p className="text-gray-500">No complementary libraries found yet.</p>
        )}
      </div>
    </main>
  );
}