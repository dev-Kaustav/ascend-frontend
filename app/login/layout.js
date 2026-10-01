// Staff sign in: never indexed, and it must not present the public store's identity.
export const metadata = {
  title: "Staff sign in",
  description: "Sign in to the Ascend staff workspace.",
  robots: { index: false, follow: false }
};

export default function LoginLayout({ children }) {
  return children;
}
