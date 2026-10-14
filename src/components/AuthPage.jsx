import { useState } from "react";
import { useAuth } from "../context/useAuth";

function AuthPage({ mode, navigate }) {
  const isRegister = mode === "register";
  const { signIn } = useAuth();
  const [values, setValues] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

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
          <label className="block text-sm font-semibold text-[#2E164B]">Password<input required type="password" minLength="8" maxLength="128" autoComplete={isRegister ? "new-password" : "current-password"} value={values.password} onChange={(e) => setValues({ ...values, password: e.target.value })} className="mt-2 w-full rounded-xl border border-purple-200 p-3 font-normal" /></label>
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <button disabled={busy} className="w-full rounded-xl bg-[#2E164B] px-5 py-3 font-semibold text-white hover:bg-[#593580] disabled:opacity-60">{busy ? "Please wait…" : isRegister ? "Create account" : "Sign in"}</button>
        </form>
        <p className="mt-5 text-sm text-slate-600">{isRegister ? "Already have an account?" : "New to OfferScan?"} <button onClick={() => navigate(isRegister ? "/login" : "/register")} className="font-semibold text-[#593580] underline">{isRegister ? "Sign in" : "Create an account"}</button></p>
      </section>
    </main>
  );
}

export default AuthPage;
