const BASE_BAR_CLASSNAME =
  "w-full rounded-2xl border border-slate-200 bg-white text-sm text-slate-700 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none";
const SELECT_ICON_CLASSNAME =
  "appearance-none bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='none' stroke='%2394a3b8' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 8l4 4 4-4'/%3E%3C/svg%3E\")] bg-no-repeat bg-[right_0.75rem_center] bg-[length:0.9rem_0.9rem] pr-10";

const SIZE_CLASSNAME = {
  sm: "px-3 py-1.5",
  md: "px-4 py-2",
  lg: "px-4 py-3"
};

export function InputBar({ className = "", size = "md", ...props }) {
  return <input {...props} className={`${BASE_BAR_CLASSNAME} ${SIZE_CLASSNAME[size]} ${className}`} />;
}

export function SelectBar({ className = "", children, size = "md", ...props }) {
  return (
    <select
      {...props}
      className={`${BASE_BAR_CLASSNAME} ${SELECT_ICON_CLASSNAME} ${SIZE_CLASSNAME[size]} ${className}`}
    >
      {children}
    </select>
  );
}

export function TextAreaBar({ className = "", size = "md", ...props }) {
  return <textarea {...props} className={`${BASE_BAR_CLASSNAME} ${SIZE_CLASSNAME[size]} ${className}`} />;
}
