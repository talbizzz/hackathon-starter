import Link from "next/link";
import { WaitlistForm } from "@/components/waitlist-form";
import { siteConfig as c } from "@/lib/site-config";

export default function Home() {
  return (
    <>
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <span className="font-semibold">{c.name}</span>
        <div className="flex gap-4 text-sm">
          <Link href="/login" className="text-neutral-600 hover:text-black">Sign in</Link>
          <Link href="/signup" className="rounded-lg bg-black px-3 py-1.5 text-white">Get started</Link>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-6 py-24 text-center">
        <h1 className="text-5xl font-bold tracking-tight">{c.hero.title}</h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-neutral-600">{c.hero.subtitle}</p>
        <div className="mt-8 flex justify-center gap-3">
          <a href="#waitlist" className="rounded-lg bg-black px-5 py-2.5 font-medium text-white">{c.hero.cta}</a>
          <Link href="/login" className="rounded-lg border border-neutral-300 px-5 py-2.5 font-medium">{c.hero.secondaryCta}</Link>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-6 px-6 pb-24 md:grid-cols-3">
        {c.features.map((f) => (
          <div key={f.title} className="rounded-2xl border border-neutral-200 p-6">
            <div className="text-3xl">{f.icon}</div>
            <h3 className="mt-3 font-semibold">{f.title}</h3>
            <p className="mt-1 text-neutral-600">{f.body}</p>
          </div>
        ))}
      </section>

      <section id="waitlist" className="bg-neutral-50 px-6 py-24">
        <div className="mx-auto flex max-w-xl flex-col items-center text-center">
          <h2 className="text-3xl font-bold">{c.cta.title}</h2>
          <p className="mb-6 mt-2 text-neutral-600">{c.cta.body}</p>
          <WaitlistForm />
        </div>
      </section>

      <footer className="px-6 py-8 text-center text-sm text-neutral-500">© {c.name}</footer>
    </>
  );
}
