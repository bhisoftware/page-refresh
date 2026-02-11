import Link from "next/link";

export default function Forbidden() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-2xl font-semibold text-foreground">
          This link is invalid or has expired
        </h1>
        <p className="text-muted-foreground">
          If you have a results link, make sure you’re using the full URL that was
          sent to you. Otherwise, run a new analysis from the homepage.
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Back to homepage
        </Link>
      </div>
    </main>
  );
}
