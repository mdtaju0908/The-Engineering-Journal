'use client';

import { BlogListPage } from '@/components/BlogListPage';
import { useParams } from 'next/navigation';

export default function CategoryPage() {
  const params = useParams();
  const category = params.category as string;
  
  return <BlogListPage initialCategory={category} />;
}
