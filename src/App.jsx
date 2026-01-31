import React, { useEffect } from 'react';
import useChatStore from './store';
import Sidebar from './components/Sidebar';
import ChatInterface from './components/ChatInterface';
import Gallery from './components/Gallery';

// Simplified Particle Background - fewer particles for performance
function ParticleBackground() {
  return (
    <div className="particle-container">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="particle" />
      ))}
    </div>
  );
}

function App() {
  const { settings, galleryOpen, setGalleryOpen } = useChatStore();

  // Apply dark mode - always dark for AMOLED
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  return (
    <div className="h-screen w-screen flex items-center justify-center overflow-hidden bg-black text-white p-3 sm:p-4 md:p-5">
      {/* Particle Background */}
      <ParticleBackground />

      {/* Floating Island Container - Use almost full width */}
      <div className="floating-island w-full h-full max-w-[calc(100vw-24px)] sm:max-w-[calc(100vw-32px)] md:max-w-[calc(100vw-40px)] max-h-[calc(100vh-24px)] sm:max-h-[calc(100vh-32px)] md:max-h-[calc(100vh-40px)] flex relative z-10">
        {/* Sidebar */}
        <Sidebar />

        {/* Main Content */}
        <main className="flex-1 flex flex-col min-w-0">
          <ChatInterface />
        </main>
      </div>

      {/* Gallery Modal */}
      <Gallery isOpen={galleryOpen} onClose={() => setGalleryOpen(false)} />
    </div>
  );
}

export default App;
