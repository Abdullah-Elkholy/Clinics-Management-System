import React from 'react'

// Simple Icon wrapper for FontAwesome icons that applies RTL-aware spacing and a subtle entry animation
// Accepts ariaHidden (default true). If ariaHidden is false, pass ariaLabel to expose accessible name.
export default function Icon({ name, className = '', ariaHidden = true, ariaLabel = '' }){
  // name should be the FontAwesome class fragment like 'fa-users' or 'fab fa-whatsapp'
  const classes = `${name} ${className} transition-transform duration-200 transform`;
  // ensure icons are aria-hidden by default unless an ariaLabel is provided
  const hidden = ariaLabel ? false : ariaHidden;
  // Do not render empty aria-label attribute when ariaLabel is falsy
  const props = { className: classes }
  if (hidden) props['aria-hidden'] = true
  else { props['aria-label'] = ariaLabel; props['role'] = 'img' }
  return <i {...props} />;
}
