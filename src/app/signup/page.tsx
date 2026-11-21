import { AuthForm } from "@/components/auth-form";
export const metadata = { title: "Sign up" };
export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  return <AuthForm mode="signup" returnTo={(await searchParams).next} />;
}
