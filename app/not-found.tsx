import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 md:p-8">
      <div className="w-full max-w-md mx-auto text-center space-y-6">
        <h1 className="text-2xl font-bold text-foreground">
          Page not found
        </h1>
        <p className="text-muted-foreground">
          The page you’re looking for doesn’t exist or has been moved.
        </p>
        <div className="flex justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium h-10 px-8 bg-primary text-primary-foreground shadow hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Go Home
          </Link>
        </div>
      </div>
    </main>
  );
}
