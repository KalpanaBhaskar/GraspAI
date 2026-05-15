"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Send, SmartToy, Person, Bookmark, BookmarkBorder } from '@mui/icons-material';
import { useStore } from '@/store/useStore';
import { v4 as uuidv4 } from 'uuid';

interface ClusterData {
  chainId: string;
  title: string;
  images: string[];
  deadline: string | null;
  intent: string;
  imageCount: number;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  images?: string[];
  clusters?: ClusterData[];
}

export default function ChatView() {
  const { openImageViewer, addSavedCluster, savedClusters } = useStore();
  const [messages, setMessages] = useState<Message[]>([{
    role: 'assistant',
    content: "Hi! I'm GraspAI. I can search your uploaded memories, find related images, and create clusters for you. Try asking:\n• \"Show me all my study notes\"\n• \"List my internship applications\"\n• \"Find my database notes\""
  }]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const isClusterSaved = (chainId: string) => {
    return savedClusters.some(c => c.chainId === chainId);
  };

  const handleSaveCluster = (cluster: ClusterData) => {
    if (isClusterSaved(cluster.chainId)) return;
    addSavedCluster({
      id: uuidv4(),
      title: cluster.title,
      images: cluster.images,
      chainId: cluster.chainId,
      createdAt: new Date().toISOString(),
    });
  };

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage = inputValue.trim();
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setInputValue('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || 'Chat request failed');
      }

      const data = await res.json();
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.answer,
        images: data.images || [],
        clusters: data.clusters || [],
      }]);
    } catch (error: any) {
      console.error(error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `Sorry, something went wrong: ${error.message}` 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden relative">
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 custom-scrollbar" ref={scrollRef}>
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`flex max-w-[90%] gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-1 ${msg.role === 'user' ? 'bg-[#1a237e] text-white' : 'bg-blue-100 text-[#1a237e]'}`}>
                {msg.role === 'user' ? <Person sx={{ fontSize: 16 }} /> : <SmartToy sx={{ fontSize: 16 }} />}
              </div>
              <div className={`flex flex-col gap-2 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`px-4 py-3 rounded-2xl ${msg.role === 'user' ? 'bg-[#1a237e] text-white rounded-tr-none' : 'bg-gray-100 text-gray-800 rounded-tl-none'}`}>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                </div>

                {/* Dynamic Cluster Cards */}
                {msg.clusters && msg.clusters.length > 0 && (
                  <div className="flex flex-col gap-3 w-full mt-1">
                    {msg.clusters.map((cluster) => (
                      <div 
                        key={cluster.chainId} 
                        className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow"
                      >
                        {/* Cluster Header */}
                        <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-[#e8eaf6] to-[#e0e0ff]">
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-[#1a237e]">{cluster.title}</span>
                            <span className="text-[10px] text-[#4355b9]">
                              {cluster.imageCount} image{cluster.imageCount > 1 ? 's' : ''} · {cluster.intent.replace('_', ' ')}
                              {cluster.deadline && ` · Due: ${new Date(cluster.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                            </span>
                          </div>
                          <button
                            onClick={() => handleSaveCluster(cluster)}
                            title={isClusterSaved(cluster.chainId) ? 'Saved!' : 'Save to Collections'}
                            className={`p-1.5 rounded-lg transition-colors ${isClusterSaved(cluster.chainId) ? 'text-[#1a237e] bg-[#e0e0ff]' : 'text-gray-400 hover:text-[#1a237e] hover:bg-[#e0e0ff]'}`}
                          >
                            {isClusterSaved(cluster.chainId) ? <Bookmark sx={{ fontSize: 18 }} /> : <BookmarkBorder sx={{ fontSize: 18 }} />}
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
                      </div>
                    ))}
                  </div>
                )}

                {/* Standalone images (if any without cluster context) */}
                {msg.images && msg.images.length > 0 && (!msg.clusters || msg.clusters.length === 0) && (
                  <div className="flex flex-wrap gap-2 mt-1">
                    {msg.images.map((imgUrl, i) => (
                      <div 
                        key={i} 
                        onClick={() => openImageViewer(msg.images!, i, 'Search Results')}
                        className="w-20 h-20 rounded-xl overflow-hidden cursor-pointer border-2 border-transparent hover:border-[#1a237e] transition-all shadow-sm"
                      >
                        <img src={imgUrl} alt="Retrieved memory" className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="flex max-w-[85%] gap-2.5 flex-row">
              <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-1 bg-blue-100 text-[#1a237e]">
                <SmartToy sx={{ fontSize: 16 }} />
              </div>
              <div className="px-4 py-3 rounded-2xl bg-gray-100 text-gray-800 rounded-tl-none flex items-center gap-2">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="p-3 sm:p-4 bg-white border-t border-gray-100">
        <div className="flex items-center bg-gray-50 rounded-full px-4 py-2 border border-gray-200">
          <input
            type="text"
            placeholder="Ask anything about your memories..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            className="flex-1 bg-transparent border-none outline-none text-sm text-gray-800"
          />
          <button 
            onClick={handleSend}
            disabled={!inputValue.trim() || isLoading}
            className="w-8 h-8 rounded-full bg-[#1a237e] text-white flex items-center justify-center disabled:opacity-50 ml-2 hover:scale-105 transition-transform"
          >
            <Send sx={{ fontSize: 16 }} className="ml-0.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
