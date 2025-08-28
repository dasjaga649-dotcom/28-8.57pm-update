import React, { useState } from 'react';

interface NavigationProps {
  currentPage: 'client' | 'chat';
  onNavigate: (page: 'client' | 'chat') => void;
}

const Navigation: React.FC<NavigationProps> = ({ currentPage, onNavigate }) => {
  const [activeItem, setActiveItem] = useState('Contact Us');

  const handleItemClick = (itemName: string) => {
    setActiveItem(itemName);
  };

  return (
    <header className="main-header">
      <div className="header-container">
        <div className="logo-section">
          <img
            src="https://hutechsolutions.com/wp-content/uploads/2024/08/hutech-logo-1.svg"
            alt="Hutech Solutions"
            className="hutech-logo"
          />
          <img
            src="https://hutechsolutions.com/wp-content/uploads/2024/08/cmmi-level3-logo.svg"
            alt="CMMI Level 3"
            className="cmmi-logo"
          />
        </div>
        <nav className="navigation-menu">
          <button
            className={`nav-item ${activeItem === 'Home' ? 'active' : ''}`}
            onClick={() => handleItemClick('Home')}
          >
            Home
          </button>
          <button
            className={`nav-item ${activeItem === 'Company' ? 'active' : ''}`}
            onClick={() => handleItemClick('Company')}
          >
            Company
          </button>
          <button
            className={`nav-item ${activeItem === 'Services' ? 'active' : ''}`}
            onClick={() => handleItemClick('Services')}
          >
            Services
          </button>
          <button
            className={`nav-item ${activeItem === 'Industries' ? 'active' : ''}`}
            onClick={() => handleItemClick('Industries')}
          >
            Industries
          </button>
          <button
            className={`nav-item ${activeItem === 'Blogs' ? 'active' : ''}`}
            onClick={() => handleItemClick('Blogs')}
          >
            Blogs
          </button>
          <button
            className={`nav-item ${activeItem === 'Careers' ? 'active' : ''}`}
            onClick={() => handleItemClick('Careers')}
          >
            Careers
          </button>
          <button
            className={`nav-item ${activeItem === 'Case Studies' ? 'active' : ''}`}
            onClick={() => handleItemClick('Case Studies')}
          >
            Case Studies
          </button>
          <button
            className={`nav-item ${activeItem === 'Contact Us' ? 'active' : ''}`}
            onClick={() => handleItemClick('Contact Us')}
          >
            Contact Us
          </button>
          <button
            className={`nav-item chat-button ${currentPage === 'chat' ? 'chat-active' : ''}`}
            onClick={() => {
              handleItemClick('Chat');
              onNavigate(currentPage === 'chat' ? 'client' : 'chat');
            }}
          >
            Chat
          </button>
        </nav>
      </div>
    </header>
  );
};

export default Navigation;
