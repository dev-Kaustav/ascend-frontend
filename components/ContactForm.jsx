export default function ContactForm() {
  return (
    <section
      id="contact"
      className="border-t border-slate-200 bg-[color:var(--color-bg)] py-16 sm:py-20"
    >
      <div className="mx-auto grid max-w-6xl gap-10 section-pad lg:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-4 reveal-text">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            Contact
          </p>
          <h2 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
            Start a distribution conversation
          </h2>
          <p className="text-sm text-slate-600 sm:text-base">
            Tell us about your portfolio and expansion goals. Our team will
            respond with the right distribution plan.
          </p>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
            Reach us directly at
            <span className="font-semibold text-slate-900">
              {" "}admin@ascendfoods.in
            </span>
            .
          </div>
        </div>
        <form
          action="https://formspree.io/f/your-form-id"
          method="POST"
          className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-sm"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label
                htmlFor="name"
                className="reveal-text text-sm font-medium text-slate-700"
              >
                Name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                placeholder="Full name"
                required
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-accent"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label
                htmlFor="company"
                className="reveal-text text-sm font-medium text-slate-700"
              >
                Company
              </label>
              <input
                id="company"
                name="company"
                type="text"
                placeholder="Company name"
                required
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-accent"
              />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label
                htmlFor="email"
                className="reveal-text text-sm font-medium text-slate-700"
              >
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="name@company.com"
                required
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-accent"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label
                htmlFor="phone"
                className="reveal-text text-sm font-medium text-slate-700"
              >
                Phone (optional)
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                placeholder="+91"
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-accent"
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label
              htmlFor="message"
              className="reveal-text text-sm font-medium text-slate-700"
            >
              Message
            </label>
            <textarea
              id="message"
              name="message"
              rows={4}
              placeholder="Share your distribution goals"
              required
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-accent"
            />
          </div>
          <button
            type="submit"
            className="rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white shadow-soft transition hover:bg-[#6b3df0]"
          >
            Send Message
          </button>
          <p className="reveal-text text-xs text-slate-500">
            This form uses Formspree. Replace the endpoint with your form ID
            before launch.
          </p>
        </form>
      </div>
    </section>
  );
}
