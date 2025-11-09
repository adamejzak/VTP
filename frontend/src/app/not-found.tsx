import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center px-6">
      <div className="text-center">
        <h1 className="text-4xl font-bold">404 — Nie znaleziono strony</h1>
        <p className="mt-3 text-muted-foreground">
          Strona, której szukasz, nie istnieje lub została przeniesiona.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Link
            className="rounded-md bg-primary px-4 py-2 text-primary-foreground transition hover:opacity-90"
            href="/"
          >
            Wróć na stronę główną
          </Link>
          <Link className="rounded-md border px-4 py-2 transition hover:bg-accent" href="/dashboard">
            Przejdź do panelu
          </Link>
        </div>
      </div>
    </div>
  );
}


