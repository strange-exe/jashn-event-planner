import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container stack" style={{ paddingTop: "var(--space-7)", maxWidth: 640 }}>
      <h1>Page not found</h1>
      <p className="muted">The page you were looking for does not exist.</p>
      <div className="row">
        <Link className="btn btn-primary" href="/">
          Go home
        </Link>
      </div>
    </div>
  );
}
