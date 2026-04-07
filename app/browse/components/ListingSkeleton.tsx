"use client";

export default function ListingSkeleton() {
  return (
    <div className="flex flex-col bg-gray-900 rounded-xl border border-gray-800 overflow-hidden animate-pulse">
      <div className="h-36 bg-gray-800" />
      <div className="p-3 flex flex-col gap-2">
        <div className="h-5 w-16 bg-gray-700 rounded" />
        <div className="h-3 w-full bg-gray-700 rounded" />
        <div className="h-3 w-2/3 bg-gray-700 rounded" />
        <div className="h-3 w-20 bg-gray-800 rounded mt-1" />
      </div>
    </div>
  );
}
