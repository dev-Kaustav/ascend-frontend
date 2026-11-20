"use client";

import { useParams } from "next/navigation";
import BeatScreen from "@/components/shops/BeatScreen";

export default function BeatPage() {
  const { beatId } = useParams();
  return <BeatScreen beatId={beatId} />;
}
