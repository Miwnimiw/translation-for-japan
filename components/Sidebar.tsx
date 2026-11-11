"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Languages,
  ScanText,
  BookMarked,
  Layers,
  Settings,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/translation", label: "Translation", icon: Languages },
  { href: "/ocr", label: "Text Extractor", icon: ScanText },
  { href: "/saved", label: "Saved Text", icon: BookMarked },
  { href: "/flashcards", label: "Flashcards", icon: Layers },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop rail */}
      <aside className="hidden md:flex md:fixed md:inset-y-0 md:left-0 md:w-64 md:flex-col border-r border-line dark:border-line-dark bg-paper dark:bg-paper-dark">
        <div className="px-6 pt-7 pb-6">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-2xl text-ai-700 dark:text-ai-300">言葉</span>
            <span className="font-sans text-sm text-ink-soft dark:text-ink-dark/60 tracking-wide">
              Kotoba
            </span>
          </div>
          <p className="mt-1 text-xs text-ink-soft dark:text-ink-dark/50">
            JP / EN → Thai learning companion
          </p>
        </div>
        <nav className="flex-1 px-3 space-y-0.5">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`focus-ring flex items-center gap-3 rounded px-3 py-2.5 text-sm transition-colors ${
                  active
                    ? "bg-ai-50 text-ai-700 dark:bg-ai-700/20 dark:text-ai-100 font-medium"
                    : "text-ink-soft hover:bg-ink/5 dark:text-ink-dark/70 dark:hover:bg-white/5"
                }`}
              >
                <Icon size={18} strokeWidth={active ? 2.25 : 1.75} />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="px-6 py-5 text-xs text-ink-soft dark:text-ink-dark/40 border-t border-line dark:border-line-dark">
          Powered by Gemini
        </div>
      </aside>

      {/* Mobile bottom bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-paper dark:bg-paper-dark border-t border-line dark:border-line-dark flex justify-around py-1.5">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`focus-ring flex flex-col items-center gap-0.5 px-2 py-1.5 rounded text-[10px] ${
                active ? "text-ai-600 dark:text-ai-300" : "text-ink-soft dark:text-ink-dark/60"
              }`}
            >
              <Icon size={19} strokeWidth={active ? 2.25 : 1.75} />
              {label === "Text Extractor" ? "OCR" : label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
