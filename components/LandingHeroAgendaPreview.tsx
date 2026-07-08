export default function LandingHeroAgendaPreview() {
  return (
    <div className="relative mx-auto w-[90%]" aria-hidden>
      <div className="pointer-events-none absolute -inset-4 rounded-4xl bg-white/10 blur-2xl" />
      <div className="relative overflow-hidden rounded-4xl border border-white/20 bg-black/15 shadow-[0_24px_70px_rgba(0,0,0,0.28)]">
        <video
          className="block h-auto w-full"
          autoPlay
          loop
          muted
          playsInline
          preload="none"
        >
          <source src="/hero-google-agenda.mp4" type="video/mp4" />
        </video>
      </div>
    </div>
  );
}
