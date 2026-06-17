import { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

/**
 * Returns a ref; the referenced element fades+rises in once on mount.
 * Used to animate chat stages in as they stream. Uses opacity (not autoAlpha)
 * so a failed tween can never leave the element permanently hidden.
 */
export function useReveal(y = 18) {
  const ref = useRef(null);
  useGSAP(
    () => {
      if (ref.current) {
        gsap.from(ref.current, { y, opacity: 0, duration: 0.5, ease: 'power2.out' });
      }
    },
    { scope: ref }
  );
  return ref;
}
