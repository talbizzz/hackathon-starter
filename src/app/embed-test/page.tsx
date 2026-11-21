import { EmbedTest } from "./embed-test";

// Temporary spike (Milestone 1, T1.4): proves tap-to-load embeds on real phones. Deleted in Milestone 2.
export const metadata = { title: "Embed test", robots: { index: false, follow: false } };

export default function EmbedTestPage() {
  return <EmbedTest />;
}
