"use client";

export default function HoverScrollbar({ as: Component = "div", className = "", children, ...props }) {
  return (
    <Component className={`hover-scrollbar overflow-auto ${className}`.trim()} {...props}>
      {children}
    </Component>
  );
}
