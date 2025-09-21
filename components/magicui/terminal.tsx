"use client";

import React, { Children, createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

// Lightweight, dependency-free approximation of Magic UI Terminal

type SequenceContextValue = {
  completeItem: (index: number) => void;
  activeIndex: number;
  sequenceStarted: boolean;
} | null;

const SequenceContext = createContext<SequenceContextValue>(null);
const useSequence = () => useContext(SequenceContext);

const ItemIndexContext = createContext<number | null>(null);
const useItemIndex = () => useContext(ItemIndexContext);

function useInView<T extends Element>(ref: React.RefObject<T | null>, options?: IntersectionObserverInit) {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setInView(true);
    }, options ?? { threshold: 0.3 });
    obs.observe(node);
    return () => obs.disconnect();
  }, [ref, options]);
  return inView;
}

export interface AnimatedSpanProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  delay?: number;
  startOnView?: boolean;
}

export const AnimatedSpan = ({ children, delay = 0, className, startOnView = false, ...props }: AnimatedSpanProps) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const isInView = useInView(ref);
  const sequence = useSequence();
  const itemIndex = useItemIndex();
  const [hasStarted, setHasStarted] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!sequence || itemIndex === null) return;
    if (!sequence.sequenceStarted || hasStarted) return;
    if (sequence.activeIndex === itemIndex) setHasStarted(true);
  }, [sequence?.activeIndex, sequence?.sequenceStarted, itemIndex, hasStarted]);

  useEffect(() => {
    if (sequence) return; // handled above
    if (startOnView && !isInView) return;
    const t = setTimeout(() => setHasStarted(true), delay);
    return () => clearTimeout(t);
  }, [sequence, startOnView, isInView, delay]);

  useEffect(() => {
    if (!sequence || itemIndex === null) return;
    if (!hasStarted || done) return;
    // mark complete after CSS transition
    const t = setTimeout(() => {
      sequence.completeItem(itemIndex);
      setDone(true);
    }, 350);
    return () => clearTimeout(t);
  }, [sequence, itemIndex, hasStarted, done]);

  return (
    <div
      ref={ref}
      className={cn(
        "grid text-sm font-normal tracking-tight transition-all duration-300",
        hasStarted ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export interface TypingAnimationProps extends React.HTMLAttributes<HTMLElement> {
  children: string;
  duration?: number; // ms per char
  delay?: number;
  as?: React.ElementType;
  startOnView?: boolean;
}

export const TypingAnimation = ({
  children,
  className,
  duration = 60,
  delay = 0,
  as: Component = "span",
  startOnView = true,
  ...props
}: TypingAnimationProps) => {
  if (typeof children !== "string") throw new Error("TypingAnimation: children must be a string");

  const ref = useRef<HTMLElement | null>(null);
  const isInView = useInView(ref);
  const sequence = useSequence();
  const itemIndex = useItemIndex();
  const [started, setStarted] = useState(false);
  const [text, setText] = useState("");

  // start logic
  useEffect(() => {
    if (sequence && itemIndex !== null) {
      if (!sequence.sequenceStarted || started) return;
      if (sequence.activeIndex === itemIndex) setStarted(true);
      return;
    }
    if (!startOnView) {
      const t = setTimeout(() => setStarted(true), delay);
      return () => clearTimeout(t);
    }
    if (!isInView) return;
    const t = setTimeout(() => setStarted(true), delay);
    return () => clearTimeout(t);
  }, [sequence?.activeIndex, sequence?.sequenceStarted, itemIndex, started, startOnView, isInView, delay, sequence]);

  // typing effect
  useEffect(() => {
    if (!started) return;
    let i = 0;
    const iv = setInterval(() => {
      if (i < children.length) {
        setText(children.slice(0, i + 1));
        i++;
      } else {
        clearInterval(iv);
        if (sequence && itemIndex !== null) sequence.completeItem(itemIndex);
      }
    }, duration);
    return () => clearInterval(iv);
  }, [children, duration, started, sequence, itemIndex]);

  return (
    <Component ref={ref} className={cn("text-sm font-normal tracking-tight", className)} {...props}>
      {text}
    </Component>
  );
};

export interface TerminalProps {
  children: React.ReactNode;
  className?: string;
  sequence?: boolean;
  startOnView?: boolean;
}

export const Terminal = ({ children, className, sequence = true, startOnView = true }: TerminalProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isInView = useInView(containerRef);
  const [activeIndex, setActiveIndex] = useState(0);
  const sequenceStarted = sequence ? (!startOnView || isInView) : false;

  const contextValue = useMemo<SequenceContextValue>(() => {
    if (!sequence) return null;
    return {
      completeItem: (index: number) => setActiveIndex((c) => (index === c ? c + 1 : c)),
      activeIndex,
      sequenceStarted
    };
  }, [sequence, activeIndex, sequenceStarted]);

  const wrappedChildren = useMemo(() => {
    if (!sequence) return children;
    return Children.toArray(children).map((child, idx) => (
      <ItemIndexContext.Provider key={idx} value={idx}>
        {child as React.ReactNode}
      </ItemIndexContext.Provider>
    ));
  }, [children, sequence]);

  const content = (
    <div
      ref={containerRef}
      className={cn(
        // Force dark mode styling regardless of app theme
        "z-0 h-full max-h-[400px] w-full max-w-lg rounded-xl border bg-neutral-950 border-neutral-800 text-neutral-200",
        "shadow-[0_0_0_1px_rgba(0,0,0,0.2)]",
        className
      )}
    >
      <div className="flex flex-col gap-y-2 border-b border-neutral-800 p-4">
        <div className="flex flex-row gap-x-2">
          <div className="h-2 w-2 rounded-full bg-red-500" />
          <div className="h-2 w-2 rounded-full bg-yellow-500" />
          <div className="h-2 w-2 rounded-full bg-green-500" />
        </div>
      </div>
      <pre className="p-4 text-neutral-100">
        <code className="grid gap-y-1 overflow-auto font-mono">{wrappedChildren}</code>
      </pre>
    </div>
  );

  if (!sequence) return content;
  return <SequenceContext.Provider value={contextValue}>{content}</SequenceContext.Provider>;
};
