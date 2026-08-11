'use client';

import React, { useState } from 'react';
import { NEWSROOM_CATEGORIES, getNewsroomCategory } from '@/lib/newsroomRegistry';
import NewsroomCategoryForm from '@/components/NewsroomCategoryForm';

export default function NewsroomPage() {
  const [activeCategoryId, setActiveCategoryId] = useState('games');

  const activeCategory = getNewsroomCategory(activeCategoryId) || NEWSROOM_CATEGORIES[0];

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <h1>📰 Newsroom</h1>
        <p>Automate news updates, release announcements, and discussion threads across Games, Anime, Movies, and Music.</p>
      </div>

      <div className="dashboard-layout" style={{ padding: 0 }}>
        {/* Left Sidebar Master */}
        <aside className="sidebar-master">
          <div className="sidebar-title">Newsroom Categories</div>
          {NEWSROOM_CATEGORIES.map((cat) => {
            const isActive = cat.id === activeCategory.id;
            return (
              <button
                key={cat.id}
                className={`sidebar-item ${isActive ? 'active' : ''}`}
                onClick={() => setActiveCategoryId(cat.id)}
                id={`sidebar-newsroom-${cat.id}`}
              >
                <span>{cat.icon}</span>
                <span>{cat.name}</span>
              </button>
            );
          })}
        </aside>

        {/* Right Detail Content Area */}
        <div className="detail-content">
          <NewsroomCategoryForm category={activeCategory} />
        </div>
      </div>
    </div>
  );
}
