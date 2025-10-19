import React from 'react'

// Simple Icon wrapper for FontAwesome icons that applies RTL-aware spacing and a subtle entry animation
// Accepts ariaHidden (default true). If ariaHidden is false, pass ariaLabel to expose accessible name.
export default function Icon({ name, className = '', ariaHidden = true, ariaLabel = '' }){
  // name should be the FontAwesome class fragment like 'fa-users' or 'fab fa-whatsapp'
  const classes = `${name} ${className} transition-transform duration-200 transform`;
  return (
    <i
      className={classes}
      aria-hidden={ariaHidden}
      {...(!ariaHidden ? { 'aria-label': ariaLabel || undefined, role: 'img' } : {})}
    />
  )
}
