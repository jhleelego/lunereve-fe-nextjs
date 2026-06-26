"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ShelfFrameSimAccessDenied() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/");
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4 text-center text-neutral-500">
      <p className="text-sm">페이지를 찾을 수 없습니다.</p>
    </div>
  );
}
