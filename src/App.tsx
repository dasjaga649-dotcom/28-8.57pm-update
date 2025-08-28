import React, { useState, useEffect, useRef } from 'react';
import { marked } from 'marked';
import './App.css';
import Navigation from './components/Navigation';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { Document as DocxDocument, Packer, Paragraph, HeadingLevel, TextRun, ExternalHyperlink, Table as DocxTable, TableRow, TableCell, WidthType } from 'docx';
import { User, Building, Settings, Briefcase, BarChart, Trophy, Laptop, Phone } from "lucide-react";

// Configure marked for better rendering and security
marked.setOptions({
  async: false,
  breaks: true, // Convert line breaks to <br>
  gfm: true // GitHub Flavored Markdown
});

interface Message {
  id: number;
  text: string;
  isUser: boolean;
  timestamp: Date;
  response?: BotResponse;
  query?: string; // Store the original user question for bot messages
}

interface BotResponse {
  answer: string;
  related_content?: RelatedContent[];
  recommendations?: string[];
  file_links?: FileLink[];
  tables?: Table[];
}

interface RelatedContent {
  image?: string;
  title: string;
  url: string;
}

interface FileLink {
  title: string;
  url: string;
}

interface Table {
  title: string;
  headers: string[];
  rows: string[][];
}

interface QuestionCard {
  icon: React.ReactNode;
  title: string;
  description: string;
  category: string;
}

