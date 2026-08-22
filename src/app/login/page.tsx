import { LoginForm } from "@/features/auth/login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6">
          <p className="text-sm font-medium text-slate-500">ClinicOS Maroc</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-950">Connexion</h1>
          <p className="mt-2 text-sm text-slate-600">
            Accès réservé au personnel autorisé de la clinique.
          </p>
        </div>
        <LoginForm />
      </section>
    </main>
  );
}
