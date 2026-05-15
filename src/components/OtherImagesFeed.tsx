"use client";

import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search } from '@mui/icons-material';
import { useStore, FeedItem } from '@/store/useStore';

export default function OtherImagesFeed() {
  const { feedItems, searchQuery, setSearchQuery, openImageViewer } = useStore();

  const otherItems = useMemo(() => {
    let items = feedItems.filter(item => {
      const isWhatsNext = item.deadline !== null || item.importance >= 8 || ['job_application', 'event_attendance'].includes(item.intentType);
      const isWorkingOn = !isWhatsNext && ['study_material', 'general_note'].includes(item.intentType);
      return !isWhatsNext && !isWorkingOn;
    });

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
    <div className="w-full flex flex-col gap-6 overflow-y-auto h-full custom-scrollbar pr-2">
      <div className="flex flex-col gap-3 shrink-0">
        <div className="flex items-center bg-white rounded-xl px-4 py-2 border border-[#e2e2e2] shadow-sm">
          <Search className="text-[#454652] mr-2" fontSize="small" />
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
        <h2 className="text-lg font-bold text-[#1a237e]">Other Images</h2>
        <div className="flex overflow-x-auto gap-4 pb-2 pt-1 snap-x snap-mandatory custom-scrollbar">
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
                  className="min-w-[150px] w-[150px] h-[220px] shrink-0 rounded-[20px] overflow-hidden relative shadow-md cursor-pointer snap-start group bg-black"
                >
                  <img 
                    src={item.imageUrl} alt={item.title} 
                    className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-300"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                  
                  <div className="absolute top-3 left-3 bg-white/20 backdrop-blur-md text-white text-[10px] font-bold px-2 py-1 rounded-md capitalize">
                    {item.intentType.replace('_', ' ')}
                  </div>

                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <h3 className="text-white font-bold text-sm leading-tight mb-1 line-clamp-2">{item.title}</h3>
                    <p className="text-white/80 text-[10px] line-clamp-2">{item.description}</p>
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
