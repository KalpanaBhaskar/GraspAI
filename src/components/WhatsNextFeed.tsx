"use client";

import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search } from '@mui/icons-material';
import { useStore, FeedItem } from '@/store/useStore';
import ChatbotInput from './ChatbotInput';

export default function WhatsNextFeed() {
  const { feedItems, searchQuery, setSearchQuery, openImageViewer } = useStore();

  const filteredItems = useMemo(() => {
    let items = feedItems;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      items = items.filter(item => 
        item.title.toLowerCase().includes(q) || 
        item.description.toLowerCase().includes(q)
      );
    }
    return items;
  }, [feedItems, searchQuery]);

  // What's Next: items with category "whats_next" — sorted by deadline first, then importance
  const whatsNextItems = useMemo(() => {
    return filteredItems
      .filter(item => item.category === 'whats_next')
      .sort((a, b) => {
        if (a.deadline && b.deadline) return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
        if (a.deadline) return -1;
        if (b.deadline) return 1;
        return b.importance - a.importance;
      });
  }, [filteredItems]);

  // Working On: items with category "working_on", grouped by chainId, sorted by most recent upload
  const workingOnClusters = useMemo(() => {
    const workingItems = filteredItems.filter(item => item.category === 'working_on');

    const clusters: Record<string, FeedItem[]> = {};
    workingItems.forEach(item => {
      if (!clusters[item.chainId]) clusters[item.chainId] = [];
      clusters[item.chainId].push(item);
    });

    return Object.values(clusters).sort((a, b) => {
      const latestA = Math.max(...a.map(i => new Date(i.createdAt).getTime()));
      const latestB = Math.max(...b.map(i => new Date(i.createdAt).getTime()));
      return latestB - latestA;
    });
  }, [filteredItems]);

  // Single card click → open just that one image
  const handleSingleClick = (item: FeedItem) => {
    openImageViewer([item.imageUrl], 0, item.title);
  };

  // Cluster card click → open all images in that cluster with navigation
  const handleClusterClick = (cluster: FeedItem[], startIndex: number = 0) => {
    const images = cluster.map(item => item.imageUrl);
    const title = cluster[0].title;
    openImageViewer(images, startIndex, title);
  };

  return (
    <div className="w-full flex flex-col gap-5 overflow-y-auto h-full custom-scrollbar pr-1">
      {/* Search */}
      <div className="flex flex-col gap-3 shrink-0">
        <div className="flex items-center bg-white rounded-xl px-4 py-2 border border-[#e2e2e2] shadow-sm">
          <Search className="text-[#454652] mr-2" sx={{ fontSize: 18 }} />
          <input
            type="text"
            placeholder="Search memory graph..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent border-none outline-none text-sm text-[#1a1c1c] placeholder:text-[#767683]"
          />
        </div>
      </div>

      {/* Section 1: What's Next */}
      <div className="flex flex-col gap-2.5 shrink-0">
        <h2 className="text-base sm:text-lg font-bold text-[#1a237e]">What&apos;s next?</h2>
        <div className="flex overflow-x-auto gap-3 sm:gap-4 pb-2 pt-1 snap-x snap-mandatory custom-scrollbar" style={{ scrollbarGutter: 'stable' }}>
          <AnimatePresence>
            {whatsNextItems.length === 0 ? (
              <div className="text-[#767683] text-sm italic py-4">No upcoming tasks or deadlines.</div>
            ) : (
              whatsNextItems.map(item => (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  whileHover={{ y: -4 }}
                  onClick={() => handleSingleClick(item)}
                  className="min-w-[130px] w-[130px] sm:min-w-[150px] sm:w-[150px] h-[190px] sm:h-[220px] shrink-0 rounded-[18px] sm:rounded-[20px] overflow-hidden relative shadow-md cursor-pointer snap-start group bg-black"
                >
                  <img 
                    src={item.imageUrl} alt={item.title} 
                    className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-300"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                  {item.deadline && (
                    <div className="absolute top-2.5 left-2.5 bg-[#ffdad6] text-[#ba1a1a] text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-md shadow-sm">
                      Due: {new Date(item.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4">
                    <h3 className="text-white font-bold text-xs sm:text-sm leading-tight mb-0.5 line-clamp-2">{item.title}</h3>
                    <p className="text-white/80 text-[9px] sm:text-[10px] line-clamp-2">{item.description}</p>
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Section 2: What You Are Working On */}
      <div className="flex flex-col gap-2.5 shrink-0">
        <h2 className="text-base sm:text-lg font-bold text-[#1a237e]">What you are working on</h2>
        <div className="flex overflow-x-auto gap-3 sm:gap-4 pb-2 pt-1 snap-x snap-mandatory custom-scrollbar" style={{ scrollbarGutter: 'stable' }}>
          <AnimatePresence>
            {workingOnClusters.length === 0 ? (
              <div className="text-[#767683] text-sm italic py-4">No recent workspaces found.</div>
            ) : (
              workingOnClusters.map(cluster => {
                const primaryItem = cluster[0];
                const hasMultiple = cluster.length > 1;
                return (
                  <motion.div
                    key={primaryItem.chainId}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    whileHover={{ y: -4 }}
                    onClick={() => handleClusterClick(cluster)}
                    className="min-w-[130px] w-[130px] sm:min-w-[150px] sm:w-[150px] h-[190px] sm:h-[220px] shrink-0 rounded-[18px] sm:rounded-[20px] overflow-hidden relative shadow-md cursor-pointer snap-start group bg-black"
                  >
                    <img 
                      src={primaryItem.imageUrl} alt={primaryItem.title} 
                      className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-300"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                    
                    {hasMultiple && (
                      <div className="absolute top-2.5 right-2.5 bg-white/20 backdrop-blur-md text-white text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-md">
                        {cluster.length} images
                      </div>
                    )}

                    <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4">
                      <h3 className="text-white font-bold text-xs sm:text-sm leading-tight mb-0.5 line-clamp-2">{primaryItem.title}</h3>
                      <p className="text-white/80 text-[9px] sm:text-[10px] line-clamp-2">{primaryItem.description}</p>
                    </div>
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Bottom Chat Shortcut */}
      <div className="mt-auto shrink-0 pb-1">
        <ChatbotInput />
      </div>
    </div>
  );
}
