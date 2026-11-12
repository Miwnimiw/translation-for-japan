"use client";

/**
 * ElectronNavigator
 * Listens for "navigate-to" IPC events pushed from Electron's main process
 * and uses Next.js router to navigate accordingly.
 *
 * Mount once inside the root layout (client boundary).
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ElectronNavigator() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined" || !window.electronAPI?.onNavigateTo) return;

    const cleanup = window.electronAPI.onNavigateTo((routePath: string) => {
      router.push(routePath);
    });

    return cleanup;
  }, [router]);

  return null;
}

