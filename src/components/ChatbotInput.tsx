"use client";

import React from 'react';
import { Send } from '@mui/icons-material';

import { useStore } from '@/store/useStore';

export default function ChatbotInput() {
  const { setCurrentView } = useStore();

  return (
    <div 
      onClick={() => setCurrentView('chat')}
      className="w-full flex items-center bg-[#ffffff] rounded-2xl p-2 border border-gray-200 shadow-sm mt-6 cursor-pointer hover:border-[#1a237e] transition-colors"
    >
      <input
        type="text"
        placeholder="Ask anything about your memories..."
        readOnly
        className="flex-1 bg-transparent border-none outline-none text-sm px-4 text-[#1a1c1c] placeholder:text-[#454652] cursor-pointer"
      />
      <button className="bg-[#1a237e] text-white p-3 rounded-xl flex items-center justify-center transition-colors">
        <Send fontSize="small" />
      </button>
    </div>
  );
}
