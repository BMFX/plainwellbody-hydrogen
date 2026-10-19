import { Link } from "react-router";

import { Media } from "~/components/Media";

/** The olive split that sends shoppers to the routine finder. */
export function RoutineBlock() {
  return (
    <section className="bg-olive text-paper mt-28 grid md:grid-cols-2">
      <Media
        name="campaign-everyday-ritual"
        alt="Hands lathering under water at a green stone basin"
        sizes="(min-width: 48rem) 50vw, 100vw"
        width={1024}
        height={1536}
        className="block h-[360px] w-full object-cover object-[50%_45%] md:h-[560px]"
      />
      <div className="flex flex-col justify-center gap-[22px] px-[clamp(28px,7vw,120px)] py-16">
        <span className="pw-eyebrow text-on-olive">Not sure where to start</span>
        <h2 className="pw-h2">
          Two questions,
          <br />
          one routine.
        </h2>
        <p className="text-on-olive max-w-[400px] text-base leading-[1.7]">
          Tell us who it’s for and which scent you like. We’ll show every item and quantity before anything goes
          in your bag.
        </p>
        <Link to="/pages/routine" className="pw-btn pw-btn--outline-light self-start">
          Find your routine
        </Link>
      </div>
    </section>
  );
}
