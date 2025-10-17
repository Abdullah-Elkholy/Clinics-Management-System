import React from 'react'

export default function Navigation({ activeSection, onSectionChange }) {
  return (
    <nav className="p-4" role="navigation" aria-label="التنقل الرئيسي">
      <ul className="space-y-2" role="list">
        <li role="listitem">
          <button
            onClick={() => onSectionChange('messages')}
            className={`nav-item w-full text-right px-4 py-3 rounded-lg transition duration-200 flex items-center justify-between
              ${activeSection === 'messages' 
                ? 'bg-blue-50 text-blue-600' 
                : 'hover:bg-blue-50 hover:text-blue-600'
              }`}
            aria-current={activeSection === 'messages' ? 'page' : undefined}
            aria-label="قسم الرسائل"
          >
            <span>الرسائل</span>
            <i className="fas fa-comments" aria-hidden="true"></i>
          </button>
        </li>
        <li role="listitem">
          <button
            onClick={() => onSectionChange('management')}
            className={`nav-item w-full text-right px-4 py-3 rounded-lg transition duration-200 flex items-center justify-between
              ${activeSection === 'management' 
                ? 'bg-blue-50 text-blue-600' 
                : 'hover:bg-blue-50 hover:text-blue-600'
              }`}
            aria-current={activeSection === 'management' ? 'page' : undefined}
            aria-label="قسم الإدارة"
          >
            <span>الإدارة</span>
            <i className="fas fa-cog" aria-hidden="true"></i>
          </button>
        </li>
      </ul>
    </nav>
  )
}