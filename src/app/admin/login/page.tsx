import { t } from "@/lib/strings";
import { LoginForm } from "./login-form";

export const metadata = { title: t.admin.login.title };

export default function LoginPage() {
  return (
    <main className="bg-muted/40 flex min-h-screen items-center justify-center px-4">
      <div className="bg-background w-full max-w-sm rounded-xl border p-6 shadow-sm">
        <h1 className="mb-6 text-xl font-semibold">{t.admin.login.title}</h1>
        <LoginForm />
      </div>
    </main>
  );
}
