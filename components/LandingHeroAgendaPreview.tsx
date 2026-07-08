export default function LandingHeroAgendaPreview() {
  return (
    <div className="relative" aria-hidden>
      <div className="pointer-events-none absolute -inset-4 rounded-4xl bg-white/10 blur-2xl" />
      <div className="relative aspect-4/5 overflow-hidden rounded-4xl border border-white/20 bg-transparent shadow-[0_24px_70px_rgba(0,0,0,0.28)]">
        <video
          className="absolute inset-0 h-full w-full scale-[1.52] object-cover object-[18%_center]"
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
        >
          <source src="/hero-google-agenda.mp4" type="video/mp4" />
        </video>
      </div>
    </div>
  );
}
