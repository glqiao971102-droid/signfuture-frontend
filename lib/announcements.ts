// Announcement banners shown in the home hero ("Signage & Printing Studio")
// frame as a rotating slideshow. To add a new announcement: drop the image in
// public/announcements/ and add an entry here (order = display order).
export type Announcement = {
  src: string;
  alt: string;
  /** Optional click-through link. */
  href?: string;
};

export const ANNOUNCEMENTS: Announcement[] = [
  { src: "/announcements/announce-1.jpg", alt: "New Product Launch — LED Sign" },
  { src: "/announcements/announce-2.jpg", alt: "New Product Launch — Material" },
  { src: "/announcements/announce-3.jpg", alt: "Bring Your Brand to Life" },
];
