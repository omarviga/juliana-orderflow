import { ReactNode } from "react";
import { Header } from "@/components/pos/Header";

interface Props {
  children: ReactNode;
}

export function Layout({ children }: Props) {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <Header />
      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </div>
  );
}
