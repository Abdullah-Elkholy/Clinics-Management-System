import React from 'react'

// Simple Icon wrapper for FontAwesome icons that applies RTL-aware spacing and a subtle entry animation
export default function Icon({ name, className = '', ariaHidden = true }){
  // name should be the FontAwesome class fragment like 'fa-users' or 'fab fa-whatsapp'
  const classes = `${name} ${className} transition-transform duration-200 transform`;
  return <i className={classes} aria-hidden={ariaHidden}></i>
}
