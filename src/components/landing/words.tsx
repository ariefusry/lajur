import { Fragment } from "react";

/** Heading text with each word in its own span, so LandingMotion can reveal the words one by one. Reads as plain text. */
export function Words({ children }: { children: string }) {
  return children.split(" ").map((word, i, all) => (
    <Fragment key={i}>
      <span data-lm="word" className="inline-block">
        {word}
      </span>
      {i < all.length - 1 && " "}
    </Fragment>
  ));
}
