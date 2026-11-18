import { motion } from "framer-motion";
import type { PropsWithChildren } from "react";

const ease = [0.22, 1, 0.36, 1] as const;

export function HeroAnimation({ children, className = "" }: PropsWithChildren<{ className?: string }>) {
  return <motion.div className={className} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.72, ease }}>{children}</motion.div>;
}

export function SearchAnimation({ children, className = "" }: PropsWithChildren<{ className?: string }>) {
  return <motion.div className={className} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.56, delay: 0.18, ease }}>{children}</motion.div>;
}

export function ScrollReveal({ children, className = "" }: PropsWithChildren<{ className?: string }>) {
  return <motion.div className={className} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-70px" }} transition={{ duration: 0.6, ease }}>{children}</motion.div>;
}

export function DestinationAnimation({ children, className = "" }: PropsWithChildren<{ className?: string }>) {
  return <motion.div className={className} whileHover={{ y: -4 }} transition={{ duration: 0.2 }}>{children}</motion.div>;
}

export function FlightCardAnimation({ children, className = "" }: PropsWithChildren<{ className?: string }>) {
  return <motion.div className={className} layout initial={{ opacity: 0, scale: 0.985 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.35 }}>{children}</motion.div>;
}

export function PageTransition({ children, className = "" }: PropsWithChildren<{ className?: string }>) {
  return <motion.div className={className} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.35 }}>{children}</motion.div>;
}

export function LoadingAnimation({ className = "" }: { className?: string }) {
  return <div className={`piper-spinner ${className}`} aria-label="Carregando" />;
}

export function MicroInteractions({ children, className = "" }: PropsWithChildren<{ className?: string }>) {
  return <motion.div className={className} whileTap={{ scale: 0.98 }} transition={{ duration: 0.12 }}>{children}</motion.div>;
}
