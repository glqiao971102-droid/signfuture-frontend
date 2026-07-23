"use client";

import { use } from "react";
import ProductEditor from "@/components/admin/ProductEditor";

export default function AdminProductEditPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  return <ProductEditor slug={slug} />;
}
