import React from 'react';
import { notFound } from 'next/navigation';
import { getNewsroomCategory, NEWSROOM_CATEGORIES } from '@/lib/newsroomRegistry';
import NewsroomCategoryForm from '@/components/NewsroomCategoryForm';

interface PageProps {
  params: Promise<{
    category: string;
  }>;
}

export default async function NewsroomCategoryPage({ params }: PageProps) {
  const resolvedParams = await params;
  const categoryId = resolvedParams.category;
  const category = getNewsroomCategory(categoryId);

  if (!category) {
    notFound();
  }

  return (
    <div className="space-y-6">
      {/* Category Selection Tabs Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-800">
        {NEWSROOM_CATEGORIES.map((cat) => {
          const isActive = cat.id === category.id;
          return (
            <a
              key={cat.id}
              href={`/dashboard/newsroom/${cat.id}`}
              className={`px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-slate-900/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <span>{cat.icon}</span>
              <span>{cat.name}</span>
            </a>
          );
        })}
      </div>

      {/* Main Category Form */}
      <NewsroomCategoryForm category={category} />
    </div>
  );
}
