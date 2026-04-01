import React from "react";

const Card = ({ children, style = {}, ...props }) => (
  <div
    style={{
      background: '#FFF9ED',
      borderRadius: 16,
      boxShadow: '0 2px 8px #e0c9a6',
      border: '1.5px solid #E0C9A6',
      padding: '1.2rem 1rem',
      margin: '1rem 0',
      ...style,
    }}
    {...props}
  >
    {children}
  </div>
);

export default Card;
