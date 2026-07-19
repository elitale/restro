"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";

import useEmblaCarousel from "embla-carousel-react";

export interface CarouselImage {
  readonly id: string;
  readonly url: string;
}

/** Swipeable photo carousel (embla) with dot indicators. A single image renders
 *  plain; nothing renders when there are no images. */
export function ImageCarousel({
  images,
  alt,
  className,
}: {
  readonly images: readonly CarouselImage[];
  readonly alt: string;
  readonly className?: string;
}) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: images.length > 1 });
  const [selected, setSelected] = useState(0);

  const onSelect = useCallback(() => {
    if (emblaApi) {
      setSelected(emblaApi.selectedScrollSnap());
    }
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) {
      return;
    }
    // Only subscribe to user-driven select events; the first slide is index 0,
    // which is the initial state (no synchronous setState in the effect body).
    emblaApi.on("select", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi, onSelect]);

  if (images.length === 0) {
    return null;
  }

  if (images.length === 1) {
    return (
      <div
        className={`bg-muted relative aspect-video overflow-hidden rounded-lg ${className ?? ""}`}
      >
        <Image
          src={images[0].url}
          alt={alt}
          fill
          className="object-cover"
          sizes="(max-width: 480px) 100vw, 480px"
        />
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-2 ${className ?? ""}`}>
      <div className="overflow-hidden rounded-lg" ref={emblaRef}>
        <div className="flex">
          {images.map((img) => (
            <div
              key={img.id}
              className="bg-muted relative aspect-video min-w-0 flex-[0_0_100%]"
            >
              <Image
                src={img.url}
                alt={alt}
                fill
                className="object-cover"
                sizes="(max-width: 480px) 100vw, 480px"
              />
            </div>
          ))}
        </div>
      </div>
      <div className="flex justify-center gap-1.5">
        {images.map((img, i) => (
          <button
            key={img.id}
            type="button"
            aria-label={`Show photo ${i + 1}`}
            onClick={() => emblaApi?.scrollTo(i)}
            className={`size-1.5 rounded-full transition-colors ${
              i === selected ? "bg-primary" : "bg-muted-foreground/30"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
