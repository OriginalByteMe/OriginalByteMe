import { ImageBlock } from "noah-portfolio";
import { SAMPLE_IMAGE } from "../support/sample-image";

// ImageBlock — an image inside a matte figure with an optional mono caption.
// A real portfolio image is passed inline so the card is fully self-contained.

export const WithCaption = () => (
  <ImageBlock
    props={{
      src: SAMPLE_IMAGE,
      alt: "Ask-Me portfolio hero",
      caption: "The Ask-Me portfolio home view",
    }}
  />
);

export const NoCaption = () => (
  <ImageBlock props={{ src: SAMPLE_IMAGE, alt: "Ask-Me portfolio hero" }} />
);
