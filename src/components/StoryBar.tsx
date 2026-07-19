"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

export default function StoryBar() {
  const [stories, setStories] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/stories")
      .then((res) => res.json())
      .then((data) => setStories(data));
  }, []);

  return (
    <div className="flex gap-4 overflow-x-auto py-4 px-4 border-b border-zinc-800 scrollbar-hide">
      {stories.map((group) => (
        <div key={group.user.id} className="flex-shrink-0 text-center">
          <div className="w-16 h-16 rounded-full p-[2px] bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-500">
            <Image
              src={group.user.avatar || "/default-avatar.png"}
              alt={group.user.username}
              width={60}
              height={60}
              unoptimized={group.user.avatar?.includes("svg") || group.user.avatar?.startsWith("/uploads/")}
              className="rounded-full object-cover border-2 border-black"
            />
          </div>
          <p className="text-xs mt-1 truncate w-16">{group.user.username}</p>
        </div>
      ))}
    </div>
  );
}
