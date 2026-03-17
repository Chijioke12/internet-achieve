/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Search, Info, ArrowLeft, ExternalLink, Loader2 } from 'lucide-react';

// Internet Archive API Endpoints
const SEARCH_API = 'https://archive.org/advancedsearch.php';
const METADATA_API = 'https://archive.org/metadata';

interface ArchiveFile {
  name: string;
  format: string;
  size?: string;
}

interface ArchiveItem {
  identifier: string;
  title: string;
  creator?: string;
  date?: string;
  mediatype?: string;
  description?: string;
  files?: ArchiveFile[];
}

type ViewState = 'search' | 'list' | 'detail' | 'filter' | 'files';

const MEDIA_TYPES = [
  { id: 'all', label: 'All Media' },
  { id: 'texts', label: 'Texts/Books' },
  { id: 'movies', label: 'Movies/Videos' },
  { id: 'audio', label: 'Audio/Music' },
  { id: 'software', label: 'Software' },
  { id: 'image', label: 'Images' },
];

export default function App() {
  const [view, setView] = useState<ViewState>('search');
  const [query, setQuery] = useState('');
  const [mediaType, setMediaType] = useState('all');
  const [results, setResults] = useState<ArchiveItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<ArchiveItem | null>(null);
  const [fileIndex, setFileIndex] = useState(0);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [filterIndex, setFilterIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Handle Search
  const performSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    setError(null);
    try {
      let q = searchQuery;
      if (mediaType !== 'all') {
        q += ` AND mediatype:${mediaType}`;
      }

      const params = new URLSearchParams({
        q: q,
        output: 'json',
        rows: '20',
        fl: 'identifier,title,creator,date,mediatype,description',
      });
      const response = await fetch(`${SEARCH_API}?${params.toString()}`);
      const data = await response.json();
      
      if (data.response && data.response.docs) {
        setResults(data.response.docs);
        setView('list');
        setFocusedIndex(0);
      } else {
        setResults([]);
        setError('No results found.');
      }
    } catch (err) {
      setError('Failed to fetch results. Please check your connection.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Handle Item Selection
  const fetchDetails = async (identifier: string) => {
    setLoading(true);
    try {
      const response = await fetch(`${METADATA_API}/${identifier}`);
      const data = await response.json();
      setSelectedItem({
        ...data.metadata,
        identifier,
        files: data.files || [],
      });
      setView('detail');
      // Reset scroll position to top
      if (listRef.current) {
        listRef.current.scrollTop = 0;
      }
    } catch (err) {
      setError('Failed to fetch details.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Key Listeners for KaiOS D-pad
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key;
      switch (key) {
        case 'ArrowDown':
          if (view === 'list') {
            setFocusedIndex((prev) => Math.min(prev + 1, results.length - 1));
          } else if (view === 'filter') {
            setFilterIndex((prev) => Math.min(prev + 1, MEDIA_TYPES.length - 1));
          } else if (view === 'files' && selectedItem?.files) {
            setFileIndex((prev) => Math.min(prev + 1, selectedItem.files!.length - 1));
          } else if (view === 'detail' && listRef.current) {
            listRef.current.scrollBy({ top: 30, behavior: 'smooth' });
          }
          break;
        case 'ArrowUp':
          if (view === 'list') {
            setFocusedIndex((prev) => Math.max(prev - 1, 0));
          } else if (view === 'filter') {
            setFilterIndex((prev) => Math.max(prev - 1, 0));
          } else if (view === 'files') {
            setFileIndex((prev) => Math.max(prev - 1, 0));
          } else if (view === 'detail' && listRef.current) {
            listRef.current.scrollBy({ top: -30, behavior: 'smooth' });
          }
          break;
        case 'Enter':
          if (view === 'search') {
            performSearch(query);
          } else if (view === 'list' && results[focusedIndex]) {
            fetchDetails(results[focusedIndex].identifier);
          } else if (view === 'filter') {
            setMediaType(MEDIA_TYPES[filterIndex].id);
            setView('search');
          } else if (view === 'files' && selectedItem?.files?.[fileIndex]) {
            const file = selectedItem.files[fileIndex];
            window.open(`https://archive.org/download/${selectedItem.identifier}/${file.name}`, '_blank');
          }
          break;
        case 'SoftLeft':
        case 'F1':
        case 'Backspace':
        case 'Escape':
          if (view === 'detail') {
            setView('list');
            e.preventDefault();
          } else if (view === 'files') {
            setView('detail');
            e.preventDefault();
          } else if (view === 'list') {
            setView('search');
            setTimeout(() => inputRef.current?.focus(), 0);
            e.preventDefault();
          } else if (view === 'filter') {
            setView('search');
            e.preventDefault();
          }
          break;
        case 'SoftRight':
        case 'F2':
          if (view === 'detail' && selectedItem) {
            setView('files');
            setFileIndex(0);
          } else if (view === 'search') {
            setView('filter');
            setFilterIndex(MEDIA_TYPES.findIndex(m => m.id === mediaType));
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [view, query, results, focusedIndex, selectedItem, filterIndex, mediaType]);

  // Scroll focused item into view
  useEffect(() => {
    if ((view === 'list' || view === 'filter' || view === 'files') && listRef.current) {
      let index = 0;
      if (view === 'list') index = focusedIndex;
      else if (view === 'filter') index = filterIndex;
      else if (view === 'files') index = fileIndex;
      
      const container = listRef.current;
      // In list view, items are direct children. In filter/files, they are inside .filter-list
      const itemsContainer = (view === 'filter' || view === 'files') 
        ? container.querySelector('.filter-list') 
        : container;
      
      const element = itemsContainer?.children[index] as HTMLElement;
      
      if (element && container) {
        const elementTop = element.offsetTop;
        const elementHeight = element.offsetHeight;
        const containerHeight = container.clientHeight;
        const targetScrollPos = elementTop - (containerHeight / 2) + (elementHeight / 2);
        
        container.scrollTo({
          top: targetScrollPos,
          behavior: 'smooth'
        });
      }
    }
  }, [focusedIndex, filterIndex, fileIndex, view]);

  // Focus input on search view
  useEffect(() => {
    if (view === 'search') {
      inputRef.current?.focus();
    }
  }, [view]);

  const simulateKey = (key: string) => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key }));
  };

  const renderApp = () => (
    <div className="app-container">
      <header className="header">
        {view === 'search' && 'Archive Search'}
        {view === 'list' && 'Search Results'}
        {view === 'detail' && 'Item Details'}
        {view === 'filter' && 'Select Filter'}
        {view === 'files' && 'Download Files'}
      </header>

      <main className="content" ref={listRef}>
        {loading && (
          <div className="loading">
            <Loader2 className="animate-spin" size={24} style={{ margin: '0 auto 8px' }} />
            <p>Loading...</p>
          </div>
        )}

        {error && <div className="error">{error}</div>}

        {!loading && !error && view === 'search' && (
          <div className="search-box">
            <p style={{ fontSize: '12px', marginBottom: '8px', color: '#666' }}>
              Search the Internet Archive for books, movies, music, and more.
            </p>
            <div style={{ marginBottom: '12px' }}>
              <span style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase' }}>Current Filter:</span>
              <div style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--kai-primary)' }}>
                {MEDIA_TYPES.find(m => m.id === mediaType)?.label}
              </div>
            </div>
            <input
              ref={inputRef}
              type="text"
              className="search-input"
              placeholder="Enter keywords..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        )}

        {!loading && !error && view === 'filter' && (
          <div className="filter-list">
            {MEDIA_TYPES.map((type, index) => (
              <div
                key={type.id}
                className={`list-item ${filterIndex === index ? 'focused' : ''}`}
                onClick={() => {
                  setMediaType(type.id);
                  setView('search');
                }}
              >
                {type.label}
                {mediaType === type.id && <span style={{ float: 'right', fontSize: '10px' }}>✓</span>}
              </div>
            ))}
          </div>
        )}

        {!loading && !error && view === 'list' && results.length > 0 && (
          results.map((item, index) => (
            <div
              key={item.identifier}
              className={`list-item ${focusedIndex === index ? 'focused' : ''}`}
              onClick={() => fetchDetails(item.identifier)}
            >
              <div className="item-content">
                <img 
                  src={`https://archive.org/services/img/${item.identifier}`} 
                  alt="" 
                  className="item-thumbnail"
                  referrerPolicy="no-referrer"
                  onError={(e) => (e.currentTarget.style.display = 'none')}
                />
                <div className="item-info">
                  <span className="item-title">{item.title || 'Untitled'}</span>
                  <span className="item-meta">
                    {item.mediatype} • {item.date?.substring(0, 4) || 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}

        {!loading && !error && view === 'list' && results.length === 0 && (
          <div className="empty">No results found.</div>
        )}

        {!loading && !error && view === 'files' && selectedItem && (
          <div className="filter-list">
            {selectedItem.files?.filter(f => !f.name.startsWith('__')).map((file, index) => (
              <div
                key={file.name}
                className={`list-item ${fileIndex === index ? 'focused' : ''}`}
                onClick={() => {
                  window.open(`https://archive.org/download/${selectedItem.identifier}/${file.name}`, '_blank');
                }}
              >
                <div className="truncate" style={{ fontSize: '12px', fontWeight: 'bold' }}>{file.name}</div>
                <div className="truncate" style={{ fontSize: '10px', color: '#888' }}>{file.format} {file.size ? `• ${Math.round(parseInt(file.size) / 1024 / 1024 * 10) / 10} MB` : ''}</div>
              </div>
            ))}
          </div>
        )}

        {!loading && !error && view === 'detail' && selectedItem && (
          <div className="detail-view">
            <div className="detail-image-container">
              <img 
                src={`https://archive.org/services/img/${selectedItem.identifier}`} 
                alt={selectedItem.title} 
                className="detail-image"
                referrerPolicy="no-referrer"
              />
            </div>
            <h2 className="detail-title">{selectedItem.title}</h2>
            <p className="detail-meta"><strong>Identifier:</strong> {selectedItem.identifier}</p>
            <p className="detail-meta"><strong>Creator:</strong> {selectedItem.creator || 'Unknown'}</p>
            <p className="detail-meta"><strong>Date:</strong> {selectedItem.date || 'Unknown'}</p>
            <p className="detail-meta"><strong>Type:</strong> {selectedItem.mediatype}</p>
            <div className="detail-desc">
              {selectedItem.description ? (() => {
                const desc = Array.isArray(selectedItem.description) 
                  ? selectedItem.description.join(' ') 
                  : String(selectedItem.description);
                return (
                  <div dangerouslySetInnerHTML={{ 
                    __html: desc.substring(0, 500) + (desc.length > 500 ? '...' : '') 
                  }} />
                );
              })() : (
                'No description available.'
              )}
            </div>
          </div>
        )}
      </main>

      <footer className="softkey-bar">
        <div className="softkey-left">
          {view === 'detail' || view === 'list' || view === 'filter' || view === 'files' ? 'Back' : ''}
        </div>
        <div className="softkey-center">
          {view === 'search' ? 'SEARCH' : view === 'files' ? 'DOWNLOAD' : 'SELECT'}
        </div>
        <div className="softkey-right">
          {view === 'detail' ? 'Files' : view === 'search' ? 'Filter' : ''}
        </div>
      </footer>
    </div>
  );

  if (import.meta.env.PROD) {
    return renderApp();
  }

  return (
    <div className="simulator-wrapper">
      <svg className="kaios-simulator" viewBox="0 0 320 640" xmlns="http://www.w3.org/2000/svg">
        {/* Phone Body */}
        <rect x="10" y="10" width="300" height="620" rx="40" fill="#1a1a1a" />
        <rect x="15" y="15" width="290" height="610" rx="35" fill="#2a2a2a" />
        
        {/* Screen Area */}
        <rect x="40" y="60" width="240" height="320" fill="#000" />
        <foreignObject x="40" y="60" width="240" height="320">
          <div className="simulator-screen">
            {renderApp()}
          </div>
        </foreignObject>

        {/* Softkeys */}
        <rect className="simulator-button" x="40" y="400" width="70" height="30" rx="5" fill="#444" onClick={() => simulateKey('SoftLeft')} />
        <rect className="simulator-button" x="210" y="400" width="70" height="30" rx="5" fill="#444" onClick={() => simulateKey('SoftRight')} />
        
        {/* D-Pad */}
        <circle cx="160" cy="450" r="50" fill="#333" />
        <path className="simulator-button" d="M160 410 L180 430 L140 430 Z" fill="#555" onClick={() => simulateKey('ArrowUp')} />
        <path className="simulator-button" d="M160 490 L180 470 L140 470 Z" fill="#555" onClick={() => simulateKey('ArrowDown')} />
        <path className="simulator-button" d="M120 450 L140 430 L140 470 Z" fill="#555" onClick={() => simulateKey('ArrowLeft')} />
        <path className="simulator-button" d="M200 450 L180 430 L180 470 Z" fill="#555" onClick={() => simulateKey('ArrowRight')} />
        <circle className="simulator-button" cx="160" cy="450" r="20" fill="#ff4e00" onClick={() => simulateKey('Enter')} />

        {/* Call / End Buttons */}
        <rect className="simulator-button" x="40" y="440" width="60" height="30" rx="15" fill="#2e7d32" onClick={() => simulateKey('Enter')} />
        <rect className="simulator-button" x="220" y="440" width="60" height="30" rx="15" fill="#c62828" onClick={() => simulateKey('Backspace')} />

        {/* Number Pad (Visual only for now) */}
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, '*', 0, '#'].map((num, i) => {
          const row = Math.floor(i / 3);
          const col = i % 3;
          return (
            <g key={num} className="simulator-button" onClick={() => simulateKey(num.toString())}>
              <rect x={60 + col * 70} y={510 + row * 35} width="60" height="25" rx="5" fill="#333" />
              <text x={90 + col * 70} y={528 + row * 35} fill="#fff" fontSize="12" textAnchor="middle">{num}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
