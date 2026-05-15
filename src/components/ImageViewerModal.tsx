"use client";

import React from 'react';
import { Close, ArrowBackIos, ArrowForwardIos } from '@mui/icons-material';
import { useStore } from '@/store/useStore';

export default function ImageViewerModal() {
  const { viewingImages, viewingImageIndex, viewingClusterTitle, closeImageViewer, nextImage, prevImage } = useStore();

  if (viewingImages.length === 0) return null;

  const currentImage = viewingImages[viewingImageIndex];
  const hasMultiple = viewingImages.length > 1;
  const hasPrev = viewingImageIndex > 0;
  const hasNext = viewingImageIndex < viewingImages.length - 1;

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn"
      onClick={closeImageViewer}
    >
      {/* Close Button */}
      <button
        onClick={closeImageViewer}
        className="absolute top-6 right-6 w-10 h-10 rounded-full bg-white/20 text-white flex items-center justify-center hover:bg-white/40 transition-colors z-10"
      >
        <Close />
      </button>

      {/* Cluster Title + Counter */}
      {hasMultiple && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-1">
          {viewingClusterTitle && (
            <span className="text-white/90 font-bold text-sm">{viewingClusterTitle}</span>
          )}
          <span className="text-white/60 text-xs">
            {viewingImageIndex + 1} of {viewingImages.length}
          </span>
        </div>
      )}

      {/* Prev Arrow */}
      {hasPrev && (
        <button
          onClick={(e) => { e.stopPropagation(); prevImage(); }}
          className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/15 text-white flex items-center justify-center hover:bg-white/30 transition-colors z-10"
        >
          <ArrowBackIos fontSize="small" className="ml-1" />
        </button>
      )}

      {/* Image */}
      <img 
        src={currentImage}
        alt="Full resolution view"
        onClick={(e) => e.stopPropagation()} 
        className="max-w-[85vw] max-h-[85vh] object-contain rounded-2xl shadow-2xl"
      />

      {/* Next Arrow */}
      {hasNext && (
        <button
          onClick={(e) => { e.stopPropagation(); nextImage(); }}
          className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/15 text-white flex items-center justify-center hover:bg-white/30 transition-colors z-10"
        >
          <ArrowForwardIos fontSize="small" />
        </button>
      )}

      {/* Dot Indicators */}
      {hasMultiple && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-10">
          {viewingImages.map((_, i) => (
            <div 
              key={i} 
              className={`w-2 h-2 rounded-full transition-all ${i === viewingImageIndex ? 'bg-white w-6' : 'bg-white/40'}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
