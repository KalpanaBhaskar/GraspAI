"use client";

import React, { useRef, useState } from 'react';
import WhatsNextFeed from '@/components/WhatsNextFeed';
import OtherImagesFeed from '@/components/OtherImagesFeed';
import ChatView from '@/components/ChatView';
import ImageViewerModal from '@/components/ImageViewerModal';
import { AddAPhoto, Home as HomeIcon, Image as ImageIcon, ChatBubble as ChatIcon, PhotoLibrary } from '@mui/icons-material';
import { useUploadImage } from '@/hooks/useUploadImage';
import { useStore } from '@/store/useStore';
import { v4 as uuidv4 } from 'uuid';

export default function Home() {
  const { uploadImage, isUploading, isStitching, error: uploadError } = useUploadImage();
  const { addFeedItem, currentView, setCurrentView } = useStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sidebarHovered, setSidebarHovered] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const result = await uploadImage(file);
    if (result && result.analysis) {
      console.log('Successfully uploaded and stitched image!', result.publicUrl);
      
      addFeedItem({
        id: uuidv4(),
        title: result.analysis.subject || "New Intent Captured",
        description: result.analysis.suggested_action || result.analysis.raw_text?.substring(0, 80) + "...",
        deadline: result.analysis.entities?.deadline || null,
        importance: Math.round(result.analysis.priority_weight * 10) || 5,
        imageUrl: result.publicUrl,
        intentType: result.analysis.intent || "general_note",
        chainId: result.analysis.chain_id || "uncategorized",
        createdAt: new Date().toISOString()
      });
    }
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const navItems = [
    { key: 'home' as const, icon: <HomeIcon fontSize="small" />, label: 'Home' },
    { key: 'other' as const, icon: <ImageIcon fontSize="small" />, label: 'Other Images' },
    { key: 'chat' as const, icon: <ChatIcon fontSize="small" />, label: 'Ask Me Anything' },
  ];

  return (
    <main className="min-h-screen bg-[#e6f2ff] flex items-center justify-center p-4 sm:p-8">
      {/* Image Viewer Modal (global overlay) */}
      <ImageViewerModal />

      {/* Desktop Dashboard Container */}
      <div className="w-full max-w-6xl bg-[#f1f1f1] rounded-[32px] overflow-hidden shadow-2xl border-4 border-[#e2e2e2] relative h-[85vh] min-h-[600px] flex flex-row">
        
        {/* LEFT PANEL (Sidebar) — collapses to icons, expands on hover */}
        <div 
          className={`bg-white border-r border-[#e2e2e2] flex flex-col py-6 shrink-0 transition-all duration-300 ease-in-out ${sidebarHovered ? 'w-56 px-4' : 'w-16 px-2'}`}
          onMouseEnter={() => setSidebarHovered(true)}
          onMouseLeave={() => setSidebarHovered(false)}
        >
          {/* Logo — Photo cluster icon */}
          <div className="mb-6 flex items-center gap-3 overflow-hidden justify-center">
            <PhotoLibrary sx={{ fontSize: sidebarHovered ? 28 : 24, color: '#1a237e' }} />
            {sidebarHovered && (
              <span className="text-lg font-serif italic text-[#1a237e] font-bold tracking-wide whitespace-nowrap">
                GraspAI
              </span>
            )}
          </div>

          {/* User Profile */}
          <div className={`flex items-center gap-3 mb-8 p-2 bg-gray-50 rounded-2xl border border-gray-100 overflow-hidden ${sidebarHovered ? '' : 'justify-center'}`}>
            <div className="w-8 h-8 rounded-full bg-blue-200 flex items-center justify-center text-[#1a237e] font-bold text-sm shrink-0">
              EU
            </div>
            {sidebarHovered && (
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-gray-800 truncate">Example User</span>
                <span className="text-[9px] text-gray-500 leading-tight truncate">Testing & Dev Mode</span>
              </div>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex flex-col gap-2 flex-1">
            {navItems.map(item => (
              <button
                key={item.key}
                onClick={() => setCurrentView(item.key)}
                title={item.label}
                className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all overflow-hidden ${
                  currentView === item.key 
                    ? 'bg-[#e0e0ff] text-[#1a237e] font-bold' 
                    : 'text-gray-600 hover:bg-gray-50'
                } ${sidebarHovered ? '' : 'justify-center'}`}
              >
                {item.icon}
                {sidebarHovered && <span className="text-sm whitespace-nowrap">{item.label}</span>}
              </button>
            ))}
          </nav>

          {/* Upload Button */}
          <div className="mt-auto">
            <input 
              type="file" 
              accept="image/png, image/jpeg, image/jpg" 
              className="hidden" 
              ref={fileInputRef}
              onChange={handleFileChange}
            />
            <button 
              onClick={triggerFileInput}
              disabled={isUploading || isStitching}
              title="Upload Image"
              className={`w-full py-3 rounded-xl bg-[#1a237e] text-white flex items-center justify-center gap-2 shadow-md transition-all ${(isUploading || isStitching) ? 'opacity-70 cursor-not-allowed' : 'hover:bg-[#4355b9]'}`}
            >
              {(isUploading || isStitching) ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <AddAPhoto fontSize="small" />
                  {sidebarHovered && <span className="font-semibold text-sm">Upload</span>}
                </>
              )}
            </button>
          </div>
        </div>

        {/* MAIN CONTENT AREA */}
        <div className="flex-1 flex flex-col relative bg-[#f1f1f1]">
          {/* Header */}
          <div className="px-8 pt-6 pb-3 flex justify-between items-end">
            <div>
              <h1 className="text-3xl font-serif italic text-[#1a237e] font-bold tracking-wide">GraspAI</h1>
              <p className="text-xs text-gray-500 mt-0.5">
                {currentView === 'home' && 'Your intelligent memory graph'}
                {currentView === 'other' && 'Receipts, contacts & more'}
                {currentView === 'chat' && 'Ask anything about your memories'}
              </p>
            </div>
          </div>

          {/* Stitching Indicator */}
          {isStitching && (
            <div className="mx-8 mb-2 bg-[#e0e0ff] text-[#1a237e] text-xs font-semibold px-4 py-2 text-center animate-pulse rounded-xl">
              Stitching into Memory...
            </div>
          )}

          {/* Upload Error */}
          {uploadError && (
            <div className="mx-8 mb-2 bg-red-50 text-red-700 text-xs font-semibold px-4 py-2 text-center rounded-xl border border-red-200">
              {uploadError}
            </div>
          )}

          {/* Active View */}
          <div className="flex-1 overflow-hidden px-8 pb-8">
            {currentView === 'home' && <WhatsNextFeed />}
            {currentView === 'other' && <OtherImagesFeed />}
            {currentView === 'chat' && <ChatView />}
          </div>
        </div>

      </div>
    </main>
  );
}
