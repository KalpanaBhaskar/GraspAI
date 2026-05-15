"use client";

import React, { useRef, useState } from 'react';
import WhatsNextFeed from '@/components/WhatsNextFeed';
import OtherImagesFeed from '@/components/OtherImagesFeed';
import ChatView from '@/components/ChatView';
import CollectionsView from '@/components/CollectionsView';
import ImageViewerModal from '@/components/ImageViewerModal';
import { AddAPhoto, Home as HomeIcon, Image as ImageIcon, ChatBubble as ChatIcon, PhotoLibrary, Bookmark } from '@mui/icons-material';
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
        importance: Math.round((result.analysis.priority_weight || 0.5) * 10),
        imageUrl: result.publicUrl,
        intentType: result.analysis.intent || "general_note",
        chainId: result.analysis.chain_id || "uncategorized",
        category: result.analysis.category || "other",
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
    { key: 'home' as const, icon: <HomeIcon sx={{ fontSize: 20 }} />, label: 'Home' },
    { key: 'other' as const, icon: <ImageIcon sx={{ fontSize: 20 }} />, label: 'Other Images' },
    { key: 'collections' as const, icon: <Bookmark sx={{ fontSize: 20 }} />, label: 'Collections' },
    { key: 'chat' as const, icon: <ChatIcon sx={{ fontSize: 20 }} />, label: 'Ask Me Anything' },
  ];

  return (
    <main className="min-h-screen min-h-[100dvh] bg-[#e6f2ff] flex items-center justify-center p-0 sm:p-6 lg:p-8">
      {/* Image Viewer Modal (global overlay) */}
      <ImageViewerModal />

      {/* Dashboard Container — full-screen on mobile, floating card on desktop */}
      <div className="w-full h-screen sm:h-[88vh] sm:max-w-6xl bg-[#f1f1f1] sm:rounded-[32px] overflow-hidden sm:shadow-2xl sm:border-4 sm:border-[#e2e2e2] relative flex flex-row">
        
        {/* LEFT PANEL (Sidebar) — collapses to icons, expands on hover */}
        <div 
          className={`bg-white border-r border-[#e2e2e2] flex-col py-4 sm:py-6 shrink-0 transition-all duration-300 ease-in-out hidden sm:flex ${sidebarHovered ? 'w-52 px-3' : 'w-14 px-1.5'}`}
          onMouseEnter={() => setSidebarHovered(true)}
          onMouseLeave={() => setSidebarHovered(false)}
        >
          {/* Logo — Photo cluster icon */}
          <div className="mb-5 flex items-center gap-2.5 overflow-hidden justify-center">
            <PhotoLibrary sx={{ fontSize: sidebarHovered ? 26 : 22, color: '#1a237e' }} />
            {sidebarHovered && (
              <span className="text-base font-serif italic text-[#1a237e] font-bold tracking-wide whitespace-nowrap">
                GraspAI
              </span>
            )}
          </div>

          {/* User Profile */}
          <div className={`flex items-center gap-2.5 mb-6 p-2 bg-gray-50 rounded-xl border border-gray-100 overflow-hidden ${sidebarHovered ? '' : 'justify-center'}`}>
            <div className="w-7 h-7 rounded-full bg-blue-200 flex items-center justify-center text-[#1a237e] font-bold text-xs shrink-0">
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
          <nav className="flex flex-col gap-1.5 flex-1">
            {navItems.map(item => (
              <button
                key={item.key}
                onClick={() => setCurrentView(item.key)}
                title={item.label}
                className={`flex items-center gap-2.5 px-2.5 py-2.5 rounded-xl transition-all overflow-hidden ${
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
              className={`w-full py-2.5 rounded-xl bg-[#1a237e] text-white flex items-center justify-center gap-2 shadow-md transition-all ${(isUploading || isStitching) ? 'opacity-70 cursor-not-allowed' : 'hover:bg-[#4355b9]'}`}
            >
              {(isUploading || isStitching) ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <AddAPhoto sx={{ fontSize: 18 }} />
                  {sidebarHovered && <span className="font-semibold text-sm">Upload</span>}
                </>
              )}
            </button>
          </div>
        </div>

        {/* MAIN CONTENT AREA */}
        <div className="flex-1 flex flex-col relative bg-[#f1f1f1] min-w-0">
          {/* Header */}
          <div className="px-4 sm:px-8 pt-4 sm:pt-6 pb-2 sm:pb-3 flex justify-between items-end shrink-0">
            <div>
              <h1 className="text-2xl sm:text-3xl font-serif italic text-[#1a237e] font-bold tracking-wide">GraspAI</h1>
              <p className="text-[11px] sm:text-xs text-gray-500 mt-0.5">
                {currentView === 'home' && 'Your intelligent memory graph'}
                {currentView === 'other' && 'Receipts, contacts & more'}
                {currentView === 'chat' && 'Ask anything about your memories'}
                {currentView === 'collections' && 'Your saved image clusters'}
              </p>
            </div>
          </div>

          {/* Stitching Indicator */}
          {isStitching && (
            <div className="mx-4 sm:mx-8 mb-2 bg-[#e0e0ff] text-[#1a237e] text-xs font-semibold px-4 py-2 text-center animate-pulse rounded-xl shrink-0">
              Stitching into Memory...
            </div>
          )}

          {/* Upload Error */}
          {uploadError && (
            <div className="mx-4 sm:mx-8 mb-2 bg-red-50 text-red-700 text-xs font-semibold px-4 py-2 text-center rounded-xl border border-red-200 shrink-0">
              {uploadError}
            </div>
          )}

          {/* Active View */}
          <div className="flex-1 overflow-hidden px-4 sm:px-8 pb-4 sm:pb-8">
            {currentView === 'home' && <WhatsNextFeed />}
            {currentView === 'other' && <OtherImagesFeed />}
            {currentView === 'chat' && <ChatView />}
            {currentView === 'collections' && <CollectionsView />}
          </div>

          {/* Mobile Bottom Nav */}
          <div className="sm:hidden flex items-center justify-around bg-white border-t border-gray-200 py-2 shrink-0">
            {navItems.map(item => (
              <button
                key={item.key}
                onClick={() => setCurrentView(item.key)}
                className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors ${
                  currentView === item.key ? 'text-[#1a237e]' : 'text-gray-400'
                }`}
              >
                {item.icon}
                <span className="text-[9px] font-medium">{item.label.split(' ')[0]}</span>
              </button>
            ))}
            <button
              onClick={triggerFileInput}
              disabled={isUploading || isStitching}
              className="flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg text-[#1a237e]"
            >
              <AddAPhoto sx={{ fontSize: 20 }} />
              <span className="text-[9px] font-medium">Upload</span>
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
