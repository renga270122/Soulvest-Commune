import React from "react";

// Banner component for the illustrated header
// Pass an image path (e.g., /assets/banner-login.png) as the src prop
const Banner = ({ src, alt = "Banner", height = 160, style = {} }) => (
  <div
    style={{
      width: "100%",
      height,
      background: `url(${src}) center/cover no-repeat`,
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
      ...style,
    }}
    aria-label={alt}
  />
);

export default Banner;
