"use client";

import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search } from '@mui/icons-material';
import { useStore, FeedItem } from '@/store/useStore';

export default function OtherImagesFeed() {
  const { feedItems, searchQuery, setSearchQuery, openImageViewer } = useStore();

  const otherItems = useMemo(() => {
    let items = feedItems.filter(item => item.category === 'other');

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      items = items.filter(item => 
        item.title.toLowerCase().includes(q) || 
        item.description.toLowerCase().includes(q)
      );
    }
    
    return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [feedItems, searchQuery]);

  const handleCardClick = (item: FeedItem) => {
    openImageViewer([item.imageUrl], 0, item.title);
  };

  return (
    <div className="w-full flex flex-col gap-6 overflow-y-auto h-full custom-scrollbar pr-1">
      <div className="flex flex-col gap-3 shrink-0">
        <div className="flex items-center bg-white rounded-xl px-4 py-2 border border-[#e2e2e2] shadow-sm">
          <Search className="text-[#454652] mr-2" sx={{ fontSize: 18 }} />
          <input
            type="text"
            placeholder="Search other images..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent border-none outline-none text-sm text-[#1a1c1c] placeholder:text-[#767683]"
          />
        </div>
      </div>

      <div className="flex flex-col gap-3 shrink-0">
        <h2 className="text-base sm:text-lg font-bold text-[#1a237e]">Other Images</h2>
        <div className="flex overflow-x-auto gap-3 sm:gap-4 pb-2 pt-1 snap-x snap-mandatory custom-scrollbar">
          <AnimatePresence>
            {otherItems.length === 0 ? (
              <div className="text-[#767683] text-sm italic py-4">No other images found.</div>
            ) : (
              otherItems.map(item => (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  whileHover={{ y: -4 }}
                  onClick={() => handleCardClick(item)}
                  className="min-w-[130px] w-[130px] sm:min-w-[150px] sm:w-[150px] h-[190px] sm:h-[220px] shrink-0 rounded-[18px] sm:rounded-[20px] overflow-hidden relative shadow-md cursor-pointer snap-start group bg-black"
                >
                  <img 
                    src={item.imageUrl} alt={item.title} 
                    className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-300"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                  
                  <div className="absolute top-2.5 left-2.5 bg-white/20 backdrop-blur-md text-white text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-md capitalize">
                    {item.intentType.replace('_', ' ')}
                  </div>

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
    </div>
  );
}
