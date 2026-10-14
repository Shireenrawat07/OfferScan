
function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="px-6 py-20 md:px-16 md:py-24"
    >
      <div className="mx-auto max-w-6xl">
        <p className="text-center text-xs font-bold tracking-[0.25em] text-[#8B5CC7]">
          HOW IT WORKS
        </p>

        <h2 className="mt-4 text-center text-3xl font-bold tracking-tight text-[#2E164B] md:text-4xl">
          A closer look at every opportunity.
        </h2>

        <p className="mx-auto mt-4 max-w-xl text-center leading-7 text-slate-500">
          Understand potential risks before sharing your information
          or committing to an opportunity.
        </p>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          <article className="group rounded-2xl border border-purple-100 bg-white p-7 transition duration-300 hover:-translate-y-1 hover:border-purple-200 hover:shadow-xl hover:shadow-purple-900/5">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#F3ECFA] font-bold text-[#593580] transition group-hover:bg-[#2E164B] group-hover:text-white">
              01
            </span>

            <h3 className="mt-6 text-xl font-semibold text-[#2E164B]">
              Paste your offer
            </h3>

            <p className="mt-3 leading-7 text-slate-600">
              Add a job description, recruiter message, or offer
              text you want to examine.
            </p>
          </article>

          <article className="group rounded-2xl border border-purple-100 bg-white p-7 transition duration-300 hover:-translate-y-1 hover:border-purple-200 hover:shadow-xl hover:shadow-purple-900/5">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#F3ECFA] font-bold text-[#593580] transition group-hover:bg-[#2E164B] group-hover:text-white">
              02
            </span>

            <h3 className="mt-6 text-xl font-semibold text-[#2E164B]">
              Check warning signs
            </h3>

            <p className="mt-3 leading-7 text-slate-600">
              Look for payment requests, pressure tactics, and
              other potential risk indicators.
            </p>
          </article>

          <article className="group rounded-2xl border border-purple-100 bg-white p-7 transition duration-300 hover:-translate-y-1 hover:border-purple-200 hover:shadow-xl hover:shadow-purple-900/5">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#F3ECFA] font-bold text-[#593580] transition group-hover:bg-[#2E164B] group-hover:text-white">
              03
            </span>

            <h3 className="mt-6 text-xl font-semibold text-[#2E164B]">
              Understand the results
            </h3>

            <p className="mt-3 leading-7 text-slate-600">
              See why a warning appeared and learn how to verify
              the employer independently.
            </p>
          </article>
        </div>
      </div>
    </section>
  )
}

export default HowItWorks
