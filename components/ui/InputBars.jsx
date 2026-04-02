const BASE_BAR_CLASSNAME =
  "w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 transition-all duration-200 placeholder:text-slate-400 hover:border-slate-300 focus:border-[#7c3aed] focus:outline-none focus:ring-1 focus:ring-[#7c3aed]/30";
const SELECT_ICON_CLASSNAME =
  "appearance-none bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='none' stroke='%236b7280' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 8l4 4 4-4'/%3E%3C/svg%3E\")] bg-no-repeat bg-[right_0.85rem_center] bg-[length:0.9rem_0.9rem] pr-10";

const SIZE_CLASSNAME = {
  sm: "px-3 py-2",
  md: "",
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
