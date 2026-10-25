import type { Metadata } from "next";
import { Shared } from "@/components/shared";

export const metadata: Metadata = {
  title: "Sua parte do racha · Racha",
  description: "Abre, escolhe o seu nome e paga o seu Pix.",
};

export default function Page() {
  return <Shared />;
}
