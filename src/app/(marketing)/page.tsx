import { Landing } from "@/components/landing";

// The front door: what the product is, and one button into it. Static, so it loads fast inside Instagram.
export const metadata = { alternates: { canonical: "/" } };

export default function Home() {
  return <Landing />;
}
