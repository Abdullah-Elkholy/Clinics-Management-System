import React from 'react'
import Icon from './Icon'
import { useAuthorization } from '../lib/authorization'

export default function Navigation({ activeSection, onSectionChange }) {
  const { canSeeManagement } = useAuthorization()

  return (
    <nav className="p-4" role="navigation" aria-label="التنقل الرئيسي">
      <ul className="space-y-2" role="list">
        <li role="listitem">
          <button
            type="button"
            onClick={() => onSectionChange('messages')}
            className={`nav-item w-full text-right px-4 py-3 rounded-lg transition duration-200 flex items-center justify-between
              ${activeSection === 'messages' 
                ? 'bg-blue-50 text-blue-600' 
                : 'hover:bg-blue-50 hover:text-blue-600'
              }`}
            aria-current={activeSection === 'messages' ? 'page' : undefined}
            aria-pressed={activeSection === 'messages' ? 'true' : 'false'}
            aria-label="قسم الرسائل"
            title="الرسائل"
            // focus styles for keyboard users
            onKeyDown={() => {}}
          >
            <span>الرسائل</span>
            <Icon name="fas fa-comments" />
          </button>
        </li>
        {canSeeManagement && (
          <li role="listitem">
            <button
              type="button"
              onClick={() => onSectionChange('management')}
              className={`nav-item w-full text-right px-4 py-3 rounded-lg transition duration-200 flex items-center justify-between
                ${activeSection === 'management' 
                  ? 'bg-blue-50 text-blue-600' 
                  : 'hover:bg-blue-50 hover:text-blue-600'
                }`}
              aria-current={activeSection === 'management' ? 'page' : undefined}
              aria-pressed={activeSection === 'management' ? 'true' : 'false'}
              aria-label="قسم الإدارة"
              title="الإدارة"
              onKeyDown={() => {}}
            >
              <span>الإدارة</span>
              <Icon name="fas fa-cog" />
            </button>
          </li>
        )}
      </ul>
      <style jsx>{`
        .nav-item:focus {
          outline: none;
          box-shadow: 0 0 0 3px rgba(59,130,246,0.15);
        }
      `}</style>
    </nav>
  )
}