function App() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      text: "Hello! I am your AI assistant. How can I help you today?",
      isUser: false,
      timestamp: new Date()
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState<'client' | 'chat'>('client');
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    if (currentPage === 'chat') {
      const scrollToBottom = () => {
        window.scrollTo({
          top: document.body.scrollHeight,
          behavior: 'smooth'
        });
      };
      // Small delay to ensure DOM is updated
      setTimeout(scrollToBottom, 100);
    }
  }, [messages, currentPage]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMenu]);

  const questionCards: QuestionCard[] = [
    {
      icon: <User size={20} />,
      title: 'CEO',
      description: 'who is the CEO?',
      category: 'About'
    },
    {
      icon: <Building size={20} />,
      title: 'Offices',
      description: 'Where are our offices?',
      category: 'Location'
    },
    {
      icon: <Settings size={20} />,
      title: 'Services',
      description: 'What services do we provide?',
      category: 'Services'
    },
    {
      icon: <Briefcase size={20} />,
      title: 'Industries',
      description: 'What industries do we serve?',
      category: 'Industries'
    },
    {
      icon: <BarChart size={20} />,
      title: 'Stats',
      description: 'What are some impressive stats about Hutech?',
      category: 'Statistics'
    },
    {
      icon: <Trophy size={20} />,
      title: 'Certifications',
      description: 'What certifications do we have?',
      category: 'Qualifications'
    },
    {
      icon: <Laptop size={20} />,
      title: 'Tech Stack',
      description: 'What is our tech stack?',
      category: 'Technology'
    },
    {
      icon: <Phone size={20} />,
      title: 'Contact',
      description: 'Give me your contact details.',
      category: 'Contact'
    }
  ];
  // Helper function to validate and sanitize BotResponse data
  const validateBotResponse = (response: Partial<BotResponse>): BotResponse => {
    return {
      answer: typeof response.answer === 'string' ? response.answer : '',
      related_content: Array.isArray(response.related_content)
        ? response.related_content.filter(item =>
          item && typeof item.title === 'string' && typeof item.url === 'string'
        )
        : undefined,
      recommendations: Array.isArray(response.recommendations)
        ? response.recommendations.filter(item => typeof item === 'string')
        : undefined,
      file_links: Array.isArray(response.file_links)
        ? response.file_links.filter(item =>
          item && typeof item.title === 'string' && typeof item.url === 'string'
        )
        : undefined,
      tables: Array.isArray(response.tables)
        ? response.tables.filter(table =>
          table &&
          typeof table.title === 'string' &&
          Array.isArray(table.headers) &&
          Array.isArray(table.rows)
        )
        : undefined
    };
  };

  // Helper function to parse JSON responses with multiple format support
  const parseJsonResponse = (jsonData: any): BotResponse => {
    // Handle different JSON response formats

    // Format 1: { response: { answer: "...", ... } }
    if (jsonData.response && typeof jsonData.response === 'object') {
      const rawResponse = {
        answer: jsonData.response.answer || jsonData.response.text || '',
        related_content: jsonData.response.related_content || jsonData.response.relatedContent,
        recommendations: jsonData.response.recommendations || jsonData.response.suggestions,
        file_links: jsonData.response.file_links || jsonData.response.fileLinks || jsonData.response.files,
        tables: jsonData.response.tables
      };
      return validateBotResponse(rawResponse);
    }

    // Format 2: { answer: "...", ... } (direct format)
    if (jsonData.answer || jsonData.text || jsonData.message) {
      const rawResponse = {
        answer: jsonData.answer || jsonData.text || jsonData.message,
        related_content: jsonData.related_content || jsonData.relatedContent,
        recommendations: jsonData.recommendations || jsonData.suggestions,
        file_links: jsonData.file_links || jsonData.fileLinks || jsonData.files,
        tables: jsonData.tables
      };
      return validateBotResponse(rawResponse);
    }

    // Format 3: { data: { ... } }
    if (jsonData.data && typeof jsonData.data === 'object') {
      return parseJsonResponse(jsonData.data);
    }

    // Format 4: Array format [{ answer: "..." }]
    if (Array.isArray(jsonData) && jsonData.length > 0) {
      return parseJsonResponse(jsonData[0]);
    }

    // Format 5: String response wrapped in object
    if (typeof jsonData === 'string') {
      return validateBotResponse({ answer: jsonData });
    }

    // Fallback: stringify the entire object
    return validateBotResponse({
      answer: JSON.stringify(jsonData, null, 2)
    });
  };

  // Helper function to parse text responses and detect if they contain JSON
  const parseTextResponse = (textData: string): BotResponse => {
    const trimmedText = textData.trim();

    // Check if the text might be JSON
    if ((trimmedText.startsWith('{') && trimmedText.endsWith('}')) ||
      (trimmedText.startsWith('[') && trimmedText.endsWith(']'))) {
      try {
        const parsed = JSON.parse(trimmedText);
        return parseJsonResponse(parsed);
      } catch (e) {
        // If JSON parsing fails, treat as markdown/text
        console.warn('Text looks like JSON but failed to parse:', e);
      }
    }

    // Check for common structured text patterns and convert to proper format
    const processedText = preprocessTextResponse(trimmedText);

    return validateBotResponse({
      answer: processedText
    });
  };

  // Helper function to preprocess text responses for better rendering
  const preprocessTextResponse = (text: string): string => {

    // Handle common formatting patterns
    let processed = text;

    // Convert **bold** to proper markdown
    processed = processed.replace(/\*\*(.*?)\*\*/g, '**$1**');

    // Convert __bold__ to proper markdown
    processed = processed.replace(/__(.*?)__/g, '**$1**');

    // Convert *italic* to proper markdown
    processed = processed.replace(/\*(.*?)\*/g, '*$1*');

    // Fix line breaks and spacing
    processed = processed.replace(/\\n/g, '\n');
    processed = processed.replace(/\n\s*\n\s*\n/g, '\n\n');
    // Convert common bullet symbols to '-' at line start
    processed = processed.replace(/^\s*[•–]\s+/gm, '- ');
    // Ensure a blank line before any list (handles indented bullets and numbers)
    processed = processed.replace(/([^\n])\n(\s*[-*+]\s)/g, '$1\n\n$2');
    processed = processed.replace(/([^\n])\n(\s*\d+\.\s)/g, '$1\n\n$2');

    // Line-wise normalization to preserve horizontal rules (---) while fixing bullets
    const lines = processed.split(/\n/);
    const normalized = lines.map((line) => {
      const trimmed = line.trim();
      // Detect HR: three or more -, _, or * with only spaces between
      if (/^[-_*](\s*[-_*]){2,}$/.test(trimmed)) {
        return '---';
      }
      // Bullet like '-' or '*' or '+' with missing/extra spaces (but not HR)
      const bulletMatch = line.match(/^(\s*)[-*+]\s*(.+)$/);
      if (bulletMatch) {
        const indent = bulletMatch[1];
        const content = bulletMatch[2];
        return `${indent}- ${content}`;
      }
      // Numbered list normalization
      const numMatch = line.match(/^(\s*)(\d+)\.\s*(.+)$/);
      if (numMatch) {
        const indent = numMatch[1];
        const num = numMatch[2];
        const content = numMatch[3];
        return `${indent}${num}. ${content}`;
      }
      return line;
    }).join('\n');

    processed = normalized;

    // Handle headers that might not have proper spacing
    processed = processed.replace(/^(#+)(\S)/gm, '$1 $2');

    // De-duplicate consecutive identical headings (e.g., repeated H1/H2 lines)
    const lines2 = processed.split('\n');
    const out: string[] = [];
    let lastHeadingText = '';
    for (const ln of lines2) {
      const m = ln.match(/^(#+)\s+(.*)$/);
      if (m) {
        const current = m[2].trim();
        if (current.toLowerCase() === lastHeadingText.toLowerCase()) {
          continue;
        }
        lastHeadingText = current;
        out.push(ln);
      } else {
        lastHeadingText = '';
        out.push(ln);
      }
    }
    processed = out.join('\n');

    return processed.trim();
  };

  const sendMessage = async (query?: string) => {
    const messageText = query || inputValue.trim();
    if (!messageText) return;

    // Switch to chat page immediately
    setCurrentPage('chat');

    const userMessage: Message = {
      id: Date.now(),
      text: messageText,
      isUser: true,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      // Use environment variable for API endpoint, fallback to localhost
      const apiEndpoint = process.env.REACT_APP_API_ENDPOINT || 'http://localhost:3001/query';

      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: messageText }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}. Response: ${errorText}`);
      }

      // Try to parse as JSON first, fallback to text
      let botResponse: BotResponse;
      const contentType = response.headers.get('content-type');

      try {
        if (contentType && contentType.includes('application/json')) {
          const jsonData = await response.json();
          botResponse = parseJsonResponse(jsonData);
        } else {
          const textData = await response.text();
          botResponse = parseTextResponse(textData);
        }
      } catch (parseError) {
        console.warn('Failed to parse response, using fallback:', parseError);
        const fallbackText = await response.text().catch(() => 'Failed to get response');
        botResponse = { answer: fallbackText };
      }

      const botMessage: Message = {
        id: Date.now() + 1,
        text: botResponse.answer || "Sorry, I couldn't process your request.",
        isUser: false,
        timestamp: new Date(),
        response: botResponse,
        query: messageText // Store the user's question
      };

      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      console.error('Error sending message:', error);

      // Provide helpful error message based on error type
      let errorText = "Sorry, I encountered an error while processing your request.";
      let debugInfo = '';

      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        errorText = "Unable to connect to the backend server. Please check if the API server is running and accessible.";
        debugInfo = 'Network connection failed';
      } else if (error instanceof SyntaxError) {
        errorText = "Received an invalid response format from the server.";
        debugInfo = 'JSON parsing error';
      } else if (error instanceof Error) {
        errorText = `Server error: ${error.message}`;
        debugInfo = error.message;
      }

      // Log detailed error information for debugging
      console.warn('Chat error details:', {
        error: error,
        message: messageText,
        timestamp: new Date().toISOString(),
        debugInfo: debugInfo
      });

      const errorMessage: Message = {
        id: Date.now() + 1,
        text: errorText,
        isUser: false,
        timestamp: new Date(),
        query: messageText
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInputValue(suggestion);
    setTimeout(() => {
      sendMessage(suggestion);
    }, 100);
  };

  const handleCardClick = (card: QuestionCard) => {
    sendMessage(card.description);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage();
  };

  const clearChat = () => {
    setMessages([
      {
        id: 1,
        text: "Hello! I am your AI assistant. How can I help you today?",
        isUser: false,
        timestamp: new Date()
      }
    ]);
    setInputValue('');
    setCurrentPage('client');
    setShowMenu(false);
  };

  const newChat = () => {
    setCurrentPage('client');
    setInputValue('');
    setShowMenu(false);
  };

  const handleNavigation = (page: 'client' | 'chat') => {
    setCurrentPage(page);
    setShowMenu(false);
  };

  if (currentPage === 'client') {
    return (
      <div className="client-page">
        <Navigation currentPage={currentPage} onNavigate={handleNavigation} />

        {/* Main Content */}
        <main className="client-main">
          <div className="welcome-section">
            <h1 className="welcome-title">
              Your AI Partner, <span className="husqy-text">Husqy</span>
            </h1>
            <p className="welcome-subtitle">
              I'm here to help you explore Hutech Solutions' cutting-edge technology and IT services. Whether you're curious about our cutting-edge technology or need details on our IT services, feel free to ask.
            </p>
          </div>

          {/* Search Bar */}
          <div className="client-search-container">
            <form onSubmit={handleFormSubmit} className="client-search-form">
              <div className="search-input-wrapper">
                <input
                  type="text"
                  placeholder=" Ask me anything..."
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  disabled={isLoading}
                  className={`client-search-input${isLoading ? ' searching' : ''}`}
                />
                <button
                  type={inputValue.trim() ? 'submit' : 'button'}
                  onClick={!inputValue.trim() && !isLoading ? () => console.log('Voice input placeholder clicked') : undefined}
                  className={`search-send-button${isLoading ? ' searching' : ''}`}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <div className="searching-animation" aria-label="Loading">
                      <span className="dot"></span>
                      <span className="dot"></span>
                      <span className="dot"></span>
                    </div>
                  ) : inputValue.trim() ? (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                      <path d="M12 14a3 3 0 003-3V7a3 3 0 10-6 0v4a3 3 0 003 3z" />
                      <path d="M19 11a1 1 0 10-2 0 5 5 0 11-10 0 1 1 0 10-2 0 7 7 0 006 6.92V21a1 1 0 102 0v-3.08A7 7 0 0019 11z" />
                    </svg>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Question Cards - Horizontal Scroll */}
          <div className="question-cards-container">
            <div className="question-cards-scroll">
              {questionCards.map((card, index) => (
                <div
                  key={index}
                  className="question-card-horizontal"
                  onClick={() => handleCardClick(card)}
                >
                  <div className="card-icon">{card.icon}</div>
                  <div className="card-content">
                    <h3 className="card-title">{card.title}</h3>
                    <p className="card-description">{card.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Chat Page
  return (
    <div className="bg-white body" id='body'>
      <Navigation currentPage={currentPage} onNavigate={handleNavigation} />
      {/* Chat History Panel */}
      <div id="chat-history" className="chat-history-container">
        {messages.map((message) => (
          <div key={message.id}>
            {message.isUser ? (
              <UserMessage text={message.text} />
            ) : (
              <BotMessage message={message} onSuggestionClick={handleSuggestionClick} />
            )}
          </div>
        ))}

        {isLoading && <LoadingMessage />}
      </div>

      {/* Chat Input Form with Menu */}
      <div className="sticky bottom-0 bg-white py-4 chat-input-sticky">
        <div className="chat-search-container">
          <form id="chat-form" className="chat-search-form" onSubmit={handleFormSubmit}>
            <div className="chat-input-wrapper" ref={menuRef}>
              <input
                id="user-input"
                type="text"
                placeholder=" Ask me anything..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                disabled={isLoading}
                className={`chat-search-input${isLoading ? ' searching' : ''}`}
              />

              {/* Three Dots Menu Inside Input */}
              {/* <button
                type="button"
                className="chat-menu-button-inside"
                onClick={clearChat} // directly clears chat on click
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="red"   // make stroke red
                  width="20"
                  height="20"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button> */}

              <button
                type={inputValue.trim() ? 'submit' : 'button'}
                onClick={!inputValue.trim() && !isLoading ? () => console.log('Voice input placeholder clicked') : undefined}
                className={`chat-send-button${isLoading ? ' searching' : ''}`}
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="searching-animation" aria-label="Loading">
                    <span className="dot"></span>
                    <span className="dot"></span>
                    <span className="dot"></span>
                  </div>
                ) : inputValue.trim() ? (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                    <path d="M12 14a3 3 0 003-3V7a3 3 0 10-6 0v4a3 3 0 003 3z" />
                    <path d="M19 11a1 1 0 10-2 0 5 5 0 11-10 0 1 1 0 10-2 0 7 7 0 006 6.92V21a1 1 0 102 0v-3.08A7 7 0 0019 11z" />
                  </svg>
                )}
              </button>

              {showMenu && (
                <div className="chat-menu-dropdown">
                  <button
                    onClick={clearChat}
                    className="menu-item"
                  >
                    <div className="menu-icon">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    </div>
                    <span>Clear Chat</span>
                  </button>
                </div>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

const UserMessage: React.FC<{ text: string }> = ({ text }) => {
  return (
    <div className="flex justify-end">
      <div className="rounded-xl rounded-br-none p-4 shadow-md chat-bubble-user prose text-sm max-w-lg">
        <div dangerouslySetInnerHTML={{ __html: marked(text) as string }} />
      </div>
    </div>
  );
};

const MessageActions: React.FC<{
  message: Message;
}> = ({ message }) => {
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [isDisliked, setIsDisliked] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close export dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowExportDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);


  const copyToClipboard = (text: string) => {
    return new Promise<void>((resolve, reject) => {
      // Try modern clipboard API first, but with proper error handling
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text)
          .then(() => resolve())
          .catch(() => {
            // If clipboard API fails, fall back to textarea method
            fallbackCopyTextToClipboard(text, resolve, reject);
          });
      } else {
        // Use fallback method directly
        fallbackCopyTextToClipboard(text, resolve, reject);
      }
    });
  };

  const fallbackCopyTextToClipboard = (text: string, resolve: () => void, reject: (err: any) => void) => {
    const textArea = document.createElement('textarea');
    textArea.value = text;

    // Make the textarea out of viewport but still accessible
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    textArea.style.width = '2em';
    textArea.style.height = '2em';
    textArea.style.padding = '0';
    textArea.style.border = 'none';
    textArea.style.outline = 'none';
    textArea.style.boxShadow = 'none';
    textArea.style.background = 'transparent';
    textArea.setAttribute('readonly', '');
    textArea.style.userSelect = 'text';

    document.body.appendChild(textArea);

    // Focus and select with better browser compatibility
    if (textArea.select) {
      textArea.focus();
      textArea.select();
    } else if (textArea.setSelectionRange) {
      textArea.focus();
      textArea.setSelectionRange(0, textArea.value.length);
    }

    try {
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);

      if (successful) {
        resolve();
      } else {
        // Final fallback: try selection API
        try {
          const selection = window.getSelection();
          const range = document.createRange();
          range.selectNodeContents(textArea);
          selection?.removeAllRanges();
          selection?.addRange(range);
          const copySuccess = document.execCommand('copy');
          selection?.removeAllRanges();

          if (copySuccess) {
            resolve();
          } else {
            reject(new Error('All copy methods failed'));
          }
        } catch (selectionError) {
          reject(new Error('Copy command and selection both failed'));
        }
      }
    } catch (err) {
      document.body.removeChild(textArea);
      reject(err);
    }
  };

  const handleCopy = () => {
    let textToCopy = '';

    // Add question (if available from message context)
    if (message.query) {
      textToCopy += `Question: ${message.query}\n\n`;
    }

    // Add answer in plain text
    const answerText = message.text?.replace(/<[^>]*>/g, '') || '';
    textToCopy += `Answer:\n${answerText}\n\n`;

    // Add related content images if available
    if (message.response?.related_content && message.response.related_content.length > 0) {
      const itemsWithImages = message.response.related_content.filter(item => item.image);
      if (itemsWithImages.length > 0) {
        textToCopy += 'Related Images:\n';
        itemsWithImages.forEach(item => {
          textToCopy += `${item.title}: ${item.image}\n`;
        });
        textToCopy += '\n';
      }
    }

    // Add file links if available
    if (message.response?.file_links && message.response.file_links.length > 0) {
      textToCopy += 'File Links:\n';
      message.response.file_links.forEach(link => {
        textToCopy += `${link.title}: ${link.url}\n`;
      });
      textToCopy += '\n';
    }

    // Add related content page URLs
    if (message.response?.related_content && message.response.related_content.length > 0) {
      textToCopy += 'Related Pages:\n';
      message.response.related_content.forEach(item => {
        textToCopy += `${item.title}: ${item.url}\n`;
      });
    }

    copyToClipboard(textToCopy)
      .then(() => {
        alert('Content copied to clipboard!');
      })
      .catch((err) => {
        console.error('Copy failed:', err);
        // Show the content in a modal or alert for manual copying
        const copyText = `Copy failed due to browser restrictions. Please manually copy this content:\n\n${textToCopy}`;
        alert(copyText);
      });
  };

  const buildShareText = () => {
    const answerText = message.text?.replace(/<[^>]*>/g, '') || '';
    let text = '';
    if (message.query) text += `Question: ${message.query}\n\n`;
    text += `Answer:\n${answerText}`;
    return text;
  };

  const openShareModal = () => setShowShareModal(true);
  const closeShareModal = () => setShowShareModal(false);

  const handleShareWhatsApp = () => {
    try {
      const shareText = buildShareText();
      const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;
      window.open(url, '_blank');
      closeShareModal();
    } catch (error) {
      console.error('WhatsApp share failed:', error);
      alert('Unable to open WhatsApp.');
    }
  };

  const handleShareFacebook = () => {
    try {
      const shareUrl = encodeURIComponent(window.location.href);
      const quote = encodeURIComponent(message.query || '');
      const url = `https://www.facebook.com/sharer/sharer.php?u=${shareUrl}&quote=${quote}`;
      window.open(url, '_blank');
      closeShareModal();
    } catch (error) {
      console.error('Facebook share failed:', error);
      alert('Unable to open Facebook.');
    }
  };

  const handleShareX = () => {
    try {
      const url = encodeURIComponent(window.location.href);
      const text = encodeURIComponent((message.query ? message.query + ' — ' : '') + 'via Husqy');
      const intent = `https://twitter.com/intent/tweet?text=${text}&url=${url}`;
      window.open(intent, '_blank');
      closeShareModal();
    } catch (error) {
      console.error('X share failed:', error);
      alert('Unable to open X.');
    }
  };

  const handleShareEmail = () => {
    try {
      const subject = message.query || 'Shared from Husqy';
      const body = buildShareText() + `\n\n${window.location.href}`;
      const mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      window.location.href = mailto;
      closeShareModal();
    } catch (error) {
      console.error('Email share failed:', error);
      alert('Email share failed.');
    }
  };

  const handleCopyLink = () => {
    const link = window.location.href;
    copyToClipboard(link)
      .then(() => alert('Link copied!'))
      .catch(() => alert(link));
  };

  const generatePDF = async () => {
    try {
      const buildExportHtml = (): string => {
        const htmlAnswer = safeRenderMarkdown(
          renderIcons(
            renderTables(message.text || '', message.response?.tables || [])
          )
        );

        const relatedImages = (message.response?.related_content || [])
          .filter(i => i.image)
          .map(i => `<div style="margin: 10px 0;">
              <div style="font-weight:600;color:#374151;margin-bottom:6px;">${i.title}</div>
              <img src="${i.image}" alt="${i.title}" style="max-width:100%;height:auto;border:1px solid #e5e7eb;border-radius:8px"/>
            </div>`)
          .join('');

        const files = (message.response?.file_links || [])
          .map(f => `<div style="margin:6px 0;"><span>📄 </span><a href="${f.url}" target="_blank" style="color:#2563eb;text-decoration:none;">${f.title}</a></div>`)
          .join('');

        const pages = (message.response?.related_content || [])
          .map(p => `<div style="margin:6px 0;"><span>🔗 </span><a href="${p.url}" target="_blank" style="color:#2563eb;text-decoration:none;">${p.title}</a></div>`)
          .join('');

        return `
          <div style="padding:24px; font-family: Arial, Helvetica, sans-serif; color:#1f2937;">
            ${message.query ? `<h1 style="font-size:18px;margin:0 0 16px 0;color:#111827;">${message.query}</h1>` : ''}
            <div class="answer-block">${htmlAnswer}</div>
            ${relatedImages ? `<h2 style="font-size:16px;margin:18px 0 8px 0;color:#111827;">Related Images</h2>${relatedImages}` : ''}
            ${files ? `<h2 style="font-size:16px;margin:18px 0 8px 0;color:#111827;">Files</h2>${files}` : ''}
            ${pages ? `<h2 style="font-size:16px;margin:18px 0 8px 0;color:#111827;">Related Pages</h2>${pages}` : ''}
          </div>
          <style>
            .answer-block { margin-top: 8px; }
            .answer-block table { width:100%; border-collapse: collapse; margin: 12px 0; }
            .answer-block th, .answer-block td { border: 1px solid #e5e7eb; padding: 8px; text-align:left; }
            .answer-block thead { background:#f3f4f6; }
            .answer-block img { max-width: 100%; height:auto; }
            .answer-block p { margin: 8px 0; }
            .answer-block ul { margin: 8px 0 8px 16px; }
            .answer-block ol { margin: 8px 0 8px 16px; }
            .answer-block h1,.answer-block h2,.answer-block h3 { margin: 12px 0 6px 0; }
            code { background:#f3f4f6; padding:2px 4px; border-radius:4px; }
          </style>
        `;
      };

      const createTempContainer = (html: string): HTMLDivElement => {
        const el = document.createElement('div');
        el.style.position = 'fixed';
        el.style.left = '-10000px';
        el.style.top = '0';
        el.style.width = '800px';
        el.innerHTML = html;
        document.body.appendChild(el);
        return el;
      };

      const inlineImages = async (root: HTMLElement) => {
        const imgs = Array.from(root.querySelectorAll('img')) as HTMLImageElement[];
        const fallback = 'https://hutechsolutions.com/wp-content/uploads/2024/08/hutech-logo-1.svg';
        await Promise.all(
          imgs.map(async (img) => {
            const src = img.getAttribute('src') || '';
            try {
              const res = await fetch(src, { mode: 'cors' });
              if (!res.ok) throw new Error('fetch failed');
              const blob = await res.blob();
              const reader = new FileReader();
              const dataUrl: string = await new Promise((resolve, reject) => {
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
              });
              img.src = dataUrl;
            } catch {
              img.src = fallback;
            }
          })
        );
      };

      const html = buildExportHtml();
      const container = createTempContainer(html);
      await inlineImages(container);

      const canvas = await html2canvas(container, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL('image/png');

      const pdf = new jsPDF('p', 'pt', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight;
      }

      pdf.save('hutech-response.pdf');
      document.body.removeChild(container);
    } catch (error) {
      console.error('PDF generation failed:', error);
      alert('PDF export failed. Please try again.');
    }
  };

  const generateMarkdown = () => {
    try {
      let markdown = '';

      if (message.query) {
        markdown += `# ${message.query}\n\n`;
      }

      const answerMd = message.text || '';
      markdown += `${answerMd}\n\n`;

      // Tables as GitHub-flavored Markdown
      if (message.response?.tables && message.response.tables.length > 0) {
        message.response.tables.forEach(tbl => {
          markdown += `\n### ${tbl.title}\n\n`;
          if (tbl.headers && tbl.headers.length) {
            markdown += `| ${tbl.headers.join(' | ')} |\n`;
            markdown += `| ${tbl.headers.map(() => '---').join(' | ')} |\n`;
          }
          tbl.rows.forEach(row => {
            markdown += `| ${row.join(' | ')} |\n`;
          });
          markdown += `\n`;
        });
      }

      // Related images
      if (message.response?.related_content) {
        const imgs = message.response.related_content.filter(i => i.image);
        if (imgs.length) {
          markdown += `\n## Related Images\n\n`;
          imgs.forEach(i => {
            markdown += `![${i.title}](${i.image})\n\n`;
          });
        }
      }

      // File links
      if (message.response?.file_links && message.response.file_links.length > 0) {
        markdown += '\n## Files\n\n';
        message.response.file_links.forEach(link => {
          markdown += `- [${link.title}](${link.url})\n`;
        });
      }

      // Related pages
      if (message.response?.related_content && message.response.related_content.length > 0) {
        markdown += '\n## Related Pages\n\n';
        message.response.related_content.forEach(item => {
          markdown += `- [${item.title}](${item.url})\n`;
        });
      }

      const blob = new Blob([markdown], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'hutech-response.md';
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Markdown generation failed:', error);
      alert('Markdown export failed. Please try again.');
    }
  };

  const generateDOCX = async () => {
    try {
      const children: (Paragraph | DocxTable)[] = [];

      if (message.query) {
        children.push(new Paragraph({ text: message.query, heading: HeadingLevel.HEADING_1 }));
        children.push(new Paragraph({ text: '' }));
      }

      const answerText = (message.text?.replace(/<[^>]*>/g, '') || '').trim();
      if (answerText) {
        answerText.split('\n').forEach(line => {
          if (line.trim()) children.push(new Paragraph({ text: line }));
        });
        children.push(new Paragraph({ text: '' }));
      }

      // Tables
      if (message.response?.tables && message.response.tables.length > 0) {
        message.response.tables.forEach(tbl => {
          children.push(new Paragraph({ text: tbl.title, heading: HeadingLevel.HEADING_2 }));
          const rows: TableRow[] = [];
          if (tbl.headers && tbl.headers.length) {
            rows.push(
              new TableRow({
                children: tbl.headers.map(h => new TableCell({
                  width: { size: 100 / tbl.headers.length, type: WidthType.PERCENTAGE },
                  children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })] })],
                }))
              })
            );
          }
          tbl.rows.forEach(r => {
            rows.push(
              new TableRow({
                children: r.map(cell => new TableCell({
                  width: { size: 100 / (tbl.headers?.length || r.length || 1), type: WidthType.PERCENTAGE },
                  children: [new Paragraph({ text: cell })],
                }))
              })
            );
          });
          children.push(new DocxTable({ rows }));
        });
      }

      // Images (related content) - export as links for compatibility
      if (message.response?.related_content) {
        const imgs = message.response.related_content.filter(i => i.image);
        if (imgs.length) {
          children.push(new Paragraph({ text: 'Related Images', heading: HeadingLevel.HEADING_2 }));
          for (const i of imgs) {
            children.push(new Paragraph({ text: i.title, heading: HeadingLevel.HEADING_3 }));
            if (i.image) {
              children.push(new Paragraph({
                children: [
                  new ExternalHyperlink({
                    children: [new TextRun({ text: i.image, style: 'Hyperlink' })],
                    link: i.image,
                  })
                ]
              }));
            }
          }
        }
      }

      // Files
      if (message.response?.file_links && message.response.file_links.length > 0) {
        children.push(new Paragraph({ text: 'Files', heading: HeadingLevel.HEADING_2 }));
        message.response.file_links.forEach(link => {
          children.push(new Paragraph({
            children: [
              new TextRun({ text: `${link.title}: ` }),
              new ExternalHyperlink({
                children: [new TextRun({ text: link.url, style: 'Hyperlink' })],
                link: link.url,
              }),
            ]
          }));
        });
      }

      // Related Pages
      if (message.response?.related_content && message.response.related_content.length > 0) {
        children.push(new Paragraph({ text: 'Related Pages', heading: HeadingLevel.HEADING_2 }));
        message.response.related_content.forEach(item => {
          children.push(new Paragraph({
            children: [
              new TextRun({ text: `${item.title}: ` }),
              new ExternalHyperlink({
                children: [new TextRun({ text: item.url, style: 'Hyperlink' })],
                link: item.url,
              })
            ]
          }));
        });
      }

      const doc = new DocxDocument({ sections: [{ properties: {}, children }] });
      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'hutech-response.docx';
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('DOCX generation failed:', error);
      alert('DOCX export failed. Please try again.');
    }
  };

  const handleLike = () => {
    setIsLiked(!isLiked);
    if (isDisliked) setIsDisliked(false);
  };

  const handleDislike = () => {
    setIsDisliked(!isDisliked);
    if (isLiked) setIsLiked(false);
  };

  return (
    <div className="message-actions flex items-center justify-between px-4 py-2">
      {/* Left side: Share and Export */}
      <div className="flex items-center gap-2">
        {/* Share Button opens modal */}
        <button
          onClick={openShareModal}
          className="action-button flex items-center gap-1 px-3 py-1.5 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors text-sm"
          title="Share"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
          </svg>
          Share
        </button>

        {/* Export Button with Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowExportDropdown(!showExportDropdown)}
            className="action-button flex items-center gap-1 px-3 py-1.5 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors text-sm"
            title="Export content"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Export
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-3 h-3">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </button>

          {showExportDropdown && (
            <div className="export-dropdown absolute left-0 top-full mt-1 bg-white rounded-md shadow-lg z-10 min-w-32">
              <button
                onClick={() => {
                  try {
                    generatePDF();
                    setShowExportDropdown(false);
                  } catch (error) {
                    console.error('PDF export error:', error);
                    alert('PDF export failed. Please try again.');
                  }
                }}
                className="block w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                title="Export as PDF"
              >
                PDF
              </button>
              <button
                onClick={() => {
                  try {
                    generateMarkdown();
                    setShowExportDropdown(false);
                  } catch (error) {
                    console.error('Markdown export error:', error);
                    alert('Markdown export failed. Please try again.');
                  }
                }}
                className="block w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                title="Export as Markdown"
              >
                Markdown
              </button>
              <button
                onClick={() => {
                  try {
                    generateDOCX();
                    setShowExportDropdown(false);
                  } catch (error) {
                    console.error('DOCX export error:', error);
                    alert('DOCX export failed. Please try again.');
                  }
                }}
                className="block w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                title="Export as DOCX"
              >
                DOCX
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Right side: Copy, Like, and Dislike */}
      <div className="flex items-center gap-2">
        {/* Copy Button */}
        <button
          onClick={handleCopy}
          className="action-button flex items-center gap-1 px-3 py-1.5 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors text-sm"
          title="Copy content"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
          </svg>
          Copy
        </button>

        {/* Like Button */}
        <button
          onClick={handleLike}
          className={`action-button flex items-center gap-1 px-3 py-1.5 rounded-md transition-colors text-sm ${isLiked ? 'text-blue-600 bg-blue-50' : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
            }`}
          title="Like"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill={isLiked ? "currentColor" : "none"} viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.633 10.5c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 012.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 00.322-1.672V3a.75.75 0 01.75-.75A2.25 2.25 0 0116.5 4.5c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 01-2.649 7.521c-.388.482-.987.729-1.605.729H13.48c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 00-1.423-.23H5.904M14.25 9h2.25M5.904 18.75c.083.205.173.405.27.602.398.83 1.169 1.398 2.02 1.398h.716c.83 0 1.598-.481 1.998-1.25a.739.739 0 00.109-.376c0-.621-.504-1.125-1.125-1.125H9.375c-.621 0-1.125.504-1.125 1.125v.375M5.904 18.75L7.5 16.5H5.904z" />
          </svg>
        </button>

        {/* Dislike Button */}
        <button
          onClick={handleDislike}
          className={`action-button flex items-center gap-1 px-3 py-1.5 rounded-md transition-colors text-sm ${isDisliked ? 'text-red-600 bg-red-50' : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
            }`}
          title="Dislike"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill={isDisliked ? "currentColor" : "none"} viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4 rotate-180">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.633 10.5c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 012.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 00.322-1.672V3a.75.75 0 01.75-.75A2.25 2.25 0 0116.5 4.5c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 01-2.649 7.521c-.388.482-.987.729-1.605.729H13.48c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 00-1.423-.23H5.904M14.25 9h2.25M5.904 18.75c.083.205.173.405.27.602.398.83 1.169 1.398 2.02 1.398h.716c.83 0 1.598-.481 1.998-1.25a.739.739 0 00.109-.376c0-.621-.504-1.125-1.125-1.125H9.375c-.621 0-1.125.504-1.125 1.125v.375M5.904 18.75L7.5 16.5H5.904z" />
          </svg>
        </button>
        {/* Share Modal */}
        {showShareModal && (
          <div className="share-modal-overlay" role="dialog" aria-modal="true">
            <div className="share-card" role="document">
              <div className="share-card-header">
                <div className="share-card-title">Share</div>
                <button className="share-close" onClick={closeShareModal} aria-label="Close">×</button>
              </div>
              <div className="share-options">
                <button className="share-option" onClick={handleShareWhatsApp} title="WhatsApp">
                  <span className="share-icon whatsapp">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="24" height="24"><path d="M12 2a10 10 0 00-8.94 14.5L2 22l5.62-1.5A10 10 0 1012 2zm0 18a8 8 0 01-4.1-1.12l-.29-.17-3.33.89.89-3.33-.17-.29A8 8 0 1112 20zm3.71-5.29c-.2-.1-1.17-.58-1.35-.65-.18-.07-.31-.1-.44.1-.13.2-.5.65-.61.79-.11.14-.22.16-.42.06-.2-.1-.83-.31-1.58-.99-.58-.52-.97-1.16-1.09-1.36-.11-.2-.01-.31.08-.41.08-.08.2-.22.29-.33.09-.11.12-.19.18-.31.06-.12.03-.23-.01-.33-.04-.1-.44-1.06-.6-1.45-.16-.38-.32-.33-.44-.34-.11-.01-.23-.01-.35-.01-.12 0-.33.05-.5.23-.17.18-.66.65-.66 1.58 0 .93.68 1.83.78 1.96.1.13 1.33 2.04 3.23 2.86.45.19.8.31 1.07.4.45.14.86.12 1.19.07.36-.05 1.17-.48 1.33-.94.16-.46.16-.85.11-.94-.05-.09-.18-.14-.38-.24z" /></svg>
                  </span>
                  <span className="share-label">WhatsApp</span>
                </button>

                <button className="share-option" onClick={handleShareFacebook} title="Facebook">
                  <span className="share-icon facebook">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="24" height="24"><path d="M22 12a10 10 0 10-11.5 9.95v-7.04H7.9V12h2.6V9.8c0-2.57 1.53-3.99 3.87-3.99 1.12 0 2.29.2 2.29.2v2.52h-1.29c-1.27 0-1.66.79-1.66 1.6V12h2.83l-.45 2.91h-2.38v7.04A10 10 0 0022 12z" /></svg>
                  </span>
                  <span className="share-label">Facebook</span>
                </button>

                <button className="share-option" onClick={handleShareX} title="X">
                  <span className="share-icon x">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="24" height="24"><path d="M17.53 2H20l-5.5 6.3L21 22h-6.4l-3.9-6.1L5.9 22H3.4l6-6.9L3 2h6.5l3.5 5.6L17.5 2h.03zM8.2 3.7h-1l8.8 14h1L8.2 3.7z" /></svg>
                  </span>
                  <span className="share-label">X</span>
                </button>

                <button className="share-option" onClick={handleShareEmail} title="Email">
                  <span className="share-icon email">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="24" height="24"><path d="M20 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V6a2 2 0 00-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" /></svg>
                  </span>
                  <span className="share-label">Email</span>
                </button>

                <button className="share-option" onClick={handleCopyLink} title="Copy link">
                  <span className="share-icon copy">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="24" height="24"><path d="M16 1H4a2 2 0 00-2 2v12h2V3h12V1zm3 4H8a2 2 0 00-2 2v14a2 2 0 002 2h11a2 2 0 002-2V7a2 2 0 00-2-2zm0 16H8V7h11v14z" /></svg>
                  </span>
                  <span className="share-label">Copy</span>
                </button>
              </div>

              <div className="share-link-row">
                <input className="share-link-input" readOnly value={window.location.href} />
                <button className="share-copy-button" onClick={handleCopyLink}>Copy</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const BotMessage: React.FC<{
  message: Message;
  onSuggestionClick: (suggestion: string) => void;
}> = ({ message, onSuggestionClick }) => {
  const response = message.response;
  const answerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = answerRef.current;
    if (!root) return;
    const fallback = 'https://hutechsolutions.com/wp-content/uploads/2024/08/hutech-logo-1.svg';
    const imgs = Array.from(root.querySelectorAll('img')) as HTMLImageElement[];
    imgs.forEach((img) => {
      const prev = img.onerror;
      img.onerror = () => {
        if (img.src !== fallback) img.src = fallback;
        if (typeof prev === 'function') try { prev(new Event('error')); } catch { }
      };
    });
  }, [message.text]);

  return (
    <div className="flex items-start justify-center">
      <div className="max-w-3xl w-full">

        {/* Related Content Card Carousel */}
        {response?.related_content && response.related_content.length > 0 && (
          <RelatedContentCarousel items={response.related_content} />
        )}

        {/* Main Answer */}
        {message.text && (
          <div className="p-4 rounded-xl prose text-gray-800">
            <div ref={answerRef} dangerouslySetInnerHTML={{
              __html: safeRenderMarkdown(
                renderIcons(
                  renderTables(message.text, response?.tables || [])
                )
              )
            }} />
          </div>
        )}

        {/* Action Buttons - Hide for welcome message */}
        {message.text && message.id !== 1 && (
          <MessageActions message={message} />
        )}

        {/* File Links */}
        {response?.file_links && response.file_links.length > 0 && (
          <FileLinksSection files={response.file_links} />
        )}

        {/* Suggested Questions */}
        {response?.recommendations && response.recommendations.length > 0 && (
          <SuggestionsSection
            suggestions={response.recommendations}
            onSuggestionClick={onSuggestionClick}
          />
        )}
      </div>
    </div>
  );
};

const LoadingMessage: React.FC = () => {
  return (
    <div className="flex justify-start">
      <div className="rounded-xl rounded-bl-none p-4 shadow-md max-w-sm bg-white">
        <div className="flex space-x-2 animate-pulse">
          <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
          <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
          <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
        </div>
      </div>
    </div>
  );
};

const RelatedContentCarousel: React.FC<{ items: RelatedContent[] }> = ({ items }) => {
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);


  // Function to get favicon URL for a website
  const getFaviconUrl = (websiteUrl: string): string => {
    try {
      const urlObj = new URL(websiteUrl);
      const domain = urlObj.hostname;
      // Use Google's favicon service for reliable favicon fetching
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=16`;
    } catch {
      return '';
    }
  };

  const scrollLeft = () => {
    if (containerRef.current) {
      const scrollAmount = 200;
      containerRef.current.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (containerRef.current) {
      const scrollAmount = 200;
      containerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const handleScroll = () => {
    if (containerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = containerRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1);
    }
  };

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      handleScroll(); // Initial check
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, []);

  return (
    <div className="w-full mb-6">
      <h5 className="font-semibold text-gray-800 mb-2 px-4">Related content</h5>
      <div className="related-content-carousel-wrapper">
        <button
          onClick={scrollLeft}
          disabled={!canScrollLeft}
          className={`carousel-nav-button carousel-nav-left ${!canScrollLeft ? 'disabled' : ''}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>

        <div
          ref={containerRef}
          className="related-content-horizontal-container"
        >
          {items.map((item, index) => (
            <a
              key={index}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="related-content-mini-card"
            >
              <div className="mini-card-favicon">
                <img
                  src={getFaviconUrl(item.url)}
                  alt={`${new URL(item.url).hostname} favicon`}
                  className="favicon-image"
                  onError={(e) => {
                    // Replace with fallback icon if favicon fails
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const fallback = target.nextElementSibling as HTMLElement;
                    if (fallback) fallback.style.display = 'flex';
                  }}
                />
                <div className="favicon-fallback" style={{ display: 'none' }}>
                  🔗
                </div>
              </div>
              <div className="mini-card-content">
                <div className="mini-card-hostname">
                  {new URL(item.url).hostname.replace('www.', '')}
                </div>
                <div className="mini-card-title">{item.title}</div>
              </div>
            </a>
          ))}
        </div>

        <button
          onClick={scrollRight}
          disabled={!canScrollRight}
          className={`carousel-nav-button carousel-nav-right ${!canScrollRight ? 'disabled' : ''}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      </div>
    </div>
  );
};

const FileLinksSection: React.FC<{ files: FileLink[] }> = ({ files }) => {
  return (
    <div className="mt-6">
      <h5 className="font-semibold text-gray-800 mb-2 px-4">Files</h5>
      {files.map((file, index) => (
        <a
          key={index}
          href={file.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 p-3 my-1 rounded-lg hover:bg-gray-100 transition-colors duration-200">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
            <path d="M4 4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V8a2 2 0 00-2-2h-5L9 4H4z" />
          </svg>
          <span className="text-sm font-medium text-gray-700">{file.title}</span>
        </a>
      ))}
    </div>
  );
};

const SuggestionsSection: React.FC<{
  suggestions: string[];
  onSuggestionClick: (suggestion: string) => void;
}> = ({ suggestions, onSuggestionClick }) => {
  const [clickedSuggestions, setClickedSuggestions] = useState<Set<string>>(new Set());

  const handleSuggestionClick = (suggestion: string) => {
    // Mark this suggestion as clicked
    setClickedSuggestions(prev => new Set(prev.add(suggestion)));
    // Call the original click handler
    onSuggestionClick(suggestion);
  };

  return (
    <div className="mt-6">
      <h5 className="font-semibold text-gray-800 mb-3 px-4">Suggested Questions</h5>
      <div className="px-4">
        {suggestions.map((suggestion, index) => (
          <button
            key={index}
            onClick={() => handleSuggestionClick(suggestion)}
            className={`suggestion-button flex items-center justify-between w-full text-left text-sm ${clickedSuggestions.has(suggestion) ? 'clicked' : 'text-gray-700'
              }`}>
            <span>{suggestion}</span>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </button>
        ))}
      </div>
    </div>
  );
};

// Utility functions
const safeRenderMarkdown = (content: string): string => {
  try {
    // Process the content through our preprocessing pipeline
    const processed = preprocessResponse(content);

    // Convert to HTML using marked
    const html = marked(processed) as string;

    // Basic XSS protection - remove dangerous attributes and scripts
    let safeHtml = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+="[^"]*"/gi, '')
      .replace(/on\w+='[^']*'/gi, '');

    // Fix cases where a leading '#' remains inside heading tags
    safeHtml = safeHtml.replace(/<(h[1-6])(\b[^>]*)>#{1,6}\s+/gi, '<$1$2>');
    // Remove any empty headings that may have been introduced
    safeHtml = safeHtml.replace(/<h[1-6][^>]*>\s*<\/h[1-6]>/gi, '');

    return safeHtml;
  } catch (error) {
    console.error('Error rendering markdown:', error);
    return content; // Fallback to plain text
  }
};

const renderTables = (answer: string, tables: Table[]): string => {
  if (!tables || tables.length === 0) {
    return answer;
  }

  let processedAnswer = answer;
  tables.forEach(table => {
    const placeholder = `[TABLE:${table.title}]`;
    if (processedAnswer.includes(placeholder)) {
      let tableHtml = `<div class="overflow-x-auto my-4">`;
      tableHtml += `<table class="min-w-full border border-gray-300 rounded-lg overflow-hidden shadow-sm">`;
      tableHtml += `<caption class="p-2 text-sm text-gray-500 font-medium text-left">${table.title}</caption>`;

      if (table.headers && table.headers.length > 0) {
        tableHtml += `<thead class="bg-gray-100">`;
        tableHtml += `<tr>${table.headers.map(h => `<th class="p-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">${h}</th>`).join('')}</tr>`;
        tableHtml += `</thead>`;
      }

      tableHtml += `<tbody class="divide-y divide-gray-200">`;
      table.rows.forEach(row => {
        tableHtml += `<tr class="bg-white">`;
        tableHtml += row.map(cell => `<td class="p-3 text-sm text-gray-800">${cell}</td>`).join('');
        tableHtml += `</tr>`;
      });
      tableHtml += `</tbody>`;
      tableHtml += `</table></div>`;

      processedAnswer = processedAnswer.replace(placeholder, tableHtml);
    }
  });

  return processedAnswer;
};

const getIconSVG = (iconName: string): string => {
  const icons: { [key: string]: string } = {
    location: `<svg xmlns="http://www.w3.org/2000/svg" class="inline-block w-5 h-5" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z"/></svg>`,
    phone: `<svg xmlns="http://www.w3.org/2000/svg" class="inline-block w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2 6.5c1.5-2 4-3 6.5-2l2 2a1 1 0 010 1.4L9 10a12 12 0 005 5l2.1-1.5a1 1 0 011.4 0l2 2c1 2.5 0 5-2 6.5-.6.4-1.4.5-2.1.2C10.2 20.5 3.5 13.8 1.8 6.6c-.3-.7-.2-1.5.2-2.1z"/></svg>`,
    mobile: `<svg xmlns="http://www.w3.org/2000/svg" class="inline-block w-5 h-5" viewBox="0 0 24 24"><path fill="currentColor" d="M15.5 1h-7a.5.5 0 00-.5.5v21a.5.5 0 00.5.5h7a.5.5 0 00.5-.5V1.5a.5.5 0 00-.5-.5zM12 22a1 1 0 110-2 1 1 0 010 2z"/></svg>`,
    email: `<svg xmlns="http://www.w3.org/2000/svg" class="inline-block w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5h18a2 2 0 012 2v10a2 2 0 01-2 2H3a2 2 0 01-2-2V7a2 2 0 012-2z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7l9 6 9-6" /></svg>`
  };
  return icons[iconName] || '';
};

const renderIcons = (text: string): string => {
  return text.replace(/\[ICON:(.*?)]/g, (match, iconName) => {
    return `<span class="inline-block align-middle">${getIconSVG(iconName.trim())}</span>`;
  });
};

const preprocessResponse = (text: string): string => {
  let processedText = text.replace(/&nbsp;|\u00A0|\t/g, ' ');
  processedText = processedText.replace(/([^\n])---/g, '$1\n\n---\n\n');
  processedText = processedText.replace(/^(\s*)\*\s+/gm, '$1* ');
  processedText = processedText.replace(/^(#+)(?! )/gm, '$1 ');
  processedText = processedText.replace(/^(\s*>)(?! )/gm, '$1 ');
  return processedText.trim();
};

export default App;
