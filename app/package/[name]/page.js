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
      setName(resolved.name);
    };
    resolveParams();
  }, [params]);

  useEffect(() => {
    if (!name) return;

    const fetchData = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('co_occurrence')
        .select('package_a, package_b, count')
        .or(`package_a.eq.${name},package_b.eq.${name}`)
        .order('count', { ascending: false })
        .limit(20);
      if (error) {
        console.error(error);
        setComplementary([]);
      } else {
        const formatted = data.map(item => ({
          name: item.package_a === name ? item.package_b : item.package_a,
          count: item.count
        }));
        setComplementary(formatted);
      }
      setLoading(false);
    };
    fetchData();
  }, [name]);

  if (loading) return <div>Loading...</div>;

  return (
    <div className="p-8">
      <a href="/" className="text-blue-600 underline">← Back</a>
      <h1 className="text-3xl font-bold mb-2">{name}</h1>
      <h2 className="text-xl font-semibold mb-4">Complementary</h2>
      <ul>
        {complementary.map((item, idx) => (
          <li key={idx}>
            <a href={`/package/${item.name}?q=${name}`}>{item.name}</a> (in {item.count} projects)
          </li>
        ))}
      </ul>
    </div>
  );
}