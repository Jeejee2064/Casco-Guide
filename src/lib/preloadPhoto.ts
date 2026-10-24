import { getImageProps } from "next/image";
import { preload } from "react-dom";

/** Warms the exact optimized image URL the browser would pick for `sizes`
 * (same srcset as the real <Image>), so it's cached by the time it renders. */
export function preloadPhoto(src: string, sizes: string) {
  const { props } = getImageProps({ src, alt: "", fill: true, sizes });
  preload(props.src, {
    as: "image",
    imageSrcSet: props.srcSet,
    imageSizes: props.sizes,
    fetchPriority: "high",
  });
}
