"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Delete, Collections as CollectionsIcon } from '@mui/icons-material';
import { useStore } from '@/store/useStore';

export default function CollectionsView() {
  const { savedClusters, deleteSavedCluster, openImageViewer } = useStore();

  if (savedClusters.length === 0) {
    return (
      <div className="w-full flex flex-col items-center justify-center h-full gap-4 text-center">
        <CollectionsIcon sx={{ fontSize: 48, color: '#c5c5ff' }} />
        <div>
          <h2 className="text-lg font-bold text-[#1a237e] mb-1">No saved collections yet</h2>
          <p className="text-sm text-gray-500 max-w-xs">
            Use the chatbot to find related images, then click the bookmark icon to save clusters here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-6 overflow-y-auto h-full custom-scrollbar pr-2">
      <h2 className="text-lg font-bold text-[#1a237e] shrink-0">Your Collections</h2>
      
      <div className="flex flex-col gap-4">
        <AnimatePresence>
          {savedClusters.map((cluster) => (
            <motion.div
              key={cluster.id}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -100 }}
              className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-[#e8eaf6] to-[#e0e0ff]">
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-[#1a237e]">{cluster.title}</span>
                  <span className="text-[10px] text-[#4355b9]">
                    {cluster.images.length} image{cluster.images.length > 1 ? 's' : ''} · Saved {new Date(cluster.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
                <button
                  onClick={() => deleteSavedCluster(cluster.id)}
                  title="Delete collection"
                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                >
                  <Delete sx={{ fontSize: 18 }} />
                </button>
              </div>
              
              {/* Image Thumbnails */}
              <div className="flex gap-2 p-3 overflow-x-auto no-scrollbar">
                {cluster.images.map((imgUrl, i) => (
                  <div 
                    key={i}
                    onClick={() => openImageViewer(cluster.images, i, cluster.title)}
                    className="w-20 h-20 rounded-xl overflow-hidden cursor-pointer border-2 border-transparent hover:border-[#1a237e] transition-all shrink-0 shadow-sm"
                  >
                    <img src={imgUrl} alt={`${cluster.title} ${i + 1}`} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
