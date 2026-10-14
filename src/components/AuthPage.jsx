import { useState } from "react";
import { useAuth } from "../context/useAuth";

function AuthPage({ mode, navigate }) {
  const isRegister = mode === "register";
  const { signIn } = useAuth();
  const [values, setValues] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await signIn(`/api/auth/${isRegister ? "register" : "login"}`, values);
      navigate("/history");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-[70vh] bg-[#F8F5FC] px-5 py-14">
      <section className="mx-auto max-w-md rounded-3xl border border-purple-100 bg-white p-7 shadow-sm sm:p-10">
        <p className="text-sm font-semibold text-[#8B5CC7]">OfferScan account</p>
        <h1 className="mt-2 text-3xl font-bold text-[#2E164B]">{isRegister ? "Create your account" : "Welcome back"}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">Sign in to save and revisit your analysis results. Your messages and uploaded files are not saved.</p>
        <form className="mt-7 space-y-4" onSubmit={submit}>
          {isRegister && <label className="block text-sm font-semibold text-[#2E164B]">Name<input required minLength="2" maxLength="80" autoComplete="name" value={values.name} onChange={(e) => setValues({ ...values, name: e.target.value })} className="mt-2 w-full rounded-xl border border-purple-200 p-3 font-normal" /></label>}
          <label className="block text-sm font-semibold text-[#2E164B]">Email<input required type="email" autoComplete="email" value={values.email} onChange={(e) => setValues({ ...values, email: e.target.value })} className="mt-2 w-full rounded-xl border border-purple-200 p-3 font-normal" /></label>
          <label className="block text-sm font-semibold text-[#2E164B]">
            Password
            <span className="relative mt-2 block">
              <input required type={passwordVisible ? "text" : "password"} minLength="8" maxLength="128" autoComplete={isRegister ? "new-password" : "current-password"} value={values.password} onChange={(e) => setValues({ ...values, password: e.target.value })} className="w-full rounded-xl border border-purple-200 p-3 pr-12 font-normal" />
              <button
                type="button"
                aria-label={passwordVisible ? "Hide password" : "Show password"}
                aria-pressed={passwordVisible}
                onClick={() => setPasswordVisible((visible) => !visible)}
                className="absolute inset-y-0 right-0 flex items-center rounded-r-xl px-3 text-slate-500 transition-colors hover:text-[#593580] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CC7] focus-visible:ring-offset-2"
              >
                <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  {passwordVisible ? (
                    <>
                      <path d="M3 3l18 18" />
                      <path d="M10.6 10.6a2 2 0 002.8 2.8" />
                      <path d="M9.9 5.2A10.8 10.8 0 0112 5c5.2 0 8.6 4.4 9.5 6-.4.7-1.3 2-2.7 3.2M6.2 6.2C4.3 7.4 3 9.3 2.5 11c.9 1.6 4.3 6 9.5 6 1 0 1.9-.2 2.8-.5" />
                    </>
                  ) : (
                    <>
                      <path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6z" />
                      <circle cx="12" cy="12" r="2.5" />
                    </>
                  )}
                </svg>
              </button>
            </span>
          </label>
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <button disabled={busy} className="w-full rounded-xl bg-[#2E164B] px-5 py-3 font-semibold text-white hover:bg-[#593580] disabled:opacity-60">{busy ? "Please wait…" : isRegister ? "Create account" : "Sign in"}</button>
        </form>
        <p className="mt-5 text-sm text-slate-600">{isRegister ? "Already have an account?" : "New to OfferScan?"} <button onClick={() => navigate(isRegister ? "/login" : "/register")} className="font-semibold text-[#593580] underline">{isRegister ? "Sign in" : "Create an account"}</button></p>
      </section>
    </main>
  );
}

export default AuthPage;
