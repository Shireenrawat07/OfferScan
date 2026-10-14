
import { useAuth } from "../context/useAuth";

function Navbar({ navigate }) {
  const { user, signOut } = useAuth();

  async function logout() {
    try {
      await signOut();
      navigate("/");
    } catch (error) {
      window.alert(error.message);
    }
  }

  return (
    <nav className="flex items-center justify-between border-b border-purple-100 bg-white px-6 py-5 md:px-16">
        <a href="/" onClick={(event) => { event.preventDefault(); navigate("/"); }} className="flex items-center gap-3">
        <span className="text-2xl font-bold leading-none tracking-tight text-[#2E164B]">
          Offer<span className="text-[#8B5CC7]">Lens</span>
          <span className="mt-1 block text-[11px] font-medium tracking-wide text-[#593580]">Look closer. Apply smarter.</span>
        </span>
      </a>

      <div className="flex flex-wrap items-center justify-end gap-3 sm:gap-6">
        <a
          href="/#how-it-works"
          onClick={(event) => { event.preventDefault(); navigate("/#how-it-works"); }}
          className="hidden text-sm font-medium text-slate-600 transition hover:text-[#593580] sm:block"
        >
          How it works
        </a>

        {user ? <>
          <a href="/history" onClick={(event) => { event.preventDefault(); navigate("/history"); }} className="text-sm font-semibold text-[#593580]">History</a>
          <span className="hidden text-sm text-slate-600 md:inline">{user.name}</span>
          <button onClick={logout} className="text-sm font-semibold text-[#593580]">Sign out</button>
        </> : <>
        <a href="/login" onClick={(event) => { event.preventDefault(); navigate("/login"); }} className="text-sm font-semibold text-[#593580]">Sign in</a>
        <a href="/register" onClick={(event) => { event.preventDefault(); navigate("/register"); }} className="text-sm font-semibold text-[#593580]">Create account</a>
        </>}
        <a
          href="/#analyze"
          onClick={(event) => { event.preventDefault(); navigate("/#analyze"); }}
          className="rounded-xl bg-[#2E164B] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-purple-900/15 transition hover:bg-[#593580]"
        >
          Get Started
        </a>
      </div>
    </nav>
  )
}

export default Navbar
