"use client";

import { useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { useAuth } from "@/components/auth/AuthProvider";
import { createQueryClient } from "@/lib/query";

// One cache per signed-in user. Sign-out reloads the page, which already empties it; the key also
// covers a token swapped without a reload, so one person's cached orders never render for another.
function UserQueryClient({ children }) {
  const [client] = useState(createQueryClient);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

export default function QueryProvider({ children }) {
  const { user } = useAuth();
  return <UserQueryClient key={user?.id ?? "anon"}>{children}</UserQueryClient>;
}
