import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface FeedItem {
  id: string;
  title: string;
  description: string;
  deadline: string | null;
  importance: number;
  imageUrl: string;
  intentType: string;
  chainId: string;
  category: 'whats_next' | 'working_on' | 'other';
  createdAt: string;
}

export interface SavedCluster {
  id: string;
  title: string;
  images: string[];
  chainId: string;
  createdAt: string;
}

interface AppState {
  currentView: 'home' | 'other' | 'chat' | 'collections';
  setCurrentView: (view: 'home' | 'other' | 'chat' | 'collections') => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  feedItems: FeedItem[];
  addFeedItem: (item: FeedItem) => void;
  // Saved clusters from chatbot
  savedClusters: SavedCluster[];
  addSavedCluster: (cluster: SavedCluster) => void;
  deleteSavedCluster: (id: string) => void;
  // Image viewer state — supports single image OR cluster browsing
  viewingImages: string[];
  viewingImageIndex: number;
  viewingClusterTitle: string;
  openImageViewer: (images: string[], startIndex?: number, title?: string) => void;
  closeImageViewer: () => void;
  nextImage: () => void;
  prevImage: () => void;
}

const SUPABASE_BASE = 'https://gfasqzpxsxxvzhrgtjtq.supabase.co/storage/v1/object/public/grasp-moments/uploads';

// All 7 Supabase images seeded with categories dynamically assigned
const initialSeed: FeedItem[] = [
  {
    id: "seed-1",
    title: "Google Frontend Developer Internship Application",
    description: "Review internship requirements and prepare application materials.",
    deadline: null,
    importance: 9,
    imageUrl: `${SUPABASE_BASE}/1778837035358_eval-job-hunt.jpg`,
    intentType: "job_application",
    chainId: "google_frontend_internship",
    category: "whats_next",
    createdAt: "2026-05-15T09:24:03.000Z",
  },
  {
    id: "seed-2",
    title: "Thermodynamics & Carnot Cycle Lecture Notes",
    description: "Review Carnot Cycle concepts, entropy, and heat engine formulas.",
    deadline: null,
    importance: 5,
    imageUrl: `${SUPABASE_BASE}/1778837045491_eval-thermo.jpg`,
    intentType: "study_material",
    chainId: "thermodynamics_notes",
    category: "working_on",
    createdAt: "2026-05-15T09:24:11.000Z",
  },
  {
    id: "seed-3",
    title: "Berghotel Grosse Scheidegg Meal Receipt",
    description: "Archive receipt for expense tracking — July 30, 2007",
    deadline: null,
    importance: 3,
    imageUrl: `${SUPABASE_BASE}/1778837053197_complex-receipt.jpg`,
    intentType: "receipt",
    chainId: "berghotel_receipt_2007",
    category: "other",
    createdAt: "2026-05-15T09:24:20.000Z",
  },
  {
    id: "seed-4",
    title: "Federated Knowledge Graph AI Platform Architecture",
    description: "Review agentic AI platform architecture diagram and design patterns.",
    deadline: null,
    importance: 6,
    imageUrl: `${SUPABASE_BASE}/1778837164122_e5d5c755-dc7d-4607-994b-0bec0f32fda6.png`,
    intentType: "study_material",
    chainId: "federated_ai_architecture",
    category: "working_on",
    createdAt: "2026-05-15T09:26:19.000Z",
  },
  {
    id: "seed-5",
    title: "Database Concurrency: Lost Update Anomaly",
    description: "Study concurrency control concepts and the lost update problem.",
    deadline: null,
    importance: 5,
    imageUrl: `${SUPABASE_BASE}/1778837355272_c9dfdd2f-70e4-4aed-a1e4-022b1837b4a3.png`,
    intentType: "study_material",
    chainId: "database_notes",
    category: "working_on",
    createdAt: "2026-05-15T09:29:22.000Z",
  },
  {
    id: "seed-6",
    title: "Geospatial Web App Development Notes",
    description: "Building map-based web applications with modern frameworks.",
    deadline: null,
    importance: 4,
    imageUrl: `${SUPABASE_BASE}/1778826178168_847ba418-84c9-4db9-a744-bb079fafc8e1.png`,
    intentType: "study_material",
    chainId: "geospatial_webapp",
    category: "working_on",
    createdAt: "2026-05-15T08:02:58.000Z",
  },
  {
    id: "seed-7",
    title: "Project Architecture Diagram",
    description: "System design and component architecture reference.",
    deadline: null,
    importance: 4,
    imageUrl: `${SUPABASE_BASE}/1778843046969_e06d5b05-6eb1-4775-8552-ae6770841f26.png`,
    intentType: "general_note",
    chainId: "project_architecture",
    category: "working_on",
    createdAt: "2026-05-15T10:44:06.000Z",
  },
];

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      currentView: 'home' as const,
      setCurrentView: (view) => set({ currentView: view }),
      searchQuery: "",
      setSearchQuery: (query) => set({ searchQuery: query }),
      feedItems: initialSeed,
      addFeedItem: (item) => set((state) => ({ 
        feedItems: [item, ...state.feedItems] 
      })),
      // Saved clusters
      savedClusters: [],
      addSavedCluster: (cluster) => set((state) => ({
        savedClusters: [cluster, ...state.savedClusters]
      })),
      deleteSavedCluster: (id) => set((state) => ({
        savedClusters: state.savedClusters.filter(c => c.id !== id)
      })),
      // Image viewer — supports cluster browsing with prev/next
      viewingImages: [],
      viewingImageIndex: 0,
      viewingClusterTitle: '',
      openImageViewer: (images, startIndex = 0, title = '') => set({
        viewingImages: images,
        viewingImageIndex: startIndex,
        viewingClusterTitle: title
      }),
      closeImageViewer: () => set({ viewingImages: [], viewingImageIndex: 0, viewingClusterTitle: '' }),
      nextImage: () => {
        const { viewingImages, viewingImageIndex } = get();
        if (viewingImageIndex < viewingImages.length - 1) {
          set({ viewingImageIndex: viewingImageIndex + 1 });
        }
      },
      prevImage: () => {
        const { viewingImageIndex } = get();
        if (viewingImageIndex > 0) {
          set({ viewingImageIndex: viewingImageIndex - 1 });
        }
      },
    }),
    {
      name: 'grasp-storage-v5', // v5: added category field + savedClusters + collections view
    }
  )
);
