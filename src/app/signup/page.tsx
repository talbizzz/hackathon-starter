import { PRIVATE_ROBOTS } from "@/lib/seo";
import { AuthForm } from "@/components/auth-form";
export const metadata = { title: "Sign up", robots: PRIVATE_ROBOTS };
export default function Page() {
  return <AuthForm mode="signup" />;
}
