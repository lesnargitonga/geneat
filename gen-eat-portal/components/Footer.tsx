import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-24 border-t border-ink/5 bg-white/40">
      <div className="container-page py-12 grid md:grid-cols-4 gap-8 text-sm">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2 mb-3">
            <span className="inline-flex items-center justify-center w-9 h-9 rounded-2xl bg-brand text-white">
              <span className="font-bold">G</span>
            </span>
            <span className="h-display text-xl">
              Gen-<span className="text-brand">Eat</span>
            </span>
          </div>
          <p className="text-ink-mute max-w-md">
            Campus food, on tap. Order between classes from any café on
            campus — pick up the moment the lecture ends.
          </p>
          <p className="text-xs text-ink-mute mt-4">
            Pilot at USIU-Africa, Nairobi. Built by Omni AI.
          </p>
        </div>
        <div>
          <h4 className="font-semibold mb-3">Students</h4>
          <ul className="space-y-2 text-ink-mute">
            <li><Link className="hover:text-ink" href="/cafes">All cafés</Link></li>
            <li><Link className="hover:text-ink" href="/map">Campus map</Link></li>
            <li><Link className="hover:text-ink" href="/about#how">How it works</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold mb-3">Owners & schools</h4>
          <ul className="space-y-2 text-ink-mute">
            <li><Link className="hover:text-ink" href="/owners">List your café</Link></li>
            <li><Link className="hover:text-ink" href="/owners#pricing">Pricing</Link></li>
            <li><a className="hover:text-ink" href="mailto:hello@gen-eat.app">hello@gen-eat.app</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-ink/5 py-5 text-center text-xs text-ink-mute">
        © {new Date().getFullYear()} Gen-Eat · Powered by Omni AI
      </div>
    </footer>
  );
}
