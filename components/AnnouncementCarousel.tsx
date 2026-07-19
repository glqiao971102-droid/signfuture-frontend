"use client";

import { useEffect, useState } from "react";
import { ANNOUNCEMENTS } from "@/lib/announcements";

const INTERVAL = 10000; // 10 seconds

export default function AnnouncementCarousel() {
  const items = ANNOUNCEMENTS;
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (items.length <= 1) return;
    const id = window.setInterval(
      () => setIndex((i) => (i + 1) % items.length),
      INTERVAL
    );
    return () => window.clearInterval(id);
  }, [items.length]);

  if (items.length === 0) {
    return (
      <div className="announce empty">
        <span>Announcements</span>
      </div>
    );
  }

  const go = (dir: number) =>
    setIndex((i) => (i + dir + items.length) % items.length);

  return (
    <div className="announce" role="group" aria-label="Announcements">
      {items.map((item, i) => {
        const slide = (
          <>
            {/* blurred fill so the fixed frame is fully covered without bars */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="announce-bg" src={item.src} alt="" aria-hidden="true" />
            {/* the full announcement, always shown in its entirety */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="announce-img" src={item.src} alt={item.alt} />
          </>
        );
        return (
          <div
            key={item.src}
            className={`announce-slide${i === index ? " active" : ""}`}
            aria-hidden={i === index ? undefined : true}
          >
            {item.href ? (
              <a href={item.href} aria-label={item.alt}>
                {slide}
              </a>
            ) : (
              slide
            )}
          </div>
        );
      })}

      {items.length > 1 && (
        <>
          <button
            type="button"
            className="announce-arrow prev"
            aria-label="Previous announcement"
            onClick={() => go(-1)}
          >
            ‹
          </button>
          <button
            type="button"
            className="announce-arrow next"
            aria-label="Next announcement"
            onClick={() => go(1)}
          >
            ›
          </button>
        </>
      )}

      {items.length > 1 && (
        <div className="announce-dots">
          {items.map((item, i) => (
            <button
              key={item.src}
              type="button"
              className={`announce-dot${i === index ? " active" : ""}`}
              aria-label={`Show announcement ${i + 1}`}
              onClick={() => setIndex(i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
