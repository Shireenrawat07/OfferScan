
function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-[#F3ECFA] via-[#FAF7FD] to-white px-6 py-24 text-center md:py-32">
      <div className="pointer-events-none absolute -left-20 top-16 h-64 w-64 rounded-full bg-purple-200/30 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-0 h-72 w-72 rounded-full bg-violet-200/40 blur-3xl" />

      <div className="relative mx-auto max-w-4xl">
        <span className="inline-flex items-center gap-2 rounded-full border border-[#DCC8F2] bg-white/80 px-4 py-2 text-sm font-medium text-[#593580] shadow-sm">
          <span className="h-2 w-2 rounded-full bg-[#8B5CC7]" />
          Your career deserves a closer look
        </span>

        <h1 className="mt-8 text-4xl font-bold leading-tight tracking-tight text-[#2E164B] md:text-6xl">
          Before you trust an offer,
          <span className="mt-2 block bg-gradient-to-r from-[#593580] to-[#9B72CE] bg-clip-text text-transparent">
            take a closer look.
          </span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-slate-600 md:text-lg">
          Analyze job offers and recruiter messages for potential
          warning signs. Make informed career decisions with
          greater confidence using OfferLens.
        </p>

        <a
          href="#analyze"
          className="mt-9 inline-flex items-center gap-3 rounded-xl bg-[#2E164B] px-7 py-4 font-semibold text-white shadow-xl shadow-purple-900/20 transition hover:-translate-y-1 hover:bg-[#593580]"
        >
          Analyze an Offer
          <span aria-hidden="true">→</span>
        </a>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-slate-500">
          <span>✓ Clear explanations</span>
          <span>✓ Practical checks</span>
          <span>✓ No AI required</span>
        </div>
      </div>
    </section>
  )
}

export default Hero
