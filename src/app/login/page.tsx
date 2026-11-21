import { AuthForm } from "@/components/auth-form";
export const metadata = { title: "Sign in" };
export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  return <AuthForm mode="login" returnTo={(await searchParams).next} />;
}
