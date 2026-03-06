import {
  isRouteErrorResponse,
  Links,
  Meta,
  NavLink,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";
import "./app.css";

export const links = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
  },
];

export function Layout({ children }) {
  return (
    <html lang="de">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body className="bg-stone-50 text-stone-900 antialiased">
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return (
    <>
      <nav className="border-b border-stone-200 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 flex items-center gap-1 h-14">
          <span className="text-sm font-semibold text-stone-900 mr-6">KI-Tagesmappe</span>
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `px-3 py-1.5 text-sm rounded-md transition-colors ${
                isActive
                  ? "bg-stone-900 text-white"
                  : "text-stone-500 hover:text-stone-900 hover:bg-stone-100"
              }`
            }
          >
            Eingang
          </NavLink>
          <NavLink
            to="/relevant"
            className={({ isActive }) =>
              `px-3 py-1.5 text-sm rounded-md transition-colors ${
                isActive
                  ? "bg-stone-900 text-white"
                  : "text-stone-500 hover:text-stone-900 hover:bg-stone-100"
              }`
            }
          >
            Relevant
          </NavLink>
          <NavLink
            to="/tagesmappe"
            className={({ isActive }) =>
              `px-3 py-1.5 text-sm rounded-md transition-colors ${
                isActive
                  ? "bg-stone-900 text-white"
                  : "text-stone-500 hover:text-stone-900 hover:bg-stone-100"
              }`
            }
          >
            Tagesmappe
          </NavLink>
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `ml-auto px-3 py-1.5 text-sm rounded-md transition-colors ${
                isActive
                  ? "bg-stone-900 text-white"
                  : "text-stone-500 hover:text-stone-900 hover:bg-stone-100"
              }`
            }
          >
            Einstellungen
          </NavLink>
        </div>
      </nav>
      <Outlet />
    </>
  );
}

export function ErrorBoundary({ error }) {
  let message = "Oops!";
  let details = "Ein unerwarteter Fehler ist aufgetreten.";
  let stack;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Fehler";
    details =
      error.status === 404
        ? "Die angeforderte Seite wurde nicht gefunden."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="pt-16 p-4 container mx-auto">
      <h1 className="text-2xl font-semibold">{message}</h1>
      <p className="mt-2 text-stone-600">{details}</p>
      {stack && (
        <pre className="mt-4 w-full p-4 overflow-x-auto bg-white rounded-xl border border-stone-200">
          <code className="text-sm">{stack}</code>
        </pre>
      )}
    </main>
  );
}
