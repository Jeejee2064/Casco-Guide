"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { MapPin } from "lucide-react";
import { HERO_IMAGE } from "@/lib/data/categoryImages";
import { staggerContainer, fadeUp } from "./motion";

/** Compact intro strip — a quick beat of brand/context, not a scroll-stopping hero. */
export function Hero({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <section className="mesh-hero grain relative overflow-hidden">
      <div className="absolute inset-0">
        <Image
          src={HERO_IMAGE}
          alt=""
          fill
          preload
          sizes="100vw"
          className="object-cover opacity-25 mix-blend-luminosity"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0d0a17] via-[#0d0a17]/50 to-transparent" />
      </div>

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="relative mx-auto flex max-w-6xl flex-col gap-2 px-4 py-7 text-white sm:flex-row sm:items-end sm:justify-between sm:px-6 sm:py-9"
      >
        <div>
          <motion.span
            variants={fadeUp}
            className="inline-flex items-center gap-1.5 text-xs font-bold tracking-wide text-white/70"
          >
            <MapPin size={13} className="text-gold" />
            Casco Viejo, Panama City
          </motion.span>

          <motion.h1
            variants={fadeUp}
            className="font-heading mt-1 text-2xl font-extrabold leading-tight sm:text-3xl"
          >
            <span className="gradient-text">{title}</span>
          </motion.h1>
        </div>

        <motion.p variants={fadeUp} className="text-sm text-white/75 sm:pb-1 sm:text-base">
          {subtitle}
        </motion.p>
      </motion.div>
    </section>
  );
}